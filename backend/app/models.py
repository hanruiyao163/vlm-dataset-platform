from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), nullable=False
    )


class Settings(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    api_key: Mapped[str] = mapped_column(String(500), default="")
    base_url: Mapped[str] = mapped_column(String(500), default="")
    model: Mapped[str] = mapped_column(String(200), default="")
    available_models_text: Mapped[str] = mapped_column(Text, default="")
    model_profiles_json: Mapped[str] = mapped_column(Text, default="[]")
    default_description_prompt: Mapped[str] = mapped_column(Text, default="")
    default_question_prompt: Mapped[str] = mapped_column(Text, default="")
    default_concurrency: Mapped[int] = mapped_column(Integer, default=3)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=60)


class Project(TimestampMixin, Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    note: Mapped[str] = mapped_column(Text, default="")
    default_description_prompt: Mapped[str] = mapped_column(Text, default="")
    default_question_prompt: Mapped[str] = mapped_column(Text, default="")

    batches: Mapped[list["Batch"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    images: Mapped[list["Image"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class Batch(TimestampMixin, Base):
    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    source_folder: Mapped[str] = mapped_column(String(500), default="")
    default_description_prompt: Mapped[str] = mapped_column(Text, default="")
    default_question_prompt: Mapped[str] = mapped_column(Text, default="")

    project: Mapped["Project"] = relationship(back_populates="batches")
    images: Mapped[list["Image"]] = relationship(
        back_populates="batch", cascade="all, delete-orphan"
    )


class Image(TimestampMixin, Base):
    __tablename__ = "images"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), index=True)
    filename: Mapped[str] = mapped_column(String(300), nullable=False)
    relative_path: Mapped[str] = mapped_column(String(600), nullable=False)
    stored_path: Mapped[str] = mapped_column(String(600), nullable=False, unique=True)
    sha256: Mapped[str] = mapped_column(String(128), index=True)
    width: Mapped[int] = mapped_column(Integer, default=0)
    height: Mapped[int] = mapped_column(Integer, default=0)

    project: Mapped["Project"] = relationship(back_populates="images")
    batch: Mapped["Batch"] = relationship(back_populates="images")
    descriptions: Mapped[list["DescriptionGeneration"]] = relationship(
        back_populates="image", cascade="all, delete-orphan"
    )
    questions: Mapped[list["QuestionGeneration"]] = relationship(
        back_populates="image", cascade="all, delete-orphan"
    )
    generation_events: Mapped[list["GenerationEvent"]] = relationship(
        back_populates="image", cascade="all, delete-orphan"
    )


class DescriptionGeneration(TimestampMixin, Base):
    __tablename__ = "description_generations"

    id: Mapped[int] = mapped_column(primary_key=True)
    image_id: Mapped[int] = mapped_column(ForeignKey("images.id"), index=True)
    paired_question_id: Mapped[int | None] = mapped_column(
        ForeignKey("question_generations.id"), nullable=True
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(String(200), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="pending")
    error: Mapped[str] = mapped_column(Text, default="")

    image: Mapped["Image"] = relationship(back_populates="descriptions")
    question: Mapped["QuestionGeneration | None"] = relationship(
        foreign_keys=lambda: [DescriptionGeneration.paired_question_id]
    )


class QuestionGeneration(TimestampMixin, Base):
    __tablename__ = "question_generations"

    id: Mapped[int] = mapped_column(primary_key=True)
    image_id: Mapped[int] = mapped_column(ForeignKey("images.id"), index=True)
    description_id: Mapped[int | None] = mapped_column(
        ForeignKey("description_generations.id"), nullable=True
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(String(200), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="pending")
    error: Mapped[str] = mapped_column(Text, default="")

    image: Mapped["Image"] = relationship(back_populates="questions")
    description: Mapped["DescriptionGeneration | None"] = relationship(
        foreign_keys=lambda: [QuestionGeneration.description_id]
    )


class GenerationEvent(TimestampMixin, Base):
    __tablename__ = "generation_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), index=True)
    image_id: Mapped[int] = mapped_column(ForeignKey("images.id"), index=True)
    task_type: Mapped[str] = mapped_column(String(30), index=True)
    source_record_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prompt: Mapped[str] = mapped_column(Text, default="")
    model: Mapped[str] = mapped_column(String(200), default="")
    status: Mapped[str] = mapped_column(String(30), index=True)
    content: Mapped[str] = mapped_column(Text, default="")
    error: Mapped[str] = mapped_column(Text, default="")

    project: Mapped["Project"] = relationship()
    batch: Mapped["Batch"] = relationship()
    image: Mapped["Image"] = relationship(back_populates="generation_events")
