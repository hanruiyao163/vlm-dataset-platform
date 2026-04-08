import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { api } from "@/lib/api";
import { appToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BatchUploadDialog({ projectId }: { projectId: number }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [sourceFolder, setSourceFolder] = useState("");
  const queryClient = useQueryClient();
  const pickDirectoryMutation = useMutation({
    mutationFn: () => api.pickBatchDirectory(projectId),
    onSuccess: ({ path }) => setSourceFolder(path),
    onError: (error: Error) => {
      if (error.message.includes("未选择任何目录")) return;
      appToast.error("选择目录失败", error.message);
    },
  });

  const mutation = useMutation({
    mutationFn: () => api.scanBatch(projectId, { batchName, sourceFolder }),
    onSuccess: (batch) => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["batches", projectId] });
      queryClient.invalidateQueries({ queryKey: ["images", projectId] });
      appToast.success("登记完成", `批次 ${batch.name} 已登记 ${batch.image_count} 张图片。`);
      setSourceFolder("");
      setBatchName("");
      setOpen(false);
      navigate({
        to: "/projects/$projectId/images",
        params: { projectId: String(projectId) },
        search: { batchId: String(batch.id), hasDescriptions: undefined, hasQuestions: undefined, offset: 0 },
      });
    },
    onError: (error: Error) => appToast.error("登记失败", error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>登记批次</Button>
      </DialogTrigger>
      <DialogContent className="min-w-2xl">
        <DialogHeader>
          <DialogTitle>登记图片批次</DialogTitle>
          <DialogDescription>输入本机图片目录路径，系统会直接扫描该目录并登记图片，不会复制图片文件到平台目录。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="batch-name">批次名称</Label>
            <Input id="batch-name" value={batchName} onChange={(event) => setBatchName(event.target.value)} placeholder="例如：batch-001-morning-patrol" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source-folder">目录路径</Label>
            <div className="flex gap-2">
              <Input
                id="source-folder"
                value={sourceFolder}
                onChange={(event) => setSourceFolder(event.target.value)}
                placeholder="例如：D:\\数据集\\一号楼\\批次-01"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => pickDirectoryMutation.mutate()}
                disabled={pickDirectoryMutation.isPending}
              >
                {pickDirectoryMutation.isPending ? "选择中..." : "选择目录"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">请输入后端当前这台机器上可直接访问的本地目录绝对路径。</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !batchName.trim() || !sourceFolder.trim()}>
              {mutation.isPending ? "登记中..." : "开始登记"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
