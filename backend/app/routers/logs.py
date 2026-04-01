from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Batch, DescriptionGeneration, GenerationEvent, Image, Project, QuestionGeneration
from ..schemas import GenerationLogEntry, PagedGenerationLogs

router = APIRouter(prefix="/logs", tags=["logs"])


def _build_source_label(
    db: Session, task_type: str, image_id: int, source_record_id: int | None
) -> str | None:
    if source_record_id is None:
        return None
    if task_type == "description":
        source_ids = db.scalars(
            select(QuestionGeneration.id)
            .where(QuestionGeneration.image_id == image_id)
            .order_by(QuestionGeneration.created_at.desc(), QuestionGeneration.id.desc())
        ).all()
        prefix = "问题"
    else:
        source_ids = db.scalars(
            select(DescriptionGeneration.id)
            .where(DescriptionGeneration.image_id == image_id)
            .order_by(DescriptionGeneration.created_at.desc(), DescriptionGeneration.id.desc())
        ).all()
        prefix = "描述"
    try:
        return f"{prefix} {source_ids.index(source_record_id) + 1}"
    except ValueError:
        return f"{prefix}记录"


@router.get("", response_model=PagedGenerationLogs)
def list_generation_logs(
    project_id: int | None = None,
    batch_id: int | None = None,
    task_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    filters = []
    if project_id is not None:
        filters.append(GenerationEvent.project_id == project_id)
    if batch_id is not None:
        filters.append(GenerationEvent.batch_id == batch_id)
    if task_type:
        filters.append(GenerationEvent.task_type == task_type)
    if status:
        filters.append(GenerationEvent.status == status)

    base_query = (
        select(
            GenerationEvent,
            Project.name,
            Batch.name,
            Image.filename,
            Image.relative_path,
        )
        .join(Project, Project.id == GenerationEvent.project_id)
        .join(Batch, Batch.id == GenerationEvent.batch_id)
        .join(Image, Image.id == GenerationEvent.image_id)
    )
    total_query = select(func.count(GenerationEvent.id))
    if filters:
        base_query = base_query.where(*filters)
        total_query = total_query.where(*filters)

    rows = db.execute(
        base_query.order_by(GenerationEvent.created_at.desc(), GenerationEvent.id.desc()).limit(limit).offset(offset)
    ).all()
    total = db.scalar(total_query) or 0

    items = [
        GenerationLogEntry(
            id=event.id,
            project_id=event.project_id,
            project_name=project_name,
            batch_id=event.batch_id,
            batch_name=batch_name,
            image_id=event.image_id,
            image_filename=image_filename,
            image_relative_path=image_relative_path,
            task_type=event.task_type,
            source_record_id=event.source_record_id,
            source_record_type="question" if event.task_type == "description" and event.source_record_id is not None else (
                "description" if event.task_type == "question" and event.source_record_id is not None else None
            ),
            source_record_label=_build_source_label(db, event.task_type, event.image_id, event.source_record_id),
            prompt=event.prompt,
            model=event.model,
            status=event.status,
            content=event.content,
            error=event.error,
            created_at=event.created_at,
        )
        for event, project_name, batch_name, image_filename, image_relative_path in rows
    ]
    return PagedGenerationLogs(items=items, total=total, limit=limit, offset=offset)
