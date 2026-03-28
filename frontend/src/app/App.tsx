import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/app/layout/AppLayout";
import NotFoundPage from "@/app/routes/NotFoundPage";
import DashboardPage from "@/features/dashboard/pages/DashboardPage";
import AnalyticsTracker from "@/shared/components/AnalyticsTracker";
import { DataProvider } from "@/shared/data/DataContext";

const queryClient = new QueryClient();
const UploadPage = lazy(() => import("@/features/upload/pages/UploadPage"));
const ChatPage = lazy(() => import("@/features/chat/pages/ChatPage"));
const ExplorerPage = lazy(() => import("@/features/explorer/pages/ExplorerPage"));
const AnalysisPage = lazy(() => import("@/features/analysis/pages/AnalysisPage"));

const RouteFallback = ({ label }: { label: string }) => (
  <div className="flex h-full min-h-[320px] items-center justify-center p-6 text-sm text-muted-foreground">
    {label}
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <DataProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AnalyticsTracker />
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route
                path="/upload"
                element={
                  <Suspense fallback={<RouteFallback label="Loading upload..." />}>
                    <UploadPage />
                  </Suspense>
                }
              />
              <Route
                path="/explorer"
                element={
                  <Suspense fallback={<RouteFallback label="Loading explorer..." />}>
                    <ExplorerPage />
                  </Suspense>
                }
              />
              <Route
                path="/analysis"
                element={
                  <Suspense fallback={<RouteFallback label="Loading analysis..." />}>
                    <AnalysisPage />
                  </Suspense>
                }
              />
              <Route
                path="/chat"
                element={
                  <Suspense fallback={<RouteFallback label="Loading chat..." />}>
                    <ChatPage />
                  </Suspense>
                }
              />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </DataProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
