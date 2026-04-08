import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { appToast } from "@/lib/toast";
import { GenerationHistoryPanel } from "@/components/generation-history-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ImagePreviewDrawer({
  imageId,
  imageIds,
  open,
  onOpenChange,
  onNavigateTo,
}: {
  imageId: number | null;
  imageIds: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateTo: (imageId: number) => void;
}) {
  const query = useQuery({
    queryKey: ["image", imageId],
    queryFn: () => api.getImage(imageId!),
    enabled: open && imageId !== null,
  });
  const queryClient = useQueryClient();
  const currentIndex = imageId ? imageIds.indexOf(imageId) : -1;
  const currentPosition = currentIndex >= 0 ? `${currentIndex + 1} / ${imageIds.length}` : null;
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: (params: { projectId: number; imageId: number }) =>
      api.deleteProjectImages(params.projectId, [params.imageId]),
    onSuccess: (_, variables) => {
      appToast.success("图片已删除");
      queryClient.invalidateQueries({ queryKey: ["images", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["image-ids", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", variables.projectId] });
    },
    onSettled: () => setIsDeleting(false),
    onError: (error: Error) => appToast.error("删除失败", error.message),
  });

  const handleDelete = () => {
    if (!query.data || !imageId || isDeleting) return;
    if (!window.confirm("确定要删除这张图片吗？此操作不可撤销。")) return;

    setIsDeleting(true);
    const projectId = query.data.project_id;

    // Determine where to go next
    if (imageIds.length <= 1) {
      // Only one image left, close after delete
      deleteMutation.mutate({ projectId, imageId }, {
        onSuccess: () => onOpenChange(false)
      });
    } else {
      // Find the next target before the current ID disappears from the list
      const nextTargetId = currentIndex < imageIds.length - 1 
        ? imageIds[currentIndex + 1] 
        : imageIds[currentIndex - 1];
        
      deleteMutation.mutate({ projectId, imageId }, {
        onSuccess: () => onNavigateTo(nextTargetId)
      });
    }
  };

  const navigateImage = (direction: "prev" | "next") => {
    if (currentIndex === -1) return;
    const nextIndex = direction === "prev" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0) {
      appToast.info("已经是第一张图片");
      return;
    }
    if (nextIndex >= imageIds.length) {
      appToast.info("已经是最后一张图片");
      return;
    }
    onNavigateTo(imageIds[nextIndex]);
  };

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateImage("prev");
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateImage("next");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, currentIndex, imageIds, onNavigateTo]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[min(96vw,1720px)] max-w-none sm:max-w-none flex-col overflow-hidden p-8">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle>图片详情</DialogTitle>
              <DialogDescription>查看预览、历史描述和历史问题，并支持人工核对修改与左右切换图片。</DialogDescription>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {currentPosition ? (
                <span className="rounded-full border border-border bg-secondary/45 px-3 py-1 text-xs text-muted-foreground">
                  {currentPosition}
                </span>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="focus-visible:ring-0 focus-visible:ring-offset-0"
                onClick={() => navigateImage("prev")}
              >
                <ChevronLeft className="h-4 w-4" />
                前一张
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-0 focus-visible:ring-offset-0"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
                删除
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="focus-visible:ring-0 focus-visible:ring-offset-0"
                onClick={() => navigateImage("next")}
              >
                后一张
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        {query.isLoading ? <p>加载中...</p> : null}
        {query.isError ? <p className="text-sm text-destructive">图片详情加载失败，请稍后重试。</p> : null}
        {query.data ? (
          <div className="grid min-h-0 flex-1 gap-8 overflow-hidden lg:grid-cols-[minmax(0,1.2fr)_minmax(520px,0.95fr)]">
            <div className="flex min-h-0 flex-col gap-4">
              <img
                src={query.data.preview_url}
                alt={query.data.filename}
                className="min-h-0 flex-1 rounded-[28px] border border-border object-contain"
              />
              <div className="rounded-2xl border border-border/50 bg-secondary/40 p-4 text-sm text-muted-foreground">
                <p>文件名：{query.data.filename}</p>
                <p>相对路径：{query.data.relative_path}</p>
                <p>尺寸：{query.data.width} × {query.data.height}</p>
              </div>
            </div>
            <GenerationHistoryPanel
              imageId={query.data.id}
              descriptions={query.data.descriptions}
              questions={query.data.questions}
            />
          </div>
        ) : null}
        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
