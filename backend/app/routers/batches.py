from __future__ import annotations

import shutil
from pathlib import Path
import tkinter as tk
from tkinter import filedialog

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import IMAGE_EXTENSIONS, UPLOAD_DIR
from ..db import get_db
from ..models import Batch, Image, Project
from ..schemas import BatchScanRequest, BatchSummary, BatchUpdate, DirectoryPickResponse, MessageResponse
from ..services.files import get_image_dimensions, sha256_file

router = APIRouter(prefix="/projects/{project_id}/batches", tags=["batches"])


@router.get("/pick-directory", response_model=DirectoryPickResponse)
def pick_directory(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在。")

    try:
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        selected = filedialog.askdirectory(title="选择要登记的图片目录")
        root.destroy()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"无法打开目录选择器：{exc}") from exc

    if not selected:
        raise HTTPException(status_code=400, detail="未选择任何目录。")

    return DirectoryPickResponse(path=Path(selected).resolve().as_posix())


@router.post("/scan", response_model=BatchSummary)
def scan_batch(project_id: int, payload: BatchScanRequest, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在。")
    source_folder = Path(payload.source_folder).expanduser()
    if not source_folder.exists():
        raise HTTPException(status_code=400, detail="源目录不存在。")
    if not source_folder.is_dir():
        raise HTTPException(status_code=400, detail="源路径不是文件夹。")

    batch = Batch(project_id=project_id, name=payload.batch_name, source_folder=str(source_folder))
    db.add(batch)
    db.commit()
    db.refresh(batch)

    image_paths = sorted(
        file_path for file_path in source_folder.rglob("*") if file_path.is_file() and file_path.suffix.lower() in IMAGE_EXTENSIONS
    )
    if not image_paths:
        db.delete(batch)
        db.commit()
        raise HTTPException(status_code=400, detail="目录下没有可识别的图片文件。")

    image_count = 0
    for file_path in image_paths:
        file_hash = sha256_file(file_path)
        relative_path = file_path.relative_to(source_folder).as_posix()
        width, height = get_image_dimensions(file_path)

        image = Image(
            project_id=project_id,
            batch_id=batch.id,
            filename=file_path.name,
            relative_path=relative_path,
            stored_path=file_path.resolve().as_posix(),
            sha256=file_hash,
            width=width,
            height=height,
        )
        db.add(image)
        image_count += 1

    db.commit()
    return BatchSummary(
        id=batch.id,
        project_id=batch.project_id,
        name=batch.name,
        source_folder=batch.source_folder,
        default_description_prompt=batch.default_description_prompt,
        default_question_prompt=batch.default_question_prompt,
        created_at=batch.created_at,
        image_count=image_count,
    )


@router.delete("/{batch_id}", response_model=MessageResponse)
def delete_batch(project_id: int, batch_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在。")
    batch = db.scalar(select(Batch).where(Batch.id == batch_id, Batch.project_id == project_id))
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在。")

    batch_dir = UPLOAD_DIR / str(project_id) / str(batch_id)
    db.delete(batch)
    db.commit()

    if batch_dir.exists():
        shutil.rmtree(batch_dir, ignore_errors=True)

    return MessageResponse(message="批次已删除。")


@router.put("/{batch_id}", response_model=BatchSummary)
def update_batch(project_id: int, batch_id: int, payload: BatchUpdate, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在。")
    batch = db.scalar(select(Batch).where(Batch.id == batch_id, Batch.project_id == project_id))
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在。")

    batch.default_description_prompt = payload.default_description_prompt
    batch.default_question_prompt = payload.default_question_prompt
    db.add(batch)
    db.commit()
    db.refresh(batch)
    image_count = db.scalar(select(func.count(Image.id)).where(Image.batch_id == batch.id)) or 0
    return BatchSummary(
        id=batch.id,
        project_id=batch.project_id,
        name=batch.name,
        source_folder=batch.source_folder,
        default_description_prompt=batch.default_description_prompt,
        default_question_prompt=batch.default_question_prompt,
        created_at=batch.created_at,
        image_count=image_count,
    )
