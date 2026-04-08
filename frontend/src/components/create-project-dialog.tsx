import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

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
import { Textarea } from "@/components/ui/textarea";

type FormValues = { name: string; note: string };

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm<FormValues>();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: api.createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      appToast.success("项目已创建");
      reset({ name: "", note: "" });
      setOpen(false);
    },
    onError: (error: Error) => appToast.error("创建失败", error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>创建项目</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建新项目</DialogTitle>
          <DialogDescription>建立一个新的数据集生产空间，后续可分批上传图片并生成描述与问题。</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <div className="space-y-2">
            <Label htmlFor="project-name">项目名称</Label>
            <Input id="project-name" placeholder="例如：road-side-violations-2026" {...register("name", { required: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-note">备注</Label>
            <Textarea id="project-note" placeholder="补充项目目标、图像来源、标注规范等。" {...register("note")} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "创建中..." : "创建"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
