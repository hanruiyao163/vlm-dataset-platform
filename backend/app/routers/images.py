from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import DescriptionGeneration, Image, Project, QuestionGeneration
from ..schemas import GenerationRecord, GenerationRecordCreate, GenerationRecordUpdate, ImageDetail, ImageSummary, MessageResponse, PagedImages
from ..services.files import resolve_image_path

router = APIRouter(tags=["images"])


def _image_summary(db: Session, image: Image) -> ImageSummary:
    description_count = (
        db.scalar(select(func.count(DescriptionGeneration.id)).where(DescriptionGeneration.image_id == image.id))
        or 0
    )
    question_count = (
        db.scalar(select(func.count(QuestionGeneration.id)).where(QuestionGeneration.image_id == image.id)) or 0
    )
    return ImageSummary(
        id=image.id,
        project_id=image.project_id,
        batch_id=image.batch_id,
        filename=image.filename,
        relative_path=image.relative_path,
        source_path=image.stored_path,
        width=image.width,
        height=image.height,
        created_at=image.created_at,
        description_count=description_count,
        question_count=question_count,
        preview_url=f"/api/images/{image.id}/file",
    )


@router.get("/projects/{project_id}/images", response_model=PagedImages)
def list_images(
    project_id: int,
    batch_id: int | None = None,
    has_descriptions: bool | None = None,
    has_questions: bool | None = None,
    limit: int = Query(default=24, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在。")

    base_query: Select[tuple[Image]] = select(Image).where(Image.project_id == project_id)
    if batch_id:
        base_query = base_query.where(Image.batch_id == batch_id)
    if has_descriptions is True:
        base_query = base_query.where(
            select(DescriptionGeneration.id).where(DescriptionGeneration.image_id == Image.id).exists()
        )
    if has_descriptions is False:
        base_query = base_query.where(
            ~select(DescriptionGeneration.id).where(DescriptionGeneration.image_id == Image.id).exists()
        )
    if has_questions is True:
        base_query = base_query.where(
            select(QuestionGeneration.id).where(QuestionGeneration.image_id == Image.id).exists()
        )
    if has_questions is False:
        base_query = base_query.where(
            ~select(QuestionGeneration.id).where(QuestionGeneration.image_id == Image.id).exists()
        )

    total = db.scalar(select(func.count()).select_from(base_query.subquery())) or 0
    paged_images = db.scalars(base_query.order_by(Image.filename.asc(), Image.id.asc()).limit(limit).offset(offset)).all()
    return PagedImages(
        items=[_image_summary(db, image) for image in paged_images],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/projects/{project_id}/image-ids", response_model=list[int])
def list_image_ids(
    project_id: int,
    batch_id: int | None = None,
    has_descriptions: bool | None = None,
    has_questions: bool | None = None,
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在。")

    base_query: Select[tuple[int]] = select(Image.id).where(Image.project_id == project_id)
    if batch_id:
        base_query = base_query.where(Image.batch_id == batch_id)
    if has_descriptions is True:
        base_query = base_query.where(
            select(DescriptionGeneration.id).where(DescriptionGeneration.image_id == Image.id).exists()
        )
    if has_descriptions is False:
        base_query = base_query.where(
            ~select(DescriptionGeneration.id).where(DescriptionGeneration.image_id == Image.id).exists()
        )
    if has_questions is True:
        base_query = base_query.where(
            select(QuestionGeneration.id).where(QuestionGeneration.image_id == Image.id).exists()
        )
    if has_questions is False:
        base_query = base_query.where(
            ~select(QuestionGeneration.id).where(QuestionGeneration.image_id == Image.id).exists()
        )

    return list(db.scalars(base_query.order_by(Image.filename.asc(), Image.id.asc())).all())


@router.get("/images/{image_id}", response_model=ImageDetail)
def get_image(image_id: int, db: Session = Depends(get_db)):
    image = db.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="图片不存在。")
    summary = _image_summary(db, image)
    descriptions = db.scalars(
        select(DescriptionGeneration)
        .where(DescriptionGeneration.image_id == image.id)
        .order_by(DescriptionGeneration.created_at.desc(), DescriptionGeneration.id.desc())
    ).all()
    questions = db.scalars(
        select(QuestionGeneration)
        .where(QuestionGeneration.image_id == image.id)
        .order_by(QuestionGeneration.created_at.desc(), QuestionGeneration.id.desc())
    ).all()
    return ImageDetail(
        **summary.model_dump(),
        descriptions=[
            GenerationRecord.model_validate(record, from_attributes=True) for record in descriptions
        ],
        questions=[
            GenerationRecord(
                id=record.id,
                prompt=record.prompt,
                model=record.model,
                content=record.content,
                status=record.status,
                error=record.error,
                created_at=record.created_at,
                description_id=record.description_id,
            )
            for record in questions
        ],
    )


@router.get("/images/{image_id}/file")
def get_image_file(image_id: int, db: Session = Depends(get_db)):
    image = db.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="图片不存在。")
    file_path = resolve_image_path(image.stored_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="图片文件不存在。")
    return FileResponse(file_path)


@router.patch("/descriptions/{record_id}", response_model=GenerationRecord)
def update_description_record(record_id: int, payload: GenerationRecordUpdate, db: Session = Depends(get_db)):
    record = db.get(DescriptionGeneration, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="描述记录不存在。")
    if payload.paired_question_id is not None:
        question = db.get(QuestionGeneration, payload.paired_question_id)
        if not question:
            raise HTTPException(status_code=404, detail="问题记录不存在。")
        if question.image_id != record.image_id:
            raise HTTPException(status_code=400, detail="只能绑定同一张图片下的问题。")
        if question.status != "success":
            raise HTTPException(status_code=400, detail="只能绑定成功状态的问题。")
        record.paired_question_id = payload.paired_question_id
    record.content = payload.content
    record.status = "success"
    record.error = ""
    db.add(record)
    db.commit()
    db.refresh(record)
    return GenerationRecord.model_validate(record, from_attributes=True)


@router.post("/images/{image_id}/descriptions", response_model=GenerationRecord)
def create_description_record(image_id: int, payload: GenerationRecordCreate, db: Session = Depends(get_db)):
    image = db.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="图片不存在。")
    if payload.paired_question_id is not None:
        question = db.get(QuestionGeneration, payload.paired_question_id)
        if not question:
            raise HTTPException(status_code=404, detail="问题记录不存在。")
        if question.image_id != image_id:
            raise HTTPException(status_code=400, detail="只能绑定同一张图片下的问题。")
        if question.status != "success":
            raise HTTPException(status_code=400, detail="只能绑定成功状态的问题。")
    record = DescriptionGeneration(
        image_id=image_id,
        paired_question_id=payload.paired_question_id,
        prompt="人工添加",
        model="manual",
        content=payload.content,
        status="success",
        error="",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return GenerationRecord.model_validate(record, from_attributes=True)


@router.patch("/questions/{record_id}", response_model=GenerationRecord)
def update_question_record(record_id: int, payload: GenerationRecordUpdate, db: Session = Depends(get_db)):
    record = db.get(QuestionGeneration, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="问题记录不存在。")
    record.content = payload.content
    record.status = "success"
    record.error = ""
    db.add(record)
    db.commit()
    db.refresh(record)
    return GenerationRecord(
        id=record.id,
        prompt=record.prompt,
        model=record.model,
        content=record.content,
        status=record.status,
        error=record.error,
        created_at=record.created_at,
        description_id=record.description_id,
    )


@router.post("/images/{image_id}/questions", response_model=GenerationRecord)
def create_question_record(image_id: int, payload: GenerationRecordCreate, db: Session = Depends(get_db)):
    image = db.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="图片不存在。")
    record = QuestionGeneration(
        image_id=image_id,
        prompt="人工添加",
        model="manual",
        content=payload.content,
        status="success",
        error="",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return GenerationRecord(
        id=record.id,
        prompt=record.prompt,
        model=record.model,
        content=record.content,
        status=record.status,
        error=record.error,
        created_at=record.created_at,
        description_id=record.description_id,
    )


@router.delete("/descriptions/{record_id}", response_model=MessageResponse)
def delete_description_record(record_id: int, db: Session = Depends(get_db)):
    record = db.get(DescriptionGeneration, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="描述记录不存在。")
    db.delete(record)
    db.commit()
    return MessageResponse(message="描述已删除。")


@router.delete("/questions/{record_id}", response_model=MessageResponse)
def delete_question_record(record_id: int, db: Session = Depends(get_db)):
    record = db.get(QuestionGeneration, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="问题记录不存在。")
    db.delete(record)
    db.commit()
    return MessageResponse(message="问题已删除。")
