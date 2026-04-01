import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { DashboardPage } from "@/pages/dashboard-page";
import { LogsPage } from "@/pages/logs-page";
import { ProjectExportPage } from "@/pages/project-export-page";
import { ProjectImagesPage } from "@/pages/project-images-page";
import { ProjectOverviewPage } from "@/pages/project-overview-page";
import { SettingsPage } from "@/pages/settings-page";

const rootRoute = createRootRoute({ component: AppShell });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: DashboardPage });
const projectsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects", component: DashboardPage });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: SettingsPage });
const logsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/logs",
  validateSearch: (search: Record<string, unknown>) => ({
    projectId: typeof search.projectId === "string" ? search.projectId : undefined,
    batchId: typeof search.batchId === "string" ? search.batchId : undefined,
    taskType: typeof search.taskType === "string" ? search.taskType : undefined,
    status: typeof search.status === "string" ? search.status : undefined,
  }),
  component: LogsRouteComponent,
});
const projectOverviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
  component: ProjectOverviewRouteComponent,
});
const projectImagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId/images",
  validateSearch: (search: Record<string, unknown>) => ({
    batchId: typeof search.batchId === "string" ? search.batchId : undefined,
    hasDescriptions: typeof search.hasDescriptions === "string" ? search.hasDescriptions : undefined,
    hasQuestions: typeof search.hasQuestions === "string" ? search.hasQuestions : undefined,
    offset: typeof search.offset === "number" ? search.offset : Number(search.offset ?? 0),
  }),
  component: ProjectImagesRouteComponent,
});
const projectExportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId/export",
  component: ProjectExportRouteComponent,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  projectsRoute,
  settingsRoute,
  logsRoute,
  projectOverviewRoute,
  projectImagesRoute,
  projectExportRoute,
]);

export const router = createRouter({ routeTree });

function ProjectOverviewRouteComponent() {
  const { projectId } = projectOverviewRoute.useParams();
  return <ProjectOverviewPage projectId={Number(projectId)} />;
}

function ProjectImagesRouteComponent() {
  const { projectId } = projectImagesRoute.useParams();
  const search = projectImagesRoute.useSearch();
  return <ProjectImagesPage projectId={Number(projectId)} search={search} />;
}

function ProjectExportRouteComponent() {
  const { projectId } = projectExportRoute.useParams();
  return <ProjectExportPage projectId={Number(projectId)} />;
}

function LogsRouteComponent() {
  const search = logsRoute.useSearch();
  return <LogsPage search={search} />;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
