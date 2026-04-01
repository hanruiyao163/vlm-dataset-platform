from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import EXPORT_DIR
from ..db import get_db
from ..models import DescriptionGeneration, Image, Project, QuestionGeneration
from ..schemas import ExportShareGPTRequest, ExportShareGPTResponse

router = APIRouter(prefix="/exports", tags=["exports"])


@router.post("/sharegpt", response_model=ExportShareGPTResponse)
def export_sharegpt(payload: ExportShareGPTRequest, db: Session = Depends(get_db)):
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
        rows.append(
            {
                payload.image_field: image.relative_path,
                "conversations": [
                    {"from": "human", "value": question.content},
                    {"from": "assistant", "value": answer.content},
                ],
            }
        )

    if not rows:
        raise HTTPException(status_code=400, detail="没有可导出的有效样本。")

    project_dir = EXPORT_DIR / str(project.id)
    project_dir.mkdir(parents=True, exist_ok=True)
    filename = f"sharegpt-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    output_path = project_dir / filename
    output_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    return ExportShareGPTResponse(
        filename=filename,
        path=str(Path(output_path).relative_to(EXPORT_DIR.parent).as_posix()),
        item_count=len(rows),
    )
