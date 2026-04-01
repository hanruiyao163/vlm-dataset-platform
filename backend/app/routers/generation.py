from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..dependencies import get_or_create_settings
from ..models import DescriptionGeneration, GenerationEvent, Image, QuestionGeneration
from ..schemas import (
    BatchGenerationResponse,
    GenerateDescriptionsRequest,
    GenerateQuestionsRequest,
    GenerationRecord,
    ImageGenerationResult,
)
from ..services.llm import (
    describe_from_question,
    describe_from_question_batch,
    describe_image_batch,
    LLMServiceError,
    describe_image,
    generate_question_batch,
    generate_question,
    resolve_model_profile,
    run_limited,
)
from ..services.files import resolve_image_path

router = APIRouter(tags=["generation"])


def _record_to_schema(record: DescriptionGeneration | QuestionGeneration) -> GenerationRecord:
    description_id = getattr(record, "description_id", None)
    paired_question_id = getattr(record, "paired_question_id", None)
    return GenerationRecord(
        id=record.id,
        prompt=record.prompt,
        model=record.model,
        content=record.content,
        status=record.status,
        error=record.error,
        created_at=record.created_at,
        description_id=description_id,
        paired_question_id=paired_question_id,
    )


@router.post("/descriptions/generate", response_model=BatchGenerationResponse)
async def generate_descriptions(payload: GenerateDescriptionsRequest, db: Session = Depends(get_db)):
    settings = get_or_create_settings(db)
    selected_profile = resolve_model_profile(settings, payload.model_profile)
    images = db.scalars(select(Image).where(Image.id.in_(payload.image_ids))).all()
    if not images:
        raise HTTPException(status_code=404, detail="未找到任何图片。")
    if payload.mode == "question_image" and not payload.question_id_map:
        raise HTTPException(status_code=400, detail="根据问题和图片生成描述时必须提供 question_id_map。")
    if payload.use_structured_output and payload.count_per_image < 2:
        raise HTTPException(status_code=400, detail="Structured output 批量生成至少需要每图生成 2 条。")
    image_lookup = {image.id: image for image in images}

    planned: list[tuple[int, Path, str, str | None, int | None]] = []
    question_id_map = payload.question_id_map or {}
    for image in images:
        file_path = resolve_image_path(image.stored_path)
        selected_questions: list[tuple[int | None, str | None]] = []
        if payload.mode == "question_image":
            selected_question_ids = question_id_map.get(image.id) or []
            if not selected_question_ids:
                raise HTTPException(status_code=400, detail=f"图片 {image.id} 缺少 question_id。")
            for selected_question_id in selected_question_ids:
                question_record = db.get(QuestionGeneration, selected_question_id)
                if not question_record:
                    raise HTTPException(status_code=404, detail=f"问题记录 {selected_question_id} 不存在。")
                if question_record.image_id != image.id:
                    raise HTTPException(status_code=400, detail=f"问题记录 {selected_question_id} 不属于图片 {image.id}。")
                if question_record.status != "success":
                    raise HTTPException(status_code=400, detail=f"问题记录 {selected_question_id} 不是成功状态，无法用于配对生成描述。")
                selected_questions.append((selected_question_id, question_record.content))
        else:
            selected_questions.append((None, None))
        for selected_question_id, selected_question in selected_questions:
            for _ in range(payload.count_per_image):
                planned.append((image.id, file_path, payload.prompt_template, selected_question, selected_question_id))

    if payload.use_structured_output:
        grouped_planned: dict[tuple[int, int | None], tuple[Path, str, str | None, int]] = {}
        for image_id, file_path, prompt, question, question_id in planned:
            group_key = (image_id, question_id)
            if group_key not in grouped_planned:
                grouped_planned[group_key] = (file_path, prompt, question, 0)
            current_file_path, current_prompt, current_question, current_count = grouped_planned[group_key]
            grouped_planned[group_key] = (current_file_path, current_prompt, current_question, current_count + 1)

        async def run_one_batch(image_id: int, question_id: int | None, file_path: Path, prompt: str, question: str | None, count: int):
            try:
                if payload.mode == "question_image":
                    contents = await describe_from_question_batch(
                        settings,
                        prompt,
                        file_path,
                        count=count,
                        question=question or "",
                        model_profile=payload.model_profile,
                    )
                else:
                    contents = await describe_image_batch(
                        settings,
                        prompt,
                        file_path,
                        count=count,
                        model_profile=payload.model_profile,
                    )
                return image_id, question_id, prompt, contents, None
            except (LLMServiceError, Exception) as exc:
                return image_id, question_id, prompt, None, str(exc)

        coroutines = [
            run_one_batch(image_id, question_id, file_path, prompt, question, count)
            for (image_id, question_id), (file_path, prompt, question, count) in grouped_planned.items()
        ]
    else:
        async def run_one(image_id: int, question_id: int | None, prompt: str, file_path: Path, question: str | None):
            try:
                content = (
                    await describe_from_question(
                        settings,
                        prompt,
                        file_path,
                        question or "",
                        model_profile=payload.model_profile,
                    )
                    if payload.mode == "question_image"
                    else await describe_image(settings, prompt, file_path, model_profile=payload.model_profile)
                )
                return image_id, question_id, prompt, content, None
            except (LLMServiceError, Exception) as exc:
                return image_id, question_id, prompt, None, str(exc)

        coroutines = [
            run_one(image_id, question_id, prompt, file_path, question)
            for image_id, file_path, prompt, question, question_id in planned
        ]
    outcomes = await run_limited(coroutines, payload.concurrency)

    created_by_image: dict[int, list[DescriptionGeneration]] = {image.id: [] for image in images}
    errors_by_image: dict[int, list[str]] = {image.id: [] for image in images}

    for outcome in outcomes:
        if isinstance(outcome, Exception):
            continue
        if payload.use_structured_output:
            image_id, question_id, prompt, contents, error = outcome
            if error or contents is None:
                errors_by_image[image_id].append(error or "生成失败。")
                image = image_lookup.get(image_id)
                if image is not None:
                    db.add(
                        GenerationEvent(
                            project_id=image.project_id,
                            batch_id=image.batch_id,
                            image_id=image.id,
                            task_type="description",
                            source_record_id=question_id,
                            prompt=prompt,
                            model=selected_profile.model,
                            status="failed",
                            content="",
                            error=error or "生成失败。",
                        )
                    )
                continue
            for content in contents:
                record = DescriptionGeneration(
                    image_id=image_id,
                    paired_question_id=question_id,
                    prompt=prompt,
                    model=selected_profile.model,
                    status="success",
                    error="",
                    content=content,
                )
                db.add(record)
                db.flush()
                image = image_lookup.get(image_id)
                if image is not None:
                    db.add(
                        GenerationEvent(
                            project_id=image.project_id,
                            batch_id=image.batch_id,
                            image_id=image.id,
                            task_type="description",
                            source_record_id=question_id,
                            prompt=prompt,
                            model=selected_profile.model,
                            status="success",
                            content=content,
                            error="",
                        )
                    )
                created_by_image[image_id].append(record)
        else:
            image_id, question_id, prompt, content, error = outcome
            if error or content is None:
                errors_by_image[image_id].append(error or "生成失败。")
                image = image_lookup.get(image_id)
                if image is not None:
                    db.add(
                        GenerationEvent(
                            project_id=image.project_id,
                            batch_id=image.batch_id,
                            image_id=image.id,
                            task_type="description",
                            source_record_id=question_id,
                            prompt=prompt,
                            model=selected_profile.model,
                            status="failed",
                            content="",
                            error=error or "生成失败。",
                        )
                    )
                continue
            record = DescriptionGeneration(
                image_id=image_id,
                paired_question_id=question_id,
                prompt=prompt,
                model=selected_profile.model,
                status="success",
                error="",
                content=content,
            )
            db.add(record)
            db.flush()
            image = image_lookup.get(image_id)
            if image is not None:
                db.add(
                    GenerationEvent(
                        project_id=image.project_id,
                        batch_id=image.batch_id,
                        image_id=image.id,
                        task_type="description",
                        source_record_id=question_id,
                        prompt=prompt,
                        model=selected_profile.model,
                        status="success",
                        content=content,
                        error="",
                    )
                )
            created_by_image[image_id].append(record)
    db.commit()

    results: list[ImageGenerationResult] = []
    succeeded_images = 0
    failed_images = 0
    for image in images:
        records = created_by_image[image.id]
        has_success = len(records) > 0
        if has_success:
            succeeded_images += 1
        else:
            failed_images += 1
        results.append(
            ImageGenerationResult(
                image_id=image.id,
                records=[_record_to_schema(record) for record in records],
                error=None if has_success else (errors_by_image[image.id][0] if errors_by_image[image.id] else "该图片本次生成全部失败。"),
            )
        )
    return BatchGenerationResponse(
        task_type="description",
        requested_images=len(images),
        succeeded_images=succeeded_images,
        failed_images=failed_images,
        results=results,
    )


@router.post("/questions/generate", response_model=BatchGenerationResponse)
async def generate_questions(payload: GenerateQuestionsRequest, db: Session = Depends(get_db)):
    settings = get_or_create_settings(db)
    selected_profile = resolve_model_profile(settings, payload.model_profile)
    images = db.scalars(select(Image).where(Image.id.in_(payload.image_ids))).all()
    if not images:
        raise HTTPException(status_code=404, detail="未找到任何图片。")
    if payload.mode == "prompt_image" and not payload.prompt_template:
        raise HTTPException(status_code=400, detail="按提示词和图片生成问题时必须提供 prompt_template。")
    if payload.use_structured_output and payload.count_per_image < 2:
        raise HTTPException(status_code=400, detail="Structured output 批量生成至少需要每图生成 2 条。")
    image_lookup = {image.id: image for image in images}

    planned: list[tuple[int, Path, str | None, int | None, str]] = []
    description_id_map = payload.description_id_map or {}

    for image in images:
        selected_description = None
        selected_description_id = None
        if payload.mode in {"description", "description_image"}:
            selected_description_id = description_id_map.get(image.id)
            if not selected_description_id:
                raise HTTPException(status_code=400, detail=f"图片 {image.id} 缺少 description_id。")
            description_record = db.get(DescriptionGeneration, selected_description_id)
            if not description_record:
                raise HTTPException(status_code=404, detail=f"描述记录 {selected_description_id} 不存在。")
            if description_record.image_id != image.id:
                raise HTTPException(status_code=400, detail=f"描述记录 {selected_description_id} 不属于图片 {image.id}。")
            if description_record.status != "success":
                raise HTTPException(status_code=400, detail=f"描述记录 {selected_description_id} 不是成功状态，无法用于生成问题。")
            selected_description = description_record.content
        file_path = resolve_image_path(image.stored_path)
        for _ in range(payload.count_per_image):
            prompt = payload.prompt_template or "请为这张图片生成一个适合视觉问答训练的问题。"
            planned.append((image.id, file_path, selected_description, selected_description_id, prompt))

    if payload.use_structured_output:
        grouped_planned: dict[int, tuple[Path, str | None, int | None, str, int]] = {}
        for image_id, file_path, description, description_id, prompt in planned:
            if image_id not in grouped_planned:
                grouped_planned[image_id] = (file_path, description, description_id, prompt, 0)
            current_file_path, current_description, current_description_id, current_prompt, current_count = grouped_planned[image_id]
            grouped_planned[image_id] = (
                current_file_path,
                current_description,
                current_description_id,
                current_prompt,
                current_count + 1,
            )

        async def run_one_batch(image_id: int, file_path: Path, description: str | None, prompt: str, count: int):
            try:
                contents = await generate_question_batch(
                    settings,
                    prompt,
                    file_path,
                    count=count,
                    description=description,
                    use_image=payload.mode in {"description_image", "prompt_image"},
                    model_profile=payload.model_profile,
                )
                return image_id, prompt, contents, None
            except (LLMServiceError, Exception) as exc:
                return image_id, prompt, None, str(exc)

        coroutines = [
            run_one_batch(image_id, file_path, description, prompt, count)
            for image_id, (file_path, description, _description_id, prompt, count) in grouped_planned.items()
        ]
    else:
        async def run_one(image_id: int, prompt: str, file_path: Path, description: str | None):
            try:
                return image_id, prompt, await generate_question(
                    settings,
                    prompt,
                    file_path,
                    description,
                    use_image=payload.mode in {"description_image", "prompt_image"},
                    model_profile=payload.model_profile,
                ), None
            except (LLMServiceError, Exception) as exc:
                return image_id, prompt, None, str(exc)

        coroutines = [
            run_one(image_id, prompt, file_path, description)
            for image_id, file_path, description, _description_id, prompt in planned
        ]
    outcomes = await run_limited(coroutines, payload.concurrency)

    created_by_image: dict[int, list[QuestionGeneration]] = {image.id: [] for image in images}
    errors_by_image: dict[int, list[str]] = {image.id: [] for image in images}
    description_ids_by_image = {
        image_id: description_id
        for image_id, _file_path, _description, description_id, _prompt in planned
    }

    for outcome in outcomes:
        if isinstance(outcome, Exception):
            continue
        if payload.use_structured_output:
            image_id, prompt, contents, error = outcome
            if error or contents is None:
                errors_by_image[image_id].append(error or "生成失败。")
                image = image_lookup.get(image_id)
                if image is not None:
                    db.add(
                        GenerationEvent(
                            project_id=image.project_id,
                            batch_id=image.batch_id,
                            image_id=image.id,
                            task_type="question",
                            source_record_id=description_ids_by_image.get(image_id),
                            prompt=prompt,
                            model=selected_profile.model,
                            status="failed",
                            content="",
                            error=error or "生成失败。",
                        )
                    )
                continue
            for content in contents:
                record = QuestionGeneration(
                    image_id=image_id,
                    description_id=description_ids_by_image.get(image_id),
                    prompt=prompt,
                    model=selected_profile.model,
                    status="success",
                    error="",
                    content=content,
                )
                db.add(record)
                db.flush()
                image = image_lookup.get(image_id)
                if image is not None:
                    db.add(
                        GenerationEvent(
                            project_id=image.project_id,
                            batch_id=image.batch_id,
                            image_id=image.id,
                            task_type="question",
                            source_record_id=description_ids_by_image.get(image_id),
                            prompt=prompt,
                            model=selected_profile.model,
                            status="success",
                            content=content,
                            error="",
                        )
                    )
                created_by_image[image_id].append(record)
        else:
            image_id, prompt, content, error = outcome
            if error or content is None:
                errors_by_image[image_id].append(error or "生成失败。")
                image = image_lookup.get(image_id)
                if image is not None:
                    db.add(
                        GenerationEvent(
                            project_id=image.project_id,
                            batch_id=image.batch_id,
                            image_id=image.id,
                            task_type="question",
                            source_record_id=description_ids_by_image.get(image_id),
                            prompt=prompt,
                            model=selected_profile.model,
                            status="failed",
                            content="",
                            error=error or "生成失败。",
                        )
                    )
                continue
            record = QuestionGeneration(
                image_id=image_id,
                description_id=description_ids_by_image.get(image_id),
                prompt=prompt,
                model=selected_profile.model,
                status="success",
                error="",
                content=content,
            )
            db.add(record)
            db.flush()
            image = image_lookup.get(image_id)
            if image is not None:
                db.add(
                    GenerationEvent(
                        project_id=image.project_id,
                        batch_id=image.batch_id,
                        image_id=image.id,
                        task_type="question",
                        source_record_id=description_ids_by_image.get(image_id),
                        prompt=prompt,
                        model=selected_profile.model,
                        status="success",
                        content=content,
                        error="",
                    )
                )
            created_by_image[image_id].append(record)
    db.commit()

    results: list[ImageGenerationResult] = []
    succeeded_images = 0
    failed_images = 0
    for image in images:
        records = created_by_image[image.id]
        has_success = len(records) > 0
        if has_success:
            succeeded_images += 1
        else:
            failed_images += 1
        results.append(
            ImageGenerationResult(
                image_id=image.id,
                records=[_record_to_schema(record) for record in records],
                error=None if has_success else (errors_by_image[image.id][0] if errors_by_image[image.id] else "该图片本次生成全部失败。"),
            )
        )
    return BatchGenerationResponse(
        task_type="question",
        requested_images=len(images),
        succeeded_images=succeeded_images,
        failed_images=failed_images,
        results=results,
    )
