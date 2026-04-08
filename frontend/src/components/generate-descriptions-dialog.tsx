import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { appToast } from "@/lib/toast";
import type { ImageDetail } from "@/lib/types";
import { formatChinaDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function GenerateDescriptionsDialog({
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
  const [mode, setMode] = useState<"prompt" | "question_image">("prompt");
  const [promptTemplate, setPromptTemplate] = useState(defaultPrompt);
  const [countPerImage, setCountPerImage] = useState(1);
  const [concurrency, setConcurrency] = useState(defaultConcurrency || 3);
  const [useStructuredOutput, setUseStructuredOutput] = useState(false);
  const [selectedQuestionMap, setSelectedQuestionMap] = useState<Record<number, number[]>>({});
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setMode("prompt");
    setPromptTemplate(defaultPrompt);
    setConcurrency(defaultConcurrency || 3);
    setCountPerImage(1);
    setUseStructuredOutput(false);
    setSelectedQuestionMap({});
  }, [defaultConcurrency, defaultPrompt, open]);

  const imageDetailQueries = useQuery({
    queryKey: ["description-image-details", imageIds],
    queryFn: async () => Promise.all(imageIds.map((imageId) => api.getImage(imageId))),
    enabled: open && imageIds.length > 0,
  });

  const availableQuestions = useMemo(() => {
    const mapping: Record<number, ImageDetail["questions"]> = {};
    (imageDetailQueries.data ?? []).forEach((item: ImageDetail) => {
      mapping[item.id] = item.questions.filter((record) => record.status === "success");
    });
    return mapping;
  }, [imageDetailQueries.data]);

  const defaultQuestionIdMap = useMemo(() => {
    const mapping: Record<number, number[]> = {};
    (imageDetailQueries.data ?? []).forEach((item: ImageDetail) => {
      const latest = item.questions.find((record) => record.status === "success");
      if (latest) mapping[item.id] = [latest.id];
    });
    return mapping;
  }, [imageDetailQueries.data]);

  useEffect(() => {
    if (!open || imageDetailQueries.isLoading) return;
    setSelectedQuestionMap(defaultQuestionIdMap);
  }, [defaultQuestionIdMap, imageDetailQueries.isLoading, open]);

  const mutation = useMutation({
    mutationFn: () =>
      api.generateDescriptions({
        image_ids: imageIds,
        model_profile: selectedModelProfile,
        mode,
        question_id_map: mode === "question_image" ? selectedQuestionMap : undefined,
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
        appToast.error("Structured Output 生成失败", firstError);
      }
      appToast.success("描述生成完成", `成功 ${response.succeeded_images} 张，失败 ${response.failed_images} 张。`);
      onOpenChange(false);
    },
    onError: (error: Error) => appToast.error("描述生成失败", error.message),
  });

  const missingQuestionCount = imageIds.filter((id) => !(selectedQuestionMap[id]?.length > 0)).length;
  const structuredOutputHint =
    mode === "question_image"
      ? "开启后，每个已选问题只请求一次，并按 JSON 结构返回多条配对描述。适合每个问题生成 2 条及以上。"
      : "开启后，每张图只请求一次并按 JSON 结构返回多条描述。适合每图生成 2 条及以上。";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[calc(100%-2rem)] lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>批量生成图片描述</DialogTitle>
          <DialogDescription>对当前选择的图片并发生成描述，并保留所有历史记录。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-[20px] border border-border/50 bg-secondary/35 px-4 py-3 text-sm text-muted-foreground">
            当前使用模型：{selectedModelProfile || "未选择模型"}
          </div>
          <div className="space-y-2">
            <Label>生成模式</Label>
            <Select value={mode} onValueChange={(value: "prompt" | "question_image") => setMode(value)}>
              <SelectTrigger>
                <SelectValue placeholder="选择生成模式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prompt">基于提示词和图片</SelectItem>
                <SelectItem value="question_image">基于问题和图片</SelectItem>
              </SelectContent>
            </Select>
            {mode === "question_image" ? <p className="text-sm text-muted-foreground">当前选中图片中有 {missingQuestionCount} 张缺少成功问题。</p> : null}
          </div>
          {mode === "question_image" ? (
            <div className="space-y-2">
              <Label>每张图片使用的问题</Label>
              <div className="max-h-[240px] space-y-3 overflow-y-auto rounded-[20px] border border-border/50 bg-white/65 p-3">
                {(imageDetailQueries.data ?? []).map((item: ImageDetail) => {
                  const questions = availableQuestions[item.id] ?? [];
                  const selectedQuestionIds = selectedQuestionMap[item.id] ?? [];
                  return (
                    <div key={item.id} className="grid gap-3 rounded-2xl border border-border/60 bg-background/80 p-3 md:grid-cols-[minmax(0,1fr)_340px]">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.filename}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.relative_path}</p>
                      </div>
                      <div className="space-y-2 rounded-xl border border-border/50 bg-white/75 p-3">
                        <p className="text-xs text-muted-foreground">
                          {questions.length === 0
                            ? "没有可用问题"
                            : `已选择 ${selectedQuestionIds.length} 条问题，每条问题都会生成 ${countPerImage} 条配对描述。`}
                        </p>
                        <div className="max-h-[152px] space-y-2 overflow-y-auto pr-1">
                          {questions.map((record, index) => {
                            const checked = selectedQuestionIds.includes(record.id);
                            return (
                              <label key={record.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/50 bg-background/80 px-3 py-2 text-sm">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) =>
                                    setSelectedQuestionMap((current) => {
                                      const currentIds = current[item.id] ?? [];
                                      const nextIds = value === true
                                        ? Array.from(new Set([...currentIds, record.id]))
                                        : currentIds.filter((questionId) => questionId !== record.id);
                                      return { ...current, [item.id]: nextIds };
                                    })
                                  }
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium">{`问题 ${index + 1} · ${formatChinaDateTime(record.created_at)}`}</span>
                                  <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">{record.content}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground">
                这里选择的问题会和本次生成出的描述一一绑定为 QA 对，后续导出时不会再和其他问题交叉匹配。
              </p>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>提示词模板</Label>
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
          <div className="flex items-start gap-3 rounded-[20px] border border-border/50 bg-white/65 px-4 py-3">
            <Checkbox
              id="structured-description"
              checked={useStructuredOutput}
              onCheckedChange={(checked) => setUseStructuredOutput(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="structured-description">Structured Output 批量生成</Label>
              <p className="text-sm text-muted-foreground">{structuredOutputHint}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              disabled={
                mutation.isPending ||
                imageIds.length === 0 ||
                !selectedModelProfile ||
                (mode === "question_image" && missingQuestionCount > 0)
              }
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "生成中..." : `为 ${imageIds.length} 张图片生成描述`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
