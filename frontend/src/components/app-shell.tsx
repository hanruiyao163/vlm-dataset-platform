import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { FolderKanban, History, Image, Sparkles, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/logs", label: "Logs", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1760px] gap-4 px-3 py-4 lg:px-4">
        <aside className="sticky top-4 hidden w-64 shrink-0 self-start rounded-[32px] border border-white/70 bg-[linear-gradient(180deg,rgba(24,32,45,0.96),rgba(41,52,68,0.92))] p-5 text-white shadow-float lg:block">
          <div className="mb-8 rounded-[28px] border border-white/10 bg-white/5 p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-primary/90 p-2.5 text-primary-foreground shadow-soft">
                <Image className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-white/50">Dataset Workbench</p>
                <h1 className="font-semibold text-white">VLM图像数据集平台</h1>
              </div>
            </div>
            <div className="rounded-2xl bg-white/[0.06] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/90">
                <Sparkles className="h-4 w-4 text-[#f0b36b]" />
                生产流程
              </div>
              <p className="text-sm leading-6 text-white/65">
                从项目创建、批量导图、描述与问题生成，到最终 数据集 导出，全部在一个工作台里完成。
              </p>
            </div>
          </div>
          <nav className="space-y-2.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-medium transition-all duration-200",
                    active
                      ? "border-white/15 bg-white/12 text-white shadow-soft"
                      : "border-transparent text-white/72 hover:border-white/10 hover:bg-white/8 hover:text-white",
                  )}
                >
                  <span
                    className={cn(
                      "rounded-xl p-2",
                      active ? "bg-primary/90 text-primary-foreground" : "bg-white/10 text-white/80",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between rounded-[26px] border border-white/70 bg-white/65 px-5 py-4 shadow-soft backdrop-blur lg:hidden">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/90 p-2 text-primary-foreground">
                <Image className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Workbench</p>
                <h1 className="text-sm font-semibold">VLM图像数据集平台</h1>
              </div>
            </div>
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-[24px] border px-4 py-3.5 shadow-soft backdrop-blur transition-all",
                    active
                      ? "border-primary/30 bg-white/90"
                      : "border-white/70 bg-white/65 hover:bg-white/90",
                  )}
                >
                  <span className={cn("rounded-2xl p-2", active ? "bg-primary text-primary-foreground" : "bg-secondary")}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
