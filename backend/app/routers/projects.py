from sqlalchemy import func, select
from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_db
from ..models import Batch, DescriptionGeneration, Image, Project, QuestionGeneration
from ..schemas import BatchSummary, ImageDeleteRequest, MessageResponse, ProjectCreate, ProjectSummary, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


def _project_summary(db: Session, project: Project) -> ProjectSummary:
    batch_count = db.scalar(select(func.count(Batch.id)).where(Batch.project_id == project.id)) or 0
    image_count = db.scalar(select(func.count(Image.id)).where(Image.project_id == project.id)) or 0
    description_count = (
        db.scalar(
            select(func.count(DescriptionGeneration.id))
            .join(Image, DescriptionGeneration.image_id == Image.id)
            .where(Image.project_id == project.id)
        )
        or 0
    )
    question_count = (
        db.scalar(
            select(func.count(QuestionGeneration.id))
            .join(Image, QuestionGeneration.image_id == Image.id)
            .where(Image.project_id == project.id)
        )
        or 0
    )
    return ProjectSummary(
        id=project.id,
        name=project.name,
        note=project.note,
        default_description_prompt=project.default_description_prompt,
        default_question_prompt=project.default_question_prompt,
        created_at=project.created_at,
        batch_count=batch_count,
        image_count=image_count,
        description_count=description_count,
        question_count=question_count,
    )


@router.get("", response_model=list[ProjectSummary])
def list_projects(db: Session = Depends(get_db)):
    projects = db.scalars(select(Project).order_by(Project.created_at.desc())).all()
    return [_project_summary(db, project) for project in projects]


@router.post("", response_model=ProjectSummary)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(Project).where(Project.name == payload.name))
    if existing:
        raise HTTPException(status_code=400, detail="项目名称已存在。")
    project = Project(name=payload.name, note=payload.note)
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_summary(db, project)


@router.put("/{project_id}", response_model=ProjectSummary)
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在。")
    project.note = payload.note
    project.default_description_prompt = payload.default_description_prompt
    project.default_question_prompt = payload.default_question_prompt
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_summary(db, project)


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在。")
    db.delete(project)
    db.commit()
    return {"message": "项目已删除。"}


@router.get("/{project_id}", response_model=ProjectSummary)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在。")
    return _project_summary(db, project)


@router.get("/{project_id}/batches", response_model=list[BatchSummary])
def list_project_batches(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在。")
    batches = db.scalars(
        select(Batch).where(Batch.project_id == project_id).order_by(Batch.created_at.desc())
    ).all()
    items = []
    for batch in batches:
        image_count = db.scalar(select(func.count(Image.id)).where(Image.batch_id == batch.id)) or 0
        items.append(
            BatchSummary(
                id=batch.id,
                project_id=batch.project_id,
                name=batch.name,
                source_folder=batch.source_folder,
                default_description_prompt=batch.default_description_prompt,
                default_question_prompt=batch.default_question_prompt,
                created_at=batch.created_at,
                image_count=image_count,
            )
        )
    return items


@router.delete("/{project_id}/images", response_model=MessageResponse)
def delete_project_images(project_id: int, payload: ImageDeleteRequest, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在。")

    images = db.scalars(
        select(Image).where(Image.project_id == project_id, Image.id.in_(payload.image_ids))
    ).all()
    if not images:
        raise HTTPException(status_code=404, detail="未找到任何可删除图片。")

    found_ids = {image.id for image in images}
    missing_ids = [image_id for image_id in payload.image_ids if image_id not in found_ids]
    if missing_ids:
        raise HTTPException(status_code=400, detail=f"以下图片不属于当前项目：{', '.join(map(str, missing_ids))}")

    deleted_count = len(images)
    for image in images:
        db.delete(image)
    db.commit()
    return MessageResponse(message=f"已删除 {deleted_count} 张图片索引。")
