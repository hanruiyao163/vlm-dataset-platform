import { toast } from "sonner";

type ToastType = "success" | "error" | "info";

function getDuration(type: ToastType, description?: string) {
  if (type === "error") return 9000;
  if (description && description.length > 80) return 8000;
  return 6500;
}

export const appToast = {
  success(title: string, description?: string) {
    toast.success(title, {
      description,
      duration: getDuration("success", description),
    });
  },
  error(title: string, description?: string) {
    toast.error(title, {
      description,
      duration: getDuration("error", description),
    });
  },
  info(title: string, description?: string) {
    toast(title, {
      description,
      duration: getDuration("info", description),
    });
  },
};
