import { ImageOff } from "lucide-react";

import type { ImageItem, Batch } from "@/lib/types";
import { formatChinaDate } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

export function ImageGrid({
  items,
  selectedIds,
  onToggle,
  onOpen,
  batches,
}: {
  items: ImageItem[];
  selectedIds: number[];
  onToggle: (imageId: number, checked: boolean) => void;
  onOpen: (imageId: number) => void;
  batches?: Batch[];
}) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border border-dashed border-border/60 bg-white/80 text-center shadow-soft backdrop-blur">
        <ImageOff className="mb-4 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">这个筛选条件下还没有图片</p>
        <p className="mt-2 text-sm text-muted-foreground">先上传一个批次，或者放宽筛选条件。</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map((item) => {
        const checked = selectedIds.includes(item.id);
        return (
          <article key={item.id} className="group overflow-hidden rounded-[26px] border border-border/50 bg-white/90 shadow-soft backdrop-blur transition-all duration-200 hover:-translate-y-1.5 hover:border-primary/20 hover:shadow-float">
            <div className="relative">
              <img src={item.preview_url} alt={item.filename} className="h-56 w-full cursor-pointer object-cover" onClick={() => onOpen(item.id)} />
              <div className="absolute left-3 top-3">
                <Checkbox checked={checked} onCheckedChange={(value) => onToggle(item.id, Boolean(value))} />
              </div>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <button className="line-clamp-1 font-medium transition-colors hover:text-primary group-hover:text-primary/80" onClick={() => onOpen(item.id)}>
                  {item.filename}
                </button>
                <div className="mt-1 flex items-center gap-2">
                  <p className="line-clamp-1 flex-1 text-xs text-muted-foreground">{item.relative_path}</p>
                  {batches && (
                    <span className="shrink-0 rounded-md bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary/70 ring-1 ring-primary/10">
                      {batches.find(b => b.id === item.batch_id)?.name || '未知批次'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{item.width} × {item.height}</span>
                <span>{formatChinaDate(item.created_at)}</span>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="rounded-full bg-secondary px-2 py-1 text-secondary-foreground">描述 {item.description_count}</span>
                <span className="rounded-full bg-accent px-2 py-1 text-accent-foreground">问题 {item.question_count}</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
