import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,252,246,0.94),rgba(244,232,214,0.88))] shadow-soft backdrop-blur ${
        compact ? "p-4 md:p-5" : "mb-6 p-6 md:p-8"
      }`}
    >
      <div className="absolute inset-y-0 right-0 hidden w-72 bg-[radial-gradient(circle_at_center,_rgba(201,97,37,0.18),_transparent_62%)] lg:block" />
      <div className="absolute -left-12 top-0 h-28 w-28 rounded-full bg-white/45 blur-2xl" />
      <div className={`relative flex flex-col md:flex-row md:items-end md:justify-between ${compact ? "gap-3" : "gap-5"}`}>
        <div>
          <p className={`font-semibold uppercase tracking-[0.32em] text-primary/80 ${compact ? "mb-2 text-[10px]" : "mb-3 text-[11px]"}`}>{eyebrow}</p>
          <h2 className={`max-w-3xl font-semibold tracking-tight text-foreground ${compact ? "text-2xl md:text-[1.8rem]" : "text-3xl md:text-[2.2rem]"}`}>{title}</h2>
          <p className={`max-w-2xl text-sm text-muted-foreground ${compact ? "mt-2 leading-5" : "mt-3 leading-6"}`}>{description}</p>
        </div>
        {actions ? (
          <div className={`rounded-2xl border border-white/80 bg-white/55 shadow-sm ${compact ? "p-1" : "p-1.5"}`}>
            <div className={`flex flex-wrap items-center ${compact ? "gap-2" : "gap-3"}`}>{actions}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
