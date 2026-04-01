import type {
  Batch,
  BatchGenerationResponse,
  ExportResponse,
  ImageDetail,
  MessageResponse,
  ModelProfile,
  ModelSettings,
  PagedGenerationLogs,
  PagedImages,
  Project,
} from "@/lib/types";

const headers = { "Content-Type": "application/json" };

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }
  return response.json() as Promise<T>;
}

export const api = {
  getSettings: () => request<ModelSettings>("/api/settings"),
  updateSettings: (payload: Omit<ModelSettings, "id">) =>
    request<ModelSettings>("/api/settings", {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    }),
  testSettings: (prompt: string, modelProfile?: string) =>
    request<MessageResponse>("/api/settings/test", {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt, model_profile: modelProfile }),
    }),
  listProjects: () => request<Project[]>("/api/projects"),
  createProject: (payload: { name: string; note: string }) =>
    request<Project>("/api/projects", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }),
  getProject: (projectId: number) => request<Project>(`/api/projects/${projectId}`),
  updateProject: (projectId: number, payload: { note: string; default_description_prompt: string; default_question_prompt: string }) =>
    request<Project>(`/api/projects/${projectId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    }),
  deleteProject: (projectId: number) =>
    request<MessageResponse>(`/api/projects/${projectId}`, {
      method: "DELETE",
    }),
  deleteProjectImages: (projectId: number, imageIds: number[]) =>
    request<MessageResponse>(`/api/projects/${projectId}/images`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({ image_ids: imageIds }),
    }),
  listBatches: (projectId: number) => request<Batch[]>(`/api/projects/${projectId}/batches`),
  updateBatch: (
    projectId: number,
    batchId: number,
    payload: { default_description_prompt: string; default_question_prompt: string },
  ) =>
    request<Batch>(`/api/projects/${projectId}/batches/${batchId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    }),
  deleteBatch: (projectId: number, batchId: number) =>
    request<MessageResponse>(`/api/projects/${projectId}/batches/${batchId}`, {
      method: "DELETE",
    }),
  pickBatchDirectory: (projectId: number) =>
    request<{ path: string }>(`/api/projects/${projectId}/batches/pick-directory`),
  scanBatch: (projectId: number, payload: { batchName: string; sourceFolder: string }) =>
    request<Batch>(`/api/projects/${projectId}/batches/scan`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        batch_name: payload.batchName,
        source_folder: payload.sourceFolder,
      }),
    }),
  listImages: (projectId: number, params: Record<string, string | number | boolean | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") search.set(key, String(value));
    });
    return request<PagedImages>(`/api/projects/${projectId}/images?${search.toString()}`);
  },
  listImageIds: (projectId: number, params: Record<string, string | number | boolean | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") search.set(key, String(value));
    });
    return request<number[]>(`/api/projects/${projectId}/image-ids?${search.toString()}`);
  },
  listGenerationLogs: (params: Record<string, string | number | boolean | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") search.set(key, String(value));
    });
    return request<PagedGenerationLogs>(`/api/logs?${search.toString()}`);
  },
  getImage: (imageId: number) => request<ImageDetail>(`/api/images/${imageId}`),
  createDescription: (imageId: number, payload: { content: string; paired_question_id?: number }) =>
    request(`/api/images/${imageId}/descriptions`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }),
  updateDescription: (recordId: number, payload: { content: string; paired_question_id?: number }) =>
    request(`/api/descriptions/${recordId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    }),
  deleteDescription: (recordId: number) =>
    request<MessageResponse>(`/api/descriptions/${recordId}`, {
      method: "DELETE",
    }),
  createQuestion: (imageId: number, content: string) =>
    request(`/api/images/${imageId}/questions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content }),
    }),
  updateQuestion: (recordId: number, content: string) =>
    request(`/api/questions/${recordId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ content }),
    }),
  deleteQuestion: (recordId: number) =>
    request<MessageResponse>(`/api/questions/${recordId}`, {
      method: "DELETE",
    }),
  generateDescriptions: (payload: {
    image_ids: number[];
    model_profile?: string;
    mode?: "prompt" | "question_image";
    question_id_map?: Record<number, number[]>;
    prompt_template: string;
    count_per_image: number;
    concurrency: number;
    use_structured_output?: boolean;
  }) =>
    request<BatchGenerationResponse>("/api/descriptions/generate", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }),
  generateQuestions: (payload: {
    image_ids: number[];
    model_profile?: string;
    mode: "description" | "description_image" | "prompt_image";
    description_id_map?: Record<number, number>;
    prompt_template?: string;
    count_per_image: number;
    concurrency: number;
    use_structured_output?: boolean;
  }) =>
    request<BatchGenerationResponse>("/api/questions/generate", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }),
  exportShareGPT: (payload: {
    project_id: number;
    image_field: string;
    items: Array<{ image_id: number; question_id: number; answer_source: "description"; answer_id: number }>;
  }) =>
    request<ExportResponse>("/api/exports/sharegpt", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }),
};
