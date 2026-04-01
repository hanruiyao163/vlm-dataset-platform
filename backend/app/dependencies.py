from sqlalchemy.orm import Session

from .db import get_db
from .models import Settings


def get_or_create_settings(db: Session) -> Settings:
    settings = db.get(Settings, 1)
    if settings is None:
        settings = Settings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings
