import { ImageOff } from "lucide-react";

import type { ImageItem } from "@/lib/types";
import { formatChinaDate } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

export function ImageGrid({
  items,
  selectedIds,
  onToggle,
  onOpen,
}: {
  items: ImageItem[];
  selectedIds: number[];
  onToggle: (imageId: number, checked: boolean) => void;
  onOpen: (imageId: number) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border border-dashed border-border bg-white/70 text-center">
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
          <article key={item.id} className="group overflow-hidden rounded-[24px] border border-white/60 bg-white/80 shadow-soft backdrop-blur">
            <div className="relative">
              <img src={item.preview_url} alt={item.filename} className="h-56 w-full cursor-pointer object-cover" onClick={() => onOpen(item.id)} />
              <div className="absolute left-3 top-3">
                <Checkbox checked={checked} onCheckedChange={(value) => onToggle(item.id, Boolean(value))} />
              </div>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <button className="line-clamp-1 font-medium hover:text-primary" onClick={() => onOpen(item.id)}>
                  {item.filename}
                </button>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.relative_path}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{item.width} × {item.height}</span>
                <span>{formatChinaDate(item.created_at)}</span>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="rounded-full bg-secondary px-2 py-1">描述 {item.description_count}</span>
                <span className="rounded-full bg-accent px-2 py-1">问题 {item.question_count}</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
