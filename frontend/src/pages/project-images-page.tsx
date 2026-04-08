import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";

import { api } from "@/lib/api";
import { GenerateDescriptionsDialog } from "@/components/generate-descriptions-dialog";
import { GenerateQuestionsDialog } from "@/components/generate-questions-dialog";
import { ImageGrid } from "@/components/image-grid";
import { ImagePreviewDrawer } from "@/components/image-preview-drawer";
import { PageHeader } from "@/components/page-header";
import { appToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function ProjectImagesPage({
  projectId,
  search,
}: {
  projectId: number;
  search: { batchId?: string; hasDescriptions?: string; hasQuestions?: string; offset?: number; };
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const modelStorageKey = `project-images:selected-model:${projectId}`;
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [previewImageId, setPreviewImageId] = useState<number | null>(null);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [descriptionPrompt, setDescriptionPrompt] = useState("");
  const [questionPrompt, setQuestionPrompt] = useState("");

  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const projectQuery = useQuery({ queryKey: ["project", projectId], queryFn: () => api.getProject(projectId) });
  const batchesQuery = useQuery({ queryKey: ["batches", projectId], queryFn: () => api.listBatches(projectId) });
  const allImageIdsQuery = useQuery({
    queryKey: ["image-ids", projectId, search.batchId, search.hasDescriptions, search.hasQuestions],
    queryFn: () =>
      api.listImageIds(projectId, {
        batch_id: search.batchId ? Number(search.batchId) : undefined,
        has_descriptions: search.hasDescriptions === "yes" ? true : search.hasDescriptions === "no" ? false : undefined,
        has_questions: search.hasQuestions === "yes" ? true : search.hasQuestions === "no" ? false : undefined,
      }),
  });
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const imagesQuery = useInfiniteQuery({
    initialPageParam: 0,
    queryKey: ["images", projectId, search.batchId, search.hasDescriptions, search.hasQuestions],
    queryFn: ({ pageParam }) =>
      api.listImages(projectId, {
        batch_id: search.batchId ? Number(search.batchId) : undefined,
        has_descriptions: search.hasDescriptions === "yes" ? true : search.hasDescriptions === "no" ? false : undefined,
        has_questions: search.hasQuestions === "yes" ? true : search.hasQuestions === "no" ? false : undefined,
        limit: 24,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
  });

  const imageItems = useMemo(() => imagesQuery.data?.pages.flatMap((page) => page.items) ?? [], [imagesQuery.data?.pages]);
  const totalImages = imagesQuery.data?.pages[0]?.total ?? 0;
  const activeBatch = useMemo(
    () => (search.batchId ? (batchesQuery.data ?? []).find((batch) => batch.id === Number(search.batchId)) : undefined),
    [batchesQuery.data, search.batchId],
  );
  const modelProfiles = settingsQuery.data?.model_profiles ?? [];
  const [selectedModelProfile, setSelectedModelProfile] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(modelStorageKey) ?? "";
  });
  const resolvedSelectedModelProfile = selectedModelProfile || settingsQuery.data?.model || modelProfiles[0]?.name || "";
  const activeModelProfile = modelProfiles.find((profile) => profile.name === resolvedSelectedModelProfile);
  const saveProjectPromptMutation = useMutation({
    mutationFn: () =>
      api.updateProject(projectId, {
        note: projectQuery.data?.note || "",
        default_description_prompt: descriptionPrompt,
        default_question_prompt: questionPrompt,
      }),
    onSuccess: (project) => {
      queryClient.setQueryData(["project", projectId], project);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setPromptEditorOpen(false);
      appToast.success("项目提示词已保存");
    },
    onError: (error: Error) => appToast.error("保存失败", error.message),
  });
  const saveBatchPromptMutation = useMutation({
    mutationFn: () =>
      activeBatch
        ? api.updateBatch(projectId, activeBatch.id, {
          default_description_prompt: descriptionPrompt,
          default_question_prompt: questionPrompt,
        })
        : Promise.reject(new Error("当前没有选中批次。")),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches", projectId] });
      setPromptEditorOpen(false);
      appToast.success("批次提示词已保存");
    },
    onError: (error: Error) => appToast.error("保存失败", error.message),
  });
  const deleteImagesMutation = useMutation({
    mutationFn: () => api.deleteProjectImages(projectId, selectedIds),
    onSuccess: () => {
      setDeleteDialogOpen(false);
      setPreviewImageId((current) => (current && selectedIds.includes(current) ? null : current));
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["images", projectId] });
      queryClient.invalidateQueries({ queryKey: ["image-ids", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["batches", projectId] });
      queryClient.invalidateQueries({ queryKey: ["logs"] });
      appToast.success("图片索引已删除", "仅删除平台中的图片、描述和问题记录，不会删除硬盘原图。");
    },
    onError: (error: Error) => appToast.error("删除失败", error.message),
  });

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !imagesQuery.hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !imagesQuery.isFetchingNextPage) {
          imagesQuery.fetchNextPage();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [imagesQuery.fetchNextPage, imagesQuery.hasNextPage, imagesQuery.isFetchingNextPage, imageItems.length]);

  useEffect(() => {
    if (!modelProfiles.length) return;
    if (selectedModelProfile && modelProfiles.some((profile) => profile.name === selectedModelProfile)) return;
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(modelStorageKey) ?? "" : "";
    if (stored && modelProfiles.some((profile) => profile.name === stored)) {
      setSelectedModelProfile(stored);
      return;
    }
    const fallback = settingsQuery.data?.model || modelProfiles[0]?.name || "";
    if (fallback) setSelectedModelProfile(fallback);
  }, [modelProfiles, modelStorageKey, selectedModelProfile, settingsQuery.data?.model]);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedModelProfile) return;
    window.localStorage.setItem(modelStorageKey, selectedModelProfile);
  }, [modelStorageKey, selectedModelProfile]);

  useEffect(() => {
    if (!promptEditorOpen) return;
    setDescriptionPrompt(activeBatch?.default_description_prompt || projectQuery.data?.default_description_prompt || "");
    setQuestionPrompt(activeBatch?.default_question_prompt || projectQuery.data?.default_question_prompt || "");
  }, [
    activeBatch?.default_description_prompt,
    activeBatch?.default_question_prompt,
    projectQuery.data?.default_description_prompt,
    projectQuery.data?.default_question_prompt,
    promptEditorOpen,
  ]);

  const setSearchParam = (partial: Record<string, string | undefined | number>) => {
    navigate({
      to: "/projects/$projectId/images",
      params: { projectId: String(projectId) },
      search: (previous) => ({
        batchId: "batchId" in partial ? (partial.batchId as string | undefined) : previous.batchId,
        hasDescriptions:
          "hasDescriptions" in partial ? (partial.hasDescriptions as string | undefined) : previous.hasDescriptions,
        hasQuestions:
          "hasQuestions" in partial ? (partial.hasQuestions as string | undefined) : previous.hasQuestions,
        offset: 0,
      }),
      replace: true,
    });
  };
  const editingBatchPrompts = Boolean(activeBatch);
  const promptDialogTitle = editingBatchPrompts ? `${activeBatch?.name} / 批次提示词` : "项目默认提示词";
  const promptDialogDescription = editingBatchPrompts
    ? "当前批次的默认提示词会优先于项目提示词，在工作台筛到该批次时自动带出。"
    : "当前选择的是全部批次，保存的会是整个项目的默认提示词。";
  const currentBatchImageIds = search.batchId ? allImageIdsQuery.data ?? [] : [];
  const isCurrentBatchFullySelected =
    currentBatchImageIds.length > 0 &&
    currentBatchImageIds.every((imageId) => selectedIds.includes(imageId));
  const savePrompt = () => {
    if (editingBatchPrompts) {
      saveBatchPromptMutation.mutate();
      return;
    }
    saveProjectPromptMutation.mutate();
  };
  const isSavingPrompt = saveProjectPromptMutation.isPending || saveBatchPromptMutation.isPending;
  const toggleSelectCurrentBatch = () => {
    if (!search.batchId) return;
    if (isCurrentBatchFullySelected) {
      setSelectedIds((current) => current.filter((imageId) => !currentBatchImageIds.includes(imageId)));
      return;
    }
    setSelectedIds((current) => Array.from(new Set([...current, ...currentBatchImageIds])));
  };

  return (
    <section>
      <div className="sticky top-3 z-30 mb-5 space-y-3">
        <PageHeader
          compact
          eyebrow="Images"
          title={projectQuery.data ? `${projectQuery.data.name} / 图片工作台` : "图片工作台"}
          description="筛选项目图片、批量选择并生成描述或问题，随时打开单图查看历史记录。"
          actions={
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/projects/$projectId" params={{ projectId: String(projectId) }}>
                  返回项目
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/projects/$projectId/export" params={{ projectId: String(projectId) }}>
                  导出数据集
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPromptEditorOpen(true)}>
                {editingBatchPrompts ? "批次提示词" : "项目提示词"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!search.batchId || allImageIdsQuery.isLoading}
                onClick={toggleSelectCurrentBatch}
              >
                {allImageIdsQuery.isLoading ? "读取中..." : isCurrentBatchFullySelected ? "取消全选" : `全选当前批次 (${currentBatchImageIds.length})`}
              </Button>
              <Button size="sm" onClick={() => setDescriptionOpen(true)} disabled={selectedIds.length === 0}>
                生成描述
              </Button>
              <Button size="sm" onClick={() => setQuestionOpen(true)} disabled={selectedIds.length === 0}>
                生成问题
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(true)} disabled={selectedIds.length === 0}>
                删除选中
              </Button>
            </>
          }
        />
        <div className="rounded-4xl border border-border/50 bg-white/88 shadow-soft backdrop-blur">
          <div className="grid gap-2 px-4 py-2.5 md:grid-cols-2 xl:grid-cols-5 pt-5">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">批次筛选</Label>
              <Select value={search.batchId ?? "all"} onValueChange={(value) => setSearchParam({ batchId: value === "all" ? undefined : value, offset: 0 })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部批次 ({projectQuery.data?.image_count ?? 0})</SelectItem>
                  {(batchesQuery.data ?? []).map((batch) => <SelectItem key={batch.id} value={String(batch.id)}>{batch.name} ({batch.image_count})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">描述状态</Label>
              <Select value={search.hasDescriptions ?? "all"} onValueChange={(value) => setSearchParam({ hasDescriptions: value === "all" ? undefined : value, offset: 0 })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="yes">已有描述</SelectItem>
                  <SelectItem value="no">暂无描述</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">问题状态</Label>
              <Select value={search.hasQuestions ?? "all"} onValueChange={(value) => setSearchParam({ hasQuestions: value === "all" ? undefined : value, offset: 0 })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="yes">已有问题</SelectItem>
                  <SelectItem value="no">暂无问题</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">当前选择</Label>
              <Input className="h-10" value={`${selectedIds.length} / ${totalImages} 张图片已选中`} readOnly />
            </div>
            <div className="space-y-1.5 md:col-span-2 xl:col-span-1">
              <Label className="text-xs text-muted-foreground">模型选择</Label>
              <Select value={resolvedSelectedModelProfile || undefined} onValueChange={setSelectedModelProfile}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="选择模型档案" />
                </SelectTrigger>
                <SelectContent>
                  {modelProfiles.map((profile) => (
                    <SelectItem key={profile.name} value={profile.name}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeModelProfile ? (
                <p className="truncate text-xs text-muted-foreground pl-3">{activeModelProfile.model}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {imagesQuery.isLoading ? <p>加载图片中...</p> : null}
      <ImageGrid
        items={imageItems}
        selectedIds={selectedIds}
        onToggle={(imageId, checked) => setSelectedIds((current) => checked ? Array.from(new Set([...current, imageId])) : current.filter((item) => item !== imageId))}
        onOpen={(imageId) => setPreviewImageId(imageId)}
        batches={batchesQuery.data}
      />
      <div className="mt-6 rounded-2xl border border-border/60 bg-white/85 p-4 text-center shadow-soft">
        <p className="text-sm text-muted-foreground">已加载 {imageItems.length} / {totalImages} 张图片</p>
        <div ref={loadMoreRef} className="mt-3">
          {imagesQuery.isFetchingNextPage ? <p className="text-sm text-muted-foreground">继续加载中...</p> : null}
          {!imagesQuery.hasNextPage && imageItems.length > 0 ? <p className="text-sm text-muted-foreground">已经到底了。</p> : null}
        </div>
      </div>
      <ImagePreviewDrawer
        imageId={previewImageId}
        imageIds={allImageIdsQuery.data ?? imageItems.map((item) => item.id)}
        open={previewImageId !== null}
        onOpenChange={(open) => !open && setPreviewImageId(null)}
        onNavigateTo={setPreviewImageId}
      />
      <GenerateDescriptionsDialog
        projectId={projectId}
        imageIds={selectedIds}
        selectedModelProfile={resolvedSelectedModelProfile}
        defaultPrompt={activeBatch?.default_description_prompt || projectQuery.data?.default_description_prompt || ""}
        defaultConcurrency={settingsQuery.data?.default_concurrency ?? 3}
        open={descriptionOpen}
        onOpenChange={setDescriptionOpen}
      />
      <GenerateQuestionsDialog
        projectId={projectId}
        imageIds={selectedIds}
        selectedModelProfile={resolvedSelectedModelProfile}
        defaultPrompt={activeBatch?.default_question_prompt || projectQuery.data?.default_question_prompt || ""}
        defaultConcurrency={settingsQuery.data?.default_concurrency ?? 3}
        open={questionOpen}
        onOpenChange={setQuestionOpen}
      />
      <Dialog open={promptEditorOpen} onOpenChange={setPromptEditorOpen}>
        <DialogContent className="min-w-3xl">
          <DialogHeader>
            <DialogTitle>{promptDialogTitle}</DialogTitle>
            <DialogDescription>{promptDialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>默认描述提示词</Label>
              <Textarea value={descriptionPrompt} onChange={(event) => setDescriptionPrompt(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>默认问题提示词</Label>
              <Textarea value={questionPrompt} onChange={(event) => setQuestionPrompt(event.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPromptEditorOpen(false)}>
                取消
              </Button>
              <Button onClick={savePrompt} disabled={isSavingPrompt}>
                {isSavingPrompt ? "保存中..." : "保存提示词"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>删除选中图片</DialogTitle>
            <DialogDescription>
              会删除当前选中的 {selectedIds.length} 张图片索引，以及它们关联的描述、问题和日志记录，但不会删除硬盘中的原始图片文件。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => deleteImagesMutation.mutate()} disabled={deleteImagesMutation.isPending}>
              确认删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
