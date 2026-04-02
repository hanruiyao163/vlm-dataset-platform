import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { PageHeader } from "@/components/page-header";
import { ProjectCard } from "@/components/project-card";
import { Card, CardContent } from "@/components/ui/card";

export function DashboardPage() {
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: api.listProjects });
  const projects = projectsQuery.data ?? [];
  const totalImages = projects.reduce((sum, project) => sum + project.image_count, 0);
  const totalDescriptions = projects.reduce((sum, project) => sum + project.description_count, 0);
  const totalQuestions = projects.reduce((sum, project) => sum + project.question_count, 0);

  return (
    <section>
      <PageHeader
        eyebrow="Projects"
        title="数据集生产工作台"
        description="创建项目、按批次导入图片、批量生成描述与问题，并导出可用于微调的 ShareGPT 数据集。"
        actions={<CreateProjectDialog />}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["项目数", projects.length, "当前工作空间"],
          ["图片总量", totalImages, "全项目累计图片"],
          ["描述记录", totalDescriptions, "可直接进入质检"],
          ["问答记录", totalQuestions, "支持后续导出"],
        ].map(([label, value, hint]) => (
          <Card key={String(label)} className="bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(240,242,248,0.94))] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.22em] text-primary/70">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {projectsQuery.isLoading ? <p className="mb-4 text-sm text-muted-foreground">加载项目中...</p> : null}
      {!projectsQuery.isLoading && (projectsQuery.data?.length ?? 0) === 0 ? (
        <div className="rounded-[30px] border border-dashed border-border/70 bg-white/70 px-6 py-12 text-center shadow-soft backdrop-blur">
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
