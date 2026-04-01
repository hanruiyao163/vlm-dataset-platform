export type ModelProfile = {
  name: string;
  base_url: string;
  api_key: string;
  model: string;
};

export type ModelSettings = {
  id: number;
  api_key: string;
  base_url: string;
  model: string;
  available_models_text: string;
  model_profiles: ModelProfile[];
  default_description_prompt: string;
  default_question_prompt: string;
  default_concurrency: number;
  timeout_seconds: number;
};

export type MessageResponse = {
  message: string;
};

export type Project = {
  id: number;
  name: string;
  note: string;
  default_description_prompt: string;
  default_question_prompt: string;
  created_at: string;
  batch_count: number;
  image_count: number;
  description_count: number;
  question_count: number;
};

export type Batch = {
  id: number;
  project_id: number;
  name: string;
  source_folder: string;
  default_description_prompt: string;
  default_question_prompt: string;
  created_at: string;
  image_count: number;
};

export type GenerationRecord = {
  id: number;
  prompt: string;
  model: string;
  content: string;
  status: string;
  error: string;
  created_at: string;
  description_id?: number | null;
  paired_question_id?: number | null;
};

export type ImageItem = {
  id: number;
  project_id: number;
  batch_id: number;
  filename: string;
  relative_path: string;
  source_path: string;
  width: number;
  height: number;
  created_at: string;
  description_count: number;
  question_count: number;
  preview_url: string;
};

export type ImageDetail = ImageItem & {
  descriptions: GenerationRecord[];
  questions: GenerationRecord[];
};

export type PagedImages = {
  items: ImageItem[];
  total: number;
  limit: number;
  offset: number;
};

export type BatchGenerationResponse = {
  task_type: "description" | "question";
  requested_images: number;
  succeeded_images: number;
  failed_images: number;
  results: Array<{
    image_id: number;
    records: GenerationRecord[];
    error?: string | null;
  }>;
};

export type ExportResponse = {
  filename: string;
  path: string;
  item_count: number;
};

export type GenerationLogItem = {
  id: number;
  project_id: number;
  project_name: string;
  batch_id: number;
  batch_name: string;
  image_id: number;
  image_filename: string;
  image_relative_path: string;
  task_type: "description" | "question";
  source_record_id?: number | null;
  source_record_type?: "question" | "description" | null;
  source_record_label?: string | null;
  prompt: string;
  model: string;
  status: string;
  content: string;
  error: string;
  created_at: string;
};

export type PagedGenerationLogs = {
  items: GenerationLogItem[];
  total: number;
  limit: number;
  offset: number;
};
