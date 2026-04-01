import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { Toaster } from "@/components/toaster";
import { ToastStateProvider } from "@/hooks/use-toast";
import { router } from "@/router";
import "@/styles.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastStateProvider>
        <RouterProvider router={router} />
        <Toaster />
      </ToastStateProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
