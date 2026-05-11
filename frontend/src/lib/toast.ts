import { toast } from "sonner";

type ToastType = "success" | "error" | "info";

function getDuration(type: ToastType, description?: string) {
  if (type === "error") return 4000;
  if (description && description.length > 80) return 2500;
  return 2000;
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
