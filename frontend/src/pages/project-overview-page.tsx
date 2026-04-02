import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { formatChinaDateTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { BatchUploadDialog } from "@/components/batch-upload-dialog";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ProjectOverviewPage({ projectId }: { projectId: number; }) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const projectQuery = useQuery({ queryKey: ["project", projectId], queryFn: () => api.getProject(projectId) });
  const batchesQuery = useQuery({ queryKey: ["batches", projectId], queryFn: () => api.listBatches(projectId) });
  const [descriptionPrompt, setDescriptionPrompt] = useState("");
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null);
  const [batchDescriptionPrompt, setBatchDescriptionPrompt] = useState("");
  const [batchQuestionPrompt, setBatchQuestionPrompt] = useState("");
  const [pendingDeleteBatchId, setPendingDeleteBatchId] = useState<number | null>(null);

  useEffect(() => {
    if (!projectQuery.data) return;
    setDescriptionPrompt(projectQuery.data.default_description_prompt || "");
    setQuestionPrompt(projectQuery.data.default_question_prompt || "");
  }, [projectQuery.data]);

  const savePromptMutation = useMutation({
    mutationFn: () =>
      api.updateProject(projectId, {
        note: projectQuery.data?.note || "",
        default_description_prompt: descriptionPrompt,
        default_question_prompt: questionPrompt,
      }),
    onSuccess: (project) => {
      queryClient.setQueryData(["project", projectId], project);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      push("项目提示词已保存");
    },
    onError: (error: Error) => push("保存失败", error.message),
  });

  const deleteBatchMutation = useMutation({
    mutationFn: (batchId: number) => api.deleteBatch(projectId, batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["images", projectId] });
      setPendingDeleteBatchId(null);
      push("批次已删除");
    },
    onError: (error: Error) => push("删除失败", error.message),
  });

  const updateBatchMutation = useMutation({
    mutationFn: (batchId: number) =>
      api.updateBatch(projectId, batchId, {
        default_description_prompt: batchDescriptionPrompt,
        default_question_prompt: batchQuestionPrompt,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches", projectId] });
      setEditingBatchId(null);
      push("批次提示词已保存");
    },
    onError: (error: Error) => push("保存失败", error.message),
  });

  return (
    <section>
      <PageHeader
        eyebrow="Project"
        title={projectQuery.data?.name ?? "项目详情"}
        description={projectQuery.data?.note || "按批次管理图片数据，进入图片工作台后可执行批量生成与导出。"}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link
                to="/projects/$projectId/images"
                params={{ projectId: String(projectId) }}
                search={{ batchId: undefined, hasDescriptions: undefined, hasQuestions: undefined, offset: 0 }}
              >
                图片工作台
              </Link>
            </Button>
            <BatchUploadDialog projectId={projectId} />
          </>
        }
      />
      {projectQuery.data ? (
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          {[
            ["图片总数", projectQuery.data.image_count],
            ["批次数", projectQuery.data.batch_count],
            ["描述总数", projectQuery.data.description_count],
            ["问题总数", projectQuery.data.question_count],
          ].map(([label, value]) => (
            <Card key={String(label)}>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-3xl font-semibold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>登记批次</CardTitle>
          <CardDescription>你可以持续往同一个项目追加多个批次，每个批次只记录来源文件夹和图片信息，不会复制原始图片。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(batchesQuery.data ?? []).map((batch) => (
            <div
              key={batch.id}
              className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-white pl-0 pr-3 py-2.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft overflow-hidden"
            >
              {/* 左侧指示条 */}
              <div className="w-1 self-stretch rounded-full bg-primary/30 shrink-0 group-hover:bg-primary/60 transition-colors duration-200 ml-3" />
              <Link
                to="/projects/$projectId/images"
                params={{ projectId: String(projectId) }}
                search={{ batchId: String(batch.id), hasDescriptions: undefined, hasQuestions: undefined, offset: 0 }}
                className="flex min-w-0 flex-1 items-center justify-between rounded-xl px-2 py-2 transition-colors hover:text-primary"
              >
                <div className="min-w-0">
                  <p className="font-medium transition-colors group-hover:text-primary">{batch.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{batch.source_folder || "未记录源文件夹"}</p>
                </div>
                <div className="shrink-0 text-right text-sm text-muted-foreground">
                  <p className="font-medium tabular-nums">{batch.image_count} 张图片</p>
                  <p>{formatChinaDateTime(batch.created_at)}</p>
                </div>
              </Link>
              <div className="flex items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setPendingDeleteBatchId(batch.id)}
                >
                  删除
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    setEditingBatchId(batch.id);
                    setBatchDescriptionPrompt(batch.default_description_prompt || "");
                    setBatchQuestionPrompt(batch.default_question_prompt || "");
                  }}
                >
                  提示词
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>项目默认提示词</CardTitle>
          <CardDescription>这些提示词只跟当前项目绑定。新项目默认留空，由你按项目场景分别填写。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>默认描述提示词</Label>
            <Textarea value={descriptionPrompt} onChange={(event) => setDescriptionPrompt(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>默认问题提示词</Label>
            <Textarea value={questionPrompt} onChange={(event) => setQuestionPrompt(event.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button
              className="min-w-[10rem]"
              onClick={() => savePromptMutation.mutate()}
              disabled={savePromptMutation.isPending}
            >
              保存项目提示词
            </Button>
          </div>
        </CardContent>
      </Card>
      <Dialog open={pendingDeleteBatchId !== null} onOpenChange={(open) => !open && setPendingDeleteBatchId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>删除整个批次</DialogTitle>
            <DialogDescription>会删除这个批次下的全部图片索引、描述和问题记录，但不会删除原始图片目录，确认继续吗？</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPendingDeleteBatchId(null)}>
              取消
            </Button>
            <Button
              size="sm"
              onClick={() => pendingDeleteBatchId !== null && deleteBatchMutation.mutate(pendingDeleteBatchId)}
              disabled={deleteBatchMutation.isPending}
            >
              {deleteBatchMutation.isPending ? "删除中..." : "确认删除"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={editingBatchId !== null} onOpenChange={(open) => !open && setEditingBatchId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>批次默认提示词</DialogTitle>
            <DialogDescription>当前批次的默认提示词会优先于项目默认提示词，在图片工作台筛到该批次时自动带出。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>默认描述提示词</Label>
              <Textarea value={batchDescriptionPrompt} onChange={(event) => setBatchDescriptionPrompt(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>默认问题提示词</Label>
              <Textarea value={batchQuestionPrompt} onChange={(event) => setBatchQuestionPrompt(event.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingBatchId(null)}>
                取消
              </Button>
              <Button
                className="min-w-[10rem]"
                onClick={() => editingBatchId !== null && updateBatchMutation.mutate(editingBatchId)}
                disabled={updateBatchMutation.isPending}
              >
                保存批次提示词
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
