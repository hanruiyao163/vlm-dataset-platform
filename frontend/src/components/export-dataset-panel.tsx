import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { appToast } from "@/lib/toast";
import type { ImageDetail } from "@/lib/types";
import { formatChinaFilenameTimestamp } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description?: string; accept: Record<string, string[]>; }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

export function ExportDatasetPanel({ projectId, imageIds }: { projectId: number; imageIds: number[]; }) {
  const [filename, setFilename] = useState(`qwen-messages-${formatChinaFilenameTimestamp()}.json`);
  const [imagePathPrefix, setImagePathPrefix] = useState("");
  const [trimmedParentLevels, setTrimmedParentLevels] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const query = useQuery({
    queryKey: ["export-images", projectId, imageIds],
    queryFn: async () => Promise.all(imageIds.map((imageId) => api.getImage(imageId))),
    enabled: imageIds.length > 0,
  });

  const rows = useMemo(() => {
    return (query.data ?? []).flatMap((image: ImageDetail) => {
      const getImagePath = () => {
        const normalizedSourcePath = image.source_path.replace(/\\/g, "/");
        const sourceParts = normalizedSourcePath.split("/").filter(Boolean);
        const trimmedParts = sourceParts.slice(trimmedParentLevels);
        const normalizedRelativePath = trimmedParts.join("/");
        const fallbackPath = sourceParts.at(-1) ?? image.relative_path.replace(/\\/g, "/");
        if (!imagePathPrefix) return normalizedRelativePath || fallbackPath;

        const prefix = imagePathPrefix.replace(/\\/g, "/").replace(/\/$/, "");
        return normalizedRelativePath ? `${prefix}/${normalizedRelativePath}` : `${prefix}/${fallbackPath}`;
      };

      const imagePath = getImagePath();
      const questions = image.questions.filter((record) => record.status === "success");
      const descriptions = image.descriptions.filter((record) => record.status === "success");
      const questionMap = new Map(questions.map((question) => [question.id, question]));
      const pairedRows = descriptions
        .filter((description) => description.paired_question_id)
        .flatMap((description) => {
          const matchedQuestion = description.paired_question_id ? questionMap.get(description.paired_question_id) : undefined;
          if (!matchedQuestion) return [];
          return [{
            messages: [
              { role: "user", content: `${matchedQuestion.content}<image>` },
              { role: "assistant", content: description.content },
            ],
            images: [imagePath],
          }];
        });
      const unpairedDescriptions = descriptions.filter((description) => !description.paired_question_id);
      const crossRows = questions.flatMap((question) =>
        unpairedDescriptions.map((description) => ({
          messages: [
            { role: "user", content: `${question.content}<image>` },
            { role: "assistant", content: description.content },
          ],
          images: [imagePath],
        })),
      );
      return [...pairedRows, ...crossRows];
    });
  }, [imagePathPrefix, query.data, trimmedParentLevels]);

  const exportableImageCount = useMemo(
    () =>
      (query.data ?? []).filter(
        (image: ImageDetail) =>
          image.questions.some((record) => record.status === "success") &&
          image.descriptions.some((record) => record.status === "success"),
      ).length,
    [query.data],
  );

  const handleExport = async () => {
    if (rows.length === 0) {
      appToast.info("没有可导出的样本");
      return;
    }

    const payload = JSON.stringify(rows, null, 2);
    const safeFilename = filename.trim() || "qwen-messages-export.json";
    setIsExporting(true);

    try {
      const saveWindow = window as SaveFilePickerWindow;
      if (saveWindow.showSaveFilePicker) {
        const handle = await saveWindow.showSaveFilePicker({
          suggestedName: safeFilename,
          types: [{ description: "JSON Files", accept: { "application/json": [".json"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(payload);
        await writable.close();
        appToast.success("导出成功", `已保存 ${rows.length} 条样本。`);
        return;
      }

      const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = safeFilename;
      anchor.click();
      URL.revokeObjectURL(url);
      appToast.success("导出成功", `已下载 ${rows.length} 条样本。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "导出失败";
      appToast.error("导出失败", message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Qwen Messages 导出</CardTitle>
        <CardDescription>自动汇总每张图片下全部成功问题和全部成功描述，按 Qwen 官方的 messages + images 结构导出。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>导出文件名</Label>
            <Input value={filename} onChange={(event) => setFilename(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>图片路径前缀 (适用于迁移到其他目录)</Label>
            <Input
              placeholder="如：/user/home/data/"
              value={imagePathPrefix}
              onChange={(event) => setImagePathPrefix(event.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>去除左侧父目录级别</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={trimmedParentLevels}
              onChange={(event) => {
                const nextValue = Number.parseInt(event.target.value, 10);
                setTrimmedParentLevels(Number.isNaN(nextValue) ? 0 : Math.max(0, nextValue));
              }}
            />
            <p className="text-sm text-muted-foreground">
              会先把 Windows 路径统一成 `/`。例如 `D:/user/hry/vlm-dataset/a.jpg` 填 `1` 后会变成 `user/hry/vlm-dataset/a.jpg`。
            </p>
          </div>
        </div>
        <div className="grid gap-4 rounded-2xl border border-border/50 bg-secondary/20 p-4 md:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">图片总数</p>
            <p className="mt-1 text-2xl font-semibold">{imageIds.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">可导出图片</p>
            <p className="mt-1 text-2xl font-semibold">{exportableImageCount}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">最终样本数</p>
            <p className="mt-1 text-2xl font-semibold">{rows.length}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-border/50 bg-white/65 p-4 text-sm text-muted-foreground">
          每条样本会导出为 `messages` 和 `images` 两个字段，用户消息格式为 `问题内容&lt;image&gt;`。普通描述会和同图下全部成功问题做组合；若描述是基于某条问题配对生成的，则只会导出对应的那组 QA，不再和其他问题交叉匹配。
        </div>
        <div className="flex justify-end pb-6">
          <Button disabled={isExporting || query.isLoading || rows.length === 0} onClick={handleExport}>
            {isExporting ? "导出中..." : "导出 Qwen JSON"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
