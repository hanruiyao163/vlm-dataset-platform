import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Folder, MessageSquareMore, ScanSearch } from "lucide-react";

import { api } from "@/lib/api";
import type { Project } from "@/lib/types";
import { formatChinaDateTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ProjectCard({ project }: { project: Project; }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { push } = useToast();
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteProject(project.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      push("项目已删除", project.name);
      setConfirmOpen(false);
      navigate({ to: "/projects" });
    },
    onError: (error: Error) => push("删除失败", error.message),
  });

  return (
    <Card className="overflow-hidden border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(250,244,235,0.60))]">
      <CardHeader className="border-b border-border/60 bg-[radial-gradient(circle_at_top_right,rgba(201,97,37,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.72),rgba(247,239,228,0.72))]">
        <div className="flex items-center justify-between">
          <Badge>{project.batch_count} 批次</Badge>
          <span className="text-xs font-medium text-muted-foreground">{formatChinaDateTime(project.created_at)}</span>
        </div>
        <CardTitle className="text-xl">{project.name}</CardTitle>
        <CardDescription className="line-clamp-2 min-h-10 leading-6">
          {project.note || "这个项目还没有备注。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6 pb-1">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-[22px] border border-white/70 bg-white/70 p-3.5">
            <Folder className="mb-3 h-4 w-4 text-primary" />
            <div className="text-xl font-semibold tracking-tight">{project.image_count}</div>
            <div className="text-muted-foreground">图片</div>
          </div>
          <div className="rounded-[22px] border border-white/70 bg-white/70 p-3.5">
            <ScanSearch className="mb-3 h-4 w-4 text-primary" />
            <div className="text-xl font-semibold tracking-tight">{project.description_count}</div>
            <div className="text-muted-foreground">描述</div>
          </div>
          <div className="rounded-[22px] border border-white/70 bg-white/70 p-3.5">
            <MessageSquareMore className="mb-3 h-4 w-4 text-primary" />
            <div className="text-xl font-semibold tracking-tight">{project.question_count}</div>
            <div className="text-muted-foreground">问题</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild className="flex-1">
            <Link to="/projects/$projectId" params={{ projectId: String(project.id) }}>
              打开项目
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" className="flex-1" asChild>
            <Link
              to="/projects/$projectId/images"
              params={{ projectId: String(project.id) }}
              search={{ batchId: undefined, hasDescriptions: undefined, hasQuestions: undefined, offset: 0 }}
            >
              图片工作台
            </Link>
          </Button>
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="text-muted-foreground/80 hover:text-foreground" onClick={() => setConfirmOpen(true)}>
            删除项目
          </Button>
        </div>
      </CardContent>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除项目</DialogTitle>
            <DialogDescription>
              删除后将一并移除项目“{project.name}”下的批次、图片和全部生成记录，这个操作不能撤销。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleteMutation.isPending}>
              取消
            </Button>
            <Button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "删除中..." : "确认删除"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
