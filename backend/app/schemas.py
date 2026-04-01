from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ModelProfileConfig(BaseModel):
    name: str
    base_url: str
    api_key: str
    model: str


class SettingsIn(BaseModel):
    api_key: str = ""
    base_url: str = ""
    model: str = ""
    available_models_text: str = ""
    model_profiles: list["ModelProfileConfig"] = []
    default_description_prompt: str = ""
    default_question_prompt: str = ""
    default_concurrency: int = 3
    timeout_seconds: int = 60


class SettingsOut(SettingsIn):
    id: int


class TestSettingsRequest(BaseModel):
    prompt: str = "Return OK"
    model_profile: str | None = None


class ProjectCreate(BaseModel):
    name: str
    note: str = ""


class ProjectUpdate(BaseModel):
    note: str = ""
    default_description_prompt: str = ""
    default_question_prompt: str = ""


class ProjectSummary(BaseModel):
    id: int
    name: str
    note: str
    default_description_prompt: str
    default_question_prompt: str
    created_at: datetime
    batch_count: int
    image_count: int
    description_count: int
    question_count: int


class BatchSummary(BaseModel):
    id: int
    project_id: int
    name: str
    source_folder: str
    default_description_prompt: str
    default_question_prompt: str
    created_at: datetime
    image_count: int


class BatchUpdate(BaseModel):
    default_description_prompt: str = ""
    default_question_prompt: str = ""


class BatchScanRequest(BaseModel):
    batch_name: str
    source_folder: str


class GenerationRecord(BaseModel):
    id: int
    prompt: str
    model: str
    content: str
    status: str
    error: str
    created_at: datetime
    description_id: int | None = None
    paired_question_id: int | None = None


class GenerationRecordUpdate(BaseModel):
    content: str
    paired_question_id: int | None = None


class GenerationRecordCreate(BaseModel):
    content: str
    paired_question_id: int | None = None


class ImageSummary(BaseModel):
    id: int
    project_id: int
    batch_id: int
    filename: str
    relative_path: str
    source_path: str
    width: int
    height: int
    created_at: datetime
    description_count: int
    question_count: int
    preview_url: str


class ImageDetail(ImageSummary):
    descriptions: list[GenerationRecord]
    questions: list[GenerationRecord]


class PagedImages(BaseModel):
    items: list[ImageSummary]
    total: int
    limit: int
    offset: int


class GenerationLogEntry(BaseModel):
    id: int
    project_id: int
    project_name: str
    batch_id: int
    batch_name: str
    image_id: int
    image_filename: str
    image_relative_path: str
    task_type: Literal["description", "question"]
    source_record_id: int | None = None
    source_record_type: Literal["question", "description"] | None = None
    source_record_label: str | None = None
    prompt: str
    model: str
    status: str
    content: str
    error: str
    created_at: datetime


class PagedGenerationLogs(BaseModel):
    items: list[GenerationLogEntry]
    total: int
    limit: int
    offset: int


class GenerateDescriptionsRequest(BaseModel):
    image_ids: list[int] = Field(min_length=1)
    model_profile: str | None = None
    mode: Literal["prompt", "question_image"] = "prompt"
    question_id_map: dict[int, list[int]] | None = None
    prompt_template: str
    count_per_image: int = Field(default=1, ge=1, le=10)
    concurrency: int = Field(default=3, ge=1, le=20)
    use_structured_output: bool = False


class GenerateQuestionsRequest(BaseModel):
    image_ids: list[int] = Field(min_length=1)
    model_profile: str | None = None
    mode: Literal["description", "description_image", "prompt_image"]
    description_id_map: dict[int, int] | None = None
    prompt_template: str | None = None
    count_per_image: int = Field(default=1, ge=1, le=10)
    concurrency: int = Field(default=3, ge=1, le=20)
    use_structured_output: bool = False


class ImageGenerationResult(BaseModel):
    image_id: int
    records: list[GenerationRecord]
    error: str | None = None


class BatchGenerationResponse(BaseModel):
    task_type: Literal["description", "question"]
    requested_images: int
    succeeded_images: int
    failed_images: int
    results: list[ImageGenerationResult]


class ExportItem(BaseModel):
    image_id: int
    question_id: int
    answer_source: Literal["description"]
    answer_id: int


class ExportShareGPTRequest(BaseModel):
    project_id: int
    image_field: str = "image"
    items: list[ExportItem]


class ExportShareGPTResponse(BaseModel):
    filename: str
    path: str
    item_count: int


class MessageResponse(BaseModel):
    message: str


class DirectoryPickResponse(BaseModel):
    path: str
