import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { ImageDetail } from "@/lib/types";
import { formatChinaDateTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function GenerateQuestionsDialog({
  projectId,
  imageIds,
  selectedModelProfile,
  defaultPrompt,
  defaultConcurrency,
  open,
  onOpenChange,
}: {
  projectId: number;
  imageIds: number[];
  selectedModelProfile: string;
  defaultPrompt: string;
  defaultConcurrency: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mode, setMode] = useState<"description" | "prompt_image">("description");
  const [useImageWithDescription, setUseImageWithDescription] = useState(false);
  const [promptTemplate, setPromptTemplate] = useState(defaultPrompt);
  const [countPerImage, setCountPerImage] = useState(1);
  const [concurrency, setConcurrency] = useState(defaultConcurrency || 3);
  const [useStructuredOutput, setUseStructuredOutput] = useState(false);
  const [selectedDescriptionMap, setSelectedDescriptionMap] = useState<Record<number, number>>({});
  const queryClient = useQueryClient();
  const { push } = useToast();

  useEffect(() => {
    if (!open) return;
    setMode("description");
    setUseImageWithDescription(false);
    setPromptTemplate(defaultPrompt);
    setConcurrency(defaultConcurrency || 3);
    setCountPerImage(1);
    setUseStructuredOutput(false);
    setSelectedDescriptionMap({});
  }, [defaultConcurrency, defaultPrompt, open]);

  const imageDetailQueries = useQuery({
    queryKey: ["question-image-details", imageIds],
    queryFn: async () => Promise.all(imageIds.map((imageId) => api.getImage(imageId))),
    enabled: open && imageIds.length > 0,
  });

  const availableDescriptions = useMemo(() => {
    const mapping: Record<number, ImageDetail["descriptions"]> = {};
    (imageDetailQueries.data ?? []).forEach((item: ImageDetail) => {
      mapping[item.id] = item.descriptions.filter((record) => record.status === "success");
    });
    return mapping;
  }, [imageDetailQueries.data]);

  const defaultDescriptionIdMap = useMemo(() => {
    const mapping: Record<number, number> = {};
    (imageDetailQueries.data ?? []).forEach((item: ImageDetail) => {
      const latest = item.descriptions.find((record) => record.status === "success");
      if (latest) mapping[item.id] = latest.id;
    });
    return mapping;
  }, [imageDetailQueries.data]);

  useEffect(() => {
    if (!open || imageDetailQueries.isLoading) return;
    setSelectedDescriptionMap(defaultDescriptionIdMap);
  }, [defaultDescriptionIdMap, imageDetailQueries.isLoading, open]);

  const mutation = useMutation({
    mutationFn: () =>
      api.generateQuestions({
        image_ids: imageIds,
        model_profile: selectedModelProfile,
        mode: mode === "description" && useImageWithDescription ? "description_image" : mode,
        description_id_map: mode !== "prompt_image" ? selectedDescriptionMap : undefined,
        prompt_template: promptTemplate,
        count_per_image: countPerImage,
        concurrency,
        use_structured_output: useStructuredOutput,
      }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["images", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["export-image-list", projectId] });
      imageIds.forEach((imageId) => queryClient.invalidateQueries({ queryKey: ["image", imageId] }));
      if (useStructuredOutput && response.failed_images > 0) {
        const firstError = response.results.find((item) => item.error)?.error ?? "Structured output 返回异常，请检查模型兼容性或关闭该选项后重试。";
        push("Structured Output 生成失败", firstError);
      }
      push("问题生成完成", `成功 ${response.succeeded_images} 张，失败 ${response.failed_images} 张。`);
      onOpenChange(false);
    },
    onError: (error: Error) => push("问题生成失败", error.message),
  });

  const missingDescriptionCount = imageIds.filter((id) => !selectedDescriptionMap[id]).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批量生成问题</DialogTitle>
          <DialogDescription>可以基于现有描述生成，也可以直接基于提示词和图片生成。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-[20px] border border-border/70 bg-secondary/35 px-4 py-3 text-sm text-muted-foreground">
            当前使用模型：{selectedModelProfile || "未选择模型"}
          </div>
          <div className="space-y-2">
            <Label>生成模式</Label>
            <Select value={mode} onValueChange={(value: "description" | "prompt_image") => setMode(value)}>
              <SelectTrigger>
                <SelectValue placeholder="选择生成模式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="description">基于描述</SelectItem>
                <SelectItem value="prompt_image">基于提示词和图片</SelectItem>
              </SelectContent>
            </Select>
            {mode !== "prompt_image" ? <p className="text-sm text-muted-foreground">当前选中图片中有 {missingDescriptionCount} 张缺少成功描述。</p> : null}
          </div>
          {mode === "description" ? (
            <div className="rounded-[20px] border border-border/70 bg-white/60 px-4 py-3">
              <Label className="mb-3 block">描述生成问题时的参考范围</Label>
              <div className="flex flex-wrap gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="question-description-mode"
                    className="h-4 w-4 accent-primary"
                    checked={!useImageWithDescription}
                    onChange={() => setUseImageWithDescription(false)}
                  />
                  <span>仅根据描述</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="question-description-mode"
                    className="h-4 w-4 accent-primary"
                    checked={useImageWithDescription}
                    onChange={() => setUseImageWithDescription(true)}
                  />
                  <span>同时结合描述和图片</span>
                </label>
              </div>
            </div>
          ) : null}
          {mode !== "prompt_image" ? (
            <div className="space-y-2">
              <Label>每张图片使用的描述</Label>
              <div className="max-h-[240px] space-y-3 overflow-y-auto rounded-[20px] border border-border/70 bg-white/60 p-3">
                {(imageDetailQueries.data ?? []).map((item: ImageDetail) => {
                  const descriptions = availableDescriptions[item.id] ?? [];
                  return (
                    <div key={item.id} className="grid gap-2 rounded-2xl border border-border/60 bg-background/80 p-3 md:grid-cols-[minmax(0,1fr)_280px] md:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.filename}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.relative_path}</p>
                      </div>
                      <Select
                        value={selectedDescriptionMap[item.id] ? String(selectedDescriptionMap[item.id]) : undefined}
                        onValueChange={(value) =>
                          setSelectedDescriptionMap((current) => ({
                            ...current,
                            [item.id]: Number(value),
                          }))
                        }
                        disabled={descriptions.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={descriptions.length === 0 ? "没有可用描述" : "选择描述"} />
                        </SelectTrigger>
                        <SelectContent>
                          {descriptions.map((record, index) => (
                            <SelectItem key={record.id} value={String(record.id)}>
                              {`描述 ${index + 1} · ${formatChinaDateTime(record.created_at)}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>问题提示词</Label>
            <Textarea value={promptTemplate} onChange={(event) => setPromptTemplate(event.target.value)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>每图生成条数</Label>
              <Input type="number" min={1} max={10} value={countPerImage} onChange={(event) => setCountPerImage(Number(event.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>并发数</Label>
              <Input type="number" min={1} max={20} value={concurrency} onChange={(event) => setConcurrency(Number(event.target.value))} />
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-[20px] border border-border/70 bg-white/60 px-4 py-3">
            <Checkbox
              id="structured-question"
              checked={useStructuredOutput}
              onCheckedChange={(checked) => setUseStructuredOutput(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="structured-question">Structured Output 批量生成</Label>
              <p className="text-sm text-muted-foreground">
                开启后，每张图只请求一次并按 JSON 结构返回多条问题。适合每图生成 2 条及以上。
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              disabled={mutation.isPending || imageIds.length === 0 || !selectedModelProfile || (mode !== "prompt_image" && missingDescriptionCount > 0)}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "生成中..." : `为 ${imageIds.length} 张图片生成问题`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
