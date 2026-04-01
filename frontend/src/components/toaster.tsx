import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      expand
      visibleToasts={5}
      offset={20}
      toastOptions={{
        duration: 6500,
        className:
          "font-medium border border-white/70 shadow-[0_18px_48px_rgba(27,34,46,0.18)] backdrop-blur supports-[backdrop-filter]:bg-white/95",
        style: {
          padding: "16px 18px",
          minWidth: "360px",
        },
      }}
    />
  );
}
