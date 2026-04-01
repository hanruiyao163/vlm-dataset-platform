import { useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";

import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatChinaDateTime } from "@/lib/utils";

export function LogsPage({
  search,
}: {
  search: { projectId?: string; batchId?: string; taskType?: string; status?: string };
}) {
  const navigate = useNavigate();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: api.listProjects });
  const selectedProjectId = search.projectId ? Number(search.projectId) : undefined;
  const batchesQuery = useQuery({
    queryKey: ["batches", selectedProjectId],
    queryFn: () => api.listBatches(selectedProjectId!),
    enabled: selectedProjectId !== undefined,
  });
  const logsQuery = useInfiniteQuery({
    initialPageParam: 0,
    queryKey: ["logs", search.projectId, search.batchId, search.taskType, search.status],
    queryFn: ({ pageParam }) =>
      api.listGenerationLogs({
        project_id: search.projectId ? Number(search.projectId) : undefined,
        batch_id: search.batchId ? Number(search.batchId) : undefined,
        task_type: search.taskType,
        status: search.status,
        limit: 40,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
  });

  const items = useMemo(() => logsQuery.data?.pages.flatMap((page) => page.items) ?? [], [logsQuery.data?.pages]);
  const total = logsQuery.data?.pages[0]?.total ?? 0;
  const successCount = items.filter((item) => item.status === "success").length;
  const failedCount = items.filter((item) => item.status === "failed").length;

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !logsQuery.hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !logsQuery.isFetchingNextPage) {
          logsQuery.fetchNextPage();
        }
      },
      { rootMargin: "320px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [logsQuery.fetchNextPage, logsQuery.hasNextPage, logsQuery.isFetchingNextPage, items.length]);

  const updateSearch = (partial: { projectId?: string; batchId?: string; taskType?: string; status?: string }) => {
    navigate({
      to: "/logs",
      search: (previous) => ({
        projectId: "projectId" in partial ? partial.projectId : previous.projectId,
        batchId: "batchId" in partial ? partial.batchId : previous.batchId,
        taskType: "taskType" in partial ? partial.taskType : previous.taskType,
        status: "status" in partial ? partial.status : previous.status,
      }),
      replace: true,
    });
  };

  return (
    <section>
      <PageHeader
        eyebrow="Logs"
        title="生成日志"
        description="集中查看描述和问题的历史生成结果，快速定位哪个项目、哪个批次、哪张图片成功了，或是失败在什么地方。"
      />
      <Card className="mb-6">
        <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>项目</Label>
            <Select
              value={search.projectId ?? "all"}
              onValueChange={(value) =>
                updateSearch({
                  projectId: value === "all" ? undefined : value,
                  batchId: undefined,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部项目</SelectItem>
                {(projectsQuery.data ?? []).map((project) => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>批次</Label>
            <Select
              value={search.batchId ?? "all"}
              onValueChange={(value) => updateSearch({ batchId: value === "all" ? undefined : value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部批次</SelectItem>
                {(batchesQuery.data ?? []).map((batch) => (
                  <SelectItem key={batch.id} value={String(batch.id)}>
                    {batch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>类型</Label>
            <Select
              value={search.taskType ?? "all"}
              onValueChange={(value) => updateSearch({ taskType: value === "all" ? undefined : value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="description">描述生成</SelectItem>
                <SelectItem value="question">问题生成</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>结果</Label>
            <Select
              value={search.status ?? "all"}
              onValueChange={(value) => updateSearch({ status: value === "all" ? undefined : value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部结果</SelectItem>
                <SelectItem value="success">成功</SelectItem>
                <SelectItem value="failed">失败</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">当前筛选总日志</p>
            <p className="mt-2 text-3xl font-semibold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">已加载成功</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-700">{successCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">已加载失败</p>
            <p className="mt-2 text-3xl font-semibold text-rose-700">{failedCount}</p>
          </CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="grid gap-0 xl:h-[220px] xl:grid-cols-[280px,1fr]">
                <div className="min-h-0 overflow-y-auto border-b border-border/70 bg-secondary/20 p-4 xl:border-b-0 xl:border-r">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        {item.task_type === "description" ? "描述生成" : "问题生成"}
                      </p>
                      <p className="mt-1.5 text-base font-semibold">{item.image_filename}</p>
                    </div>
                    <span
                      className={
                        item.status === "success"
                          ? "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700"
                          : "rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700"
                      }
                    >
                      {item.status === "success" ? "成功" : "失败"}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs leading-5 text-muted-foreground">
                    <p>项目：{item.project_name}</p>
                    <p>批次：{item.batch_name}</p>
                    <p className="break-all">路径：{item.image_relative_path}</p>
                    <p>模型：{item.model || "未记录"}</p>
                    <p>时间：{formatChinaDateTime(item.created_at)}</p>
                  </div>
                  {item.source_record_type ? (
                    <div className="mt-3 rounded-2xl border border-border/70 bg-white/75 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {item.source_record_type === "question" ? "强绑定来源" : "生成参考"}
                      </p>
                      <p className="mt-1 text-xs font-medium leading-5 text-foreground/80">
                        {item.source_record_label || (item.source_record_type === "question" ? "问题记录" : "描述记录")}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-3">
                    <Link
                      to="/projects/$projectId/images"
                      params={{ projectId: String(item.project_id) }}
                      search={{
                        batchId: String(item.batch_id),
                        hasDescriptions: undefined,
                        hasQuestions: undefined,
                        offset: 0,
                      }}
                      className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      前往该批次工作台
                    </Link>
                  </div>
                </div>
                <div className="min-h-0 p-4">
                  <div className="grid h-full gap-3 lg:grid-cols-2">
                    <div className="flex min-h-0 flex-col rounded-[20px] border border-border/70 bg-white/80 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">提示词</p>
                      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                        <p className="whitespace-pre-wrap text-sm leading-5 text-muted-foreground">{item.prompt || "未记录提示词。"}</p>
                      </div>
                    </div>
                    <div
                      className={
                        item.status === "success"
                          ? "flex min-h-0 flex-col rounded-[20px] border border-emerald-200/80 bg-emerald-50/60 p-3"
                          : "flex min-h-0 flex-col rounded-[20px] border border-rose-200/80 bg-rose-50/60 p-3"
                      }
                    >
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {item.status === "success" ? "生成结果" : "失败信息"}
                      </p>
                      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                        <p className="whitespace-pre-wrap text-sm leading-5 text-foreground/80">
                          {item.status === "success" ? item.content || "无内容。" : item.error || "未记录错误信息。"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!logsQuery.isLoading && items.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              当前筛选下还没有生成日志。后续生成描述或问题后，这里会自动出现成功和失败记录。
            </CardContent>
          </Card>
        ) : null}
      </div>
      <div ref={loadMoreRef} className="mt-6 rounded-2xl border border-border bg-white/80 p-4 text-center shadow-soft">
        {logsQuery.isLoading ? <p className="text-sm text-muted-foreground">加载日志中...</p> : null}
        {logsQuery.isFetchingNextPage ? <p className="text-sm text-muted-foreground">继续加载中...</p> : null}
        {!logsQuery.hasNextPage && items.length > 0 ? <p className="text-sm text-muted-foreground">日志已经全部展示完了。</p> : null}
      </div>
    </section>
  );
}
