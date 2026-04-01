import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { ExportDatasetPanel } from "@/components/export-dataset-panel";
import { PageHeader } from "@/components/page-header";

export function ProjectExportPage({ projectId }: { projectId: number }) {
  const projectQuery = useQuery({ queryKey: ["project", projectId], queryFn: () => api.getProject(projectId) });
  const imageIdsQuery = useQuery({
    queryKey: ["export-image-list", projectId],
    queryFn: () => api.listImageIds(projectId, {}),
  });
  const imageIds = imageIdsQuery.data ?? [];

  return (
    <section>
      <PageHeader
        eyebrow="Export"
        title={projectQuery.data ? `${projectQuery.data.name} / 导出` : "导出数据集"}
        description="自动汇总项目内全部图片的成功问题和成功描述，批量导出为适合 Qwen 微调的 messages JSON 数据集。"
      />
      <ExportDatasetPanel projectId={projectId} imageIds={imageIds} />
    </section>
  );
}
