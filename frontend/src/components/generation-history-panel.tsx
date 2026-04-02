import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { GenerationRecord } from "@/lib/types";
import { formatChinaDateTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function GenerationHistoryPanel({
  imageId,
  descriptions,
  questions,
}: {
  imageId: number;
  descriptions: GenerationRecord[];
  questions: GenerationRecord[];
}) {
  return (
    <div className="grid h-full min-h-0 gap-6 xl:grid-rows-2">
      <RecordSection
        imageId={imageId}
        title="描述历史"
        records={descriptions}
        tone="secondary"
        recordType="description"
        relatedRecords={questions}
      />
      <RecordSection
        imageId={imageId}
        title="问题历史"
        records={questions}
        tone="accent"
        recordType="question"
        relatedRecords={descriptions}
      />
    </div>
  );
}

function RecordSection({
  imageId,
  title,
  records,
  tone,
  recordType,
  relatedRecords = [],
}: {
  imageId: number;
  title: string;
  records: GenerationRecord[];
  tone: "secondary" | "accent";
  recordType: "description" | "question";
  relatedRecords?: GenerationRecord[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [createDescriptionMode, setCreateDescriptionMode] = useState<"general" | "paired">("general");
  const [createQuestionId, setCreateQuestionId] = useState<string>("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editingContainerRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const { push } = useToast();

  const relatedRecordMap = useMemo(
    () => new Map(relatedRecords.map((record) => [record.id, record])),
    [relatedRecords],
  );
  const availableQuestions = useMemo(
    () => relatedRecords.filter((record) => record.status === "success"),
    [relatedRecords],
  );

  useEffect(() => {
    if (records.length === 0) {
      setActiveIndex(0);
      setIsCollapsed(false);
      setIsCreating(false);
      setEditingId(null);
      setDraft("");
      return;
    }
    setActiveIndex((current) => Math.min(current, records.length - 1));
    setIsCollapsed(false);
  }, [records]);

  useEffect(() => {
    if (recordType !== "description") return;
    if (createDescriptionMode === "paired" && !createQuestionId && availableQuestions[0]) {
      setCreateQuestionId(String(availableQuestions[0].id));
    }
    if (createDescriptionMode === "general") {
      setCreateQuestionId("");
    }
  }, [availableQuestions, createDescriptionMode, createQuestionId, recordType]);

  const resetCreateState = () => {
    setIsCreating(false);
    setDraft("");
    setCreateDescriptionMode("general");
    setCreateQuestionId("");
  };

  const updateMutation = useMutation({
    mutationFn: ({ recordId, content }: { recordId: number; content: string }) =>
      recordType === "description"
        ? api.updateDescription(recordId, { content })
        : api.updateQuestion(recordId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["image", imageId] });
      queryClient.invalidateQueries({ queryKey: ["images"] });
      push(recordType === "description" ? "描述已保存" : "问题已保存");
      setEditingId(null);
      setDraft("");
    },
    onError: (error: Error) => push("保存失败", error.message),
  });

  const createMutation = useMutation({
    mutationFn: ({ content, questionId }: { content: string; questionId?: number }) =>
      recordType === "description"
        ? api.createDescription(imageId, { content, paired_question_id: questionId })
        : api.createQuestion(imageId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["image", imageId] });
      queryClient.invalidateQueries({ queryKey: ["images"] });
      push(recordType === "description" ? "描述已添加" : "问题已添加");
      resetCreateState();
    },
    onError: (error: Error) => push("新增失败", error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (recordId: number) =>
      recordType === "description" ? api.deleteDescription(recordId) : api.deleteQuestion(recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["image", imageId] });
      queryClient.invalidateQueries({ queryKey: ["images"] });
      push(recordType === "description" ? "描述已删除" : "问题已删除");
      setEditingId(null);
      setPendingDeleteId(null);
      setDraft("");
    },
    onError: (error: Error) => push("删除失败", error.message),
  });

  const persistDraft = () => {
    if (isCreating) {
      const nextContent = draft.trim();
      if (!nextContent) {
        resetCreateState();
        return;
      }
      if (recordType === "description" && createDescriptionMode === "paired" && !createQuestionId) {
        push("请选择问题", "问题配对描述需要先指定它回答的是哪条问题。");
        return;
      }
      createMutation.mutate({
        content: nextContent,
        questionId: recordType === "description" && createDescriptionMode === "paired" ? Number(createQuestionId) : undefined,
      });
      return;
    }
    if (editingId === null) return;
    const original = records.find((record) => record.id === editingId)?.content ?? "";
    const nextContent = draft.trim();
    if (!nextContent) {
      setEditingId(null);
      setDraft("");
      push("内容为空，未保存", "如需移除这条记录，请使用删除。");
      return;
    }
    if (nextContent === original) {
      setEditingId(null);
      setDraft("");
      return;
    }
    updateMutation.mutate({ recordId: editingId, content: nextContent });
  };

  useEffect(() => {
    if (records.length === 0 || isCollapsed) return;
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>("[data-record-trigger='true']");
    buttons?.[activeIndex]?.focus();
  }, [activeIndex, isCollapsed, records.length]);

  useEffect(() => {
    if (editingId === null && !isCreating) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && editingContainerRef.current?.contains(target)) return;
      persistDraft();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [createDescriptionMode, createQuestionId, draft, editingId, isCreating, records]);

  return (
    <section className="flex min-h-0 flex-col rounded-[28px] border border-border/50 bg-white/70 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h4 className="font-semibold">{title}</h4>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{records.length}</Badge>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => {
              setIsCreating(true);
              setIsCollapsed(false);
              setEditingId(null);
              setDraft("");
              setCreateDescriptionMode("general");
              setCreateQuestionId(availableQuestions[0] ? String(availableQuestions[0].id) : "");
            }}
            disabled={isCreating || createMutation.isPending || updateMutation.isPending}
          >
            新增
          </Button>
        </div>
      </div>
      {isCreating ? (
        <div ref={editingContainerRef} className="mb-4 space-y-3 rounded-2xl border border-border/50 bg-white/75 p-3">
          {recordType === "description" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCreateDescriptionMode("general")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    createDescriptionMode === "general"
                      ? "bg-secondary text-foreground"
                      : "bg-secondary/40 text-muted-foreground"
                  }`}
                >
                  通用描述
                </button>
                <button
                  type="button"
                  onClick={() => setCreateDescriptionMode("paired")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    createDescriptionMode === "paired"
                      ? "bg-primary/15 text-primary"
                      : "bg-secondary/40 text-muted-foreground"
                  }`}
                >
                  问题配对描述
                </button>
              </div>
              {createDescriptionMode === "paired" ? (
                availableQuestions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">这条描述将作为某条问题的回答保存。</p>
                    <Select value={createQuestionId} onValueChange={setCreateQuestionId}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择它要回答的问题" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableQuestions.map((question, index) => (
                          <SelectItem key={question.id} value={String(question.id)}>
                            {`问题 ${index + 1} · ${question.content}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/50 bg-secondary/20 p-3 text-xs text-muted-foreground">
                    当前图片还没有可绑定的成功问题，先新增问题后才能创建问题配对描述。
                  </div>
                )
              ) : null}
            </div>
          ) : null}
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              recordType === "description"
                ? "输入描述，点击外部区域自动保存"
                : "输入人工补充的问题，点击外部区域自动保存"
            }
            className="min-h-[160px]"
          />
        </div>
      ) : null}
      {records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-white/45 p-4 text-sm text-muted-foreground">
          暂无记录。
        </div>
      ) : (
        <div
          ref={containerRef}
          className="min-h-0 space-y-3 overflow-y-auto pr-1"
          tabIndex={0}
          onKeyDown={(event) => {
            if ((event.target as HTMLElement).closest("textarea")) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIsCollapsed(false);
              setActiveIndex((current) => Math.min(current + 1, records.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setIsCollapsed(false);
              setActiveIndex((current) => Math.max(current - 1, 0));
            }
          }}
        >
          {records.map((record, index) => {
            const isActive = index === activeIndex;
            const isExpanded = isActive && !isCollapsed;
            const isEditing = editingId === record.id;
            const relationRecord =
              recordType === "description"
                ? (record.paired_question_id ? relatedRecordMap.get(record.paired_question_id) : undefined)
                : (record.description_id ? relatedRecordMap.get(record.description_id) : undefined);
            const relationIndex = relationRecord ? relatedRecords.findIndex((item) => item.id === relationRecord.id) : -1;
            const relationLabel =
              relationRecord && relationIndex >= 0
                ? `${recordType === "description" ? "问题" : "描述"} ${relationIndex + 1}`
                : `${recordType === "description" ? "问题" : "描述"}记录`;
            const typeBadge =
              recordType === "description"
                ? record.paired_question_id
                  ? "问题配对描述"
                  : "通用描述"
                : record.description_id
                  ? "基于描述"
                  : "通用问题";
            const typeBadgeClassName =
              recordType === "description"
                ? record.paired_question_id
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/50 bg-secondary/80 text-secondary-foreground"
                : "border-border/50 bg-secondary/80 text-secondary-foreground";

            return (
              <div
                key={record.id}
                className={`overflow-hidden rounded-[24px] border transition-colors ${
                  isActive
                    ? tone === "secondary"
                      ? "border-primary/25 bg-secondary/45"
                      : "border-primary/25 bg-accent/40"
                    : "border-border/60 bg-white/45"
                }`}
              >
                <button
                  data-record-trigger="true"
                  type="button"
                  onClick={() => {
                    if (isActive && !isCollapsed) {
                      setIsCollapsed(true);
                      setEditingId(null);
                      return;
                    }
                    setActiveIndex(index);
                    setIsCollapsed(false);
                    setEditingId(null);
                  }}
                  className="flex w-full items-start justify-between gap-3 px-4 py-2 text-left outline-none transition-colors hover:bg-white/35 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{`${title.replace("历史", "")} ${index + 1}`}</p>
                      <Badge className={typeBadgeClassName}>{typeBadge}</Badge>
                      <Badge>{record.status}</Badge>
                      <p className="truncate text-xs text-muted-foreground">{formatChinaDateTime(record.created_at)}</p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isExpanded ? (
                  <div className="relative border-t border-border/60 px-1 py-4">
                    <div className="absolute right-0 top-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 rounded-full p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setPendingDeleteId(record.id)}
                        disabled={deleteMutation.isPending || updateMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {relationRecord ? (
                      <div className="mx-2 mb-3 flex items-center gap-2 rounded-2xl border border-border/70 bg-white/70 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {recordType === "description" ? "强绑定回答" : "生成参考"}
                        </p>
                        <p className="text-sm font-medium text-foreground/85">{relationLabel}</p>
                      </div>
                    ) : null}
                    {isEditing ? (
                      <div ref={editingContainerRef} className="pr-8">
                        <Textarea
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          className="min-h-[180px]"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(record.id);
                          setDraft(record.content);
                        }}
                        className="block w-full max-h-[24rem] overflow-y-auto px-2 text-left outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
                      >
                        <RecordContent text={record.content || record.error || "暂无内容"} />
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      <Dialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{recordType === "description" ? "删除描述" : "删除问题"}</DialogTitle>
            <DialogDescription>删除后无法恢复，确认继续吗？</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPendingDeleteId(null)}>
              取消
            </Button>
            <Button
              size="sm"
              onClick={() => pendingDeleteId !== null && deleteMutation.mutate(pendingDeleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "删除中..." : "确认删除"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function RecordContent({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).filter(Boolean);
  const items = paragraphs.length > 0 ? paragraphs : [text];

  return (
    <div className="space-y-3 text-sm">
      {items.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 20)}`} className="whitespace-pre-wrap leading-normal">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
