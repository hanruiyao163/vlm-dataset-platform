import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..dependencies import get_or_create_settings
from ..schemas import MessageResponse, ModelProfileConfig, SettingsIn, SettingsOut, TestSettingsRequest
from ..services.llm import LLMServiceError, list_model_profiles, test_connection

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    settings = get_or_create_settings(db)
    return SettingsOut(
        id=settings.id,
        api_key=settings.api_key,
        base_url=settings.base_url,
        model=settings.model,
        available_models_text=settings.available_models_text,
        model_profiles=[ModelProfileConfig.model_validate(profile) for profile in list_model_profiles(settings)],
        default_description_prompt=settings.default_description_prompt,
        default_question_prompt=settings.default_question_prompt,
        default_concurrency=settings.default_concurrency,
        timeout_seconds=settings.timeout_seconds,
    )


@router.put("", response_model=SettingsOut)
def update_settings(payload: SettingsIn, db: Session = Depends(get_db)):
    settings = get_or_create_settings(db)
    payload_dict = payload.model_dump()
    model_profiles = payload_dict.pop("model_profiles", [])
    for field, value in payload_dict.items():
        setattr(settings, field, value)
    settings.model_profiles_json = json.dumps(model_profiles, ensure_ascii=False)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return get_settings(db)


@router.post("/test", response_model=MessageResponse)
async def test_settings(payload: TestSettingsRequest, db: Session = Depends(get_db)):
    settings = get_or_create_settings(db)
    try:
        message = await test_connection(settings, payload.prompt, model_profile=payload.model_profile)
    except LLMServiceError as exc:
        return MessageResponse(message=str(exc))
    except Exception as exc:  # pragma: no cover
        return MessageResponse(message=f"连接测试失败: {exc}")
    return MessageResponse(message=message)
