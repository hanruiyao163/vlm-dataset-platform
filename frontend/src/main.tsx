import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ToastStateProvider } from "@/hooks/use-toast";
import { router } from "@/router";
import "@/styles.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <ToastStateProvider>
          <RouterProvider router={router} />
          <Toaster position="top-right" richColors closeButton visibleToasts={4} offset={24} gap={10} />
        </ToastStateProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
