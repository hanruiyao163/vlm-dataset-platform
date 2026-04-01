import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      visibleToasts={4}
      offset={24}
      gap={10}
      toastOptions={{
        duration: 6500,
        className:
          "font-medium rounded-2xl border border-white/75 shadow-[0_18px_48px_rgba(27,34,46,0.18),0_4px_16px_rgba(27,34,46,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/95",
        style: {
          padding: "16px 18px",
          minWidth: "360px",
        },
      }}
    />
  );
}
