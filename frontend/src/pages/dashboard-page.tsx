import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { PageHeader } from "@/components/page-header";
import { ProjectCard } from "@/components/project-card";

export function DashboardPage() {
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: api.listProjects });

  return (
    <section>
      <PageHeader
        eyebrow="Projects"
        title="数据集生产工作台"
        description="创建项目、按批次导入图片、批量生成描述与问题，并导出可用于微调的 ShareGPT 数据集。"
        actions={<CreateProjectDialog />}
      />
      {projectsQuery.isLoading ? <p className="mb-4 text-sm text-muted-foreground">加载项目中...</p> : null}
      {!projectsQuery.isLoading && (projectsQuery.data?.length ?? 0) === 0 ? (
        <div className="rounded-[30px] border border-dashed border-border/80 bg-white/55 px-6 py-12 text-center shadow-soft">
          <p className="text-lg font-semibold tracking-tight">还没有项目</p>
          <p className="mt-2 text-sm text-muted-foreground">先创建一个项目，我们再把上传、生成和导出流程串起来。</p>
        </div>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {(projectsQuery.data ?? []).map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}
