import { toast } from "sonner";

export function ToastStateProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useToast() {
  const getDuration = (title: string, description?: string) => {
    if (title.includes("失败") || title.includes("错误")) return 9000;
    if (description && description.length > 80) return 8000;
    return 6500;
  };

  return {
    push: (title: string, description?: string) => {
      const options = {
        description,
        duration: getDuration(title, description),
      };
      if (title.includes("失败") || title.includes("错误")) {
        toast.error(title, options);
        return;
      }
      if (
        title.includes("成功") ||
        title.includes("完成") ||
        title.includes("已保存") ||
        title.includes("已删除") ||
        title.includes("已创建") ||
        title.includes("已添加")
      ) {
        toast.success(title, options);
        return;
      }
      toast(title, options);
    },
  };
}
