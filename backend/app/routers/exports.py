from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import EXPORT_DIR
from ..db import get_db
from ..models import DescriptionGeneration, Image, Project, QuestionGeneration
from ..schemas import ExportJsonRequest, ExportJsonResponse

router = APIRouter(prefix="/exports", tags=["exports"])


def build_export_image_path(
    source_path: str,
    relative_path: str,
    image_path_prefix: str,
    trimmed_parent_levels: int,
) -> str:
    normalized_source_path = source_path.replace("\\", "/")
    source_parts = [part for part in normalized_source_path.split("/") if part]
    trimmed_parts = source_parts[trimmed_parent_levels:]
    fallback_path = source_parts[-1] if source_parts else relative_path.replace("\\", "/")
    normalized_relative_path = "/".join(part for part in trimmed_parts if part) or fallback_path
    normalized_prefix = image_path_prefix.replace("\\", "/").rstrip("/")
    return f"{normalized_prefix}/{normalized_relative_path}" if normalized_prefix else normalized_relative_path


@router.post("/json", response_model=ExportJsonResponse)
def export_json(payload: ExportJsonRequest, db: Session = Depends(get_db)):
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在。")

    rows = []
    for item in payload.items:
        image = db.get(Image, item.image_id)
        question = db.get(QuestionGeneration, item.question_id)
        answer = db.get(DescriptionGeneration, item.answer_id)
        if not image or not question or not answer:
            continue

        final_path = build_export_image_path(
            source_path=image.source_path,
            relative_path=image.relative_path,
            image_path_prefix=payload.image_path_prefix,
            trimmed_parent_levels=payload.trimmed_parent_levels,
        )

        rows.append(
            {
                "messages": [
                    {"role": "user", "content": f"{question.content}<image>"},
                    {"role": "assistant", "content": answer.content},
                ],
                "images": [final_path],
            }
        )

    if not rows:
        raise HTTPException(status_code=400, detail="没有可导出的有效样本。")

    project_dir = EXPORT_DIR / str(project.id)
    project_dir.mkdir(parents=True, exist_ok=True)
    filename = f"dataset-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    output_path = project_dir / filename
    output_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    return ExportJsonResponse(
        filename=filename,
        path=str(Path(output_path).relative_to(EXPORT_DIR.parent).as_posix()),
        item_count=len(rows),
    )
