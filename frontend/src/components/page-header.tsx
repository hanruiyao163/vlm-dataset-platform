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
      className={`relative overflow-hidden rounded-[32px] border border-border/50 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(240,242,248,0.94))] shadow-soft backdrop-blur-xl ${compact ? "p-4 md:p-5" : "mb-6 p-6 md:p-8"
        }`}
    >
      <div className="absolute inset-y-0 right-0 hidden w-80 bg-[radial-gradient(circle_at_center,_rgba(99,91,190,0.06),_transparent_64%)] lg:block" />
      <div className="absolute -left-12 top-0 h-28 w-28 rounded-full bg-white/55 blur-2xl" />
      <div className="absolute bottom-0 right-16 h-24 w-24 rounded-full bg-primary/5 blur-3xl" />
      <div className={`relative flex flex-col md:flex-row md:items-end md:justify-between ${compact ? "gap-3" : "gap-5"}`}>
        <div>
          <p className={`font-semibold uppercase tracking-[0.32em] text-primary/75 ${compact ? "mb-2 text-[10px]" : "mb-3 text-[11px]"}`}>{eyebrow}</p>
          <h2 className={`max-w-3xl font-semibold tracking-tight text-foreground ${compact ? "text-2xl md:text-[1.8rem]" : "text-3xl md:text-[2.2rem]"}`}>{title}</h2>
          <p className={`max-w-2xl text-sm text-muted-foreground ${compact ? "mt-2 leading-5" : "mt-3 leading-6"}`}>{description}</p>
        </div>
        {actions ? (
          <div className={`rounded-[22px] border border-border/40 bg-white/72 shadow-sm backdrop-blur ${compact ? "p-1" : "p-1.5"}`}>
            <div className={`flex flex-wrap items-center ${compact ? "gap-2" : "gap-3"}`}>{actions}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
