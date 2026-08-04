import "./shared/styles.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, type ReactNode, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider, isManager, useAuth } from "./app/auth";
import Layout from "./app/Layout";
import { LoginPage, RegisterPage } from "./features/auth/AuthPages";
import { ApiError } from "./shared/api";
import { MetaProvider } from "./shared/meta";
import { Skeleton, ToastProvider } from "./shared/ui";

const Dashboard = lazy(() => import("./features/dashboard/Dashboard"));
const TasksPage = lazy(() => import("./features/tasks/TasksPage"));
const BoardPage = lazy(() => import("./features/tasks/BoardPage"));
const ReviewPage = lazy(() => import("./features/tasks/ReviewPage"));
const OrdersPage = lazy(() => import("./features/orders/OrdersPage"));
const ProjectsPage = lazy(() => import("./features/projects/ProjectsPage"));
const CalendarPage = lazy(() => import("./features/calendar/CalendarPage"));
const NotificationsPage = lazy(() => import("./features/notifications/NotificationsPage"));
const HistoryPage = lazy(() => import("./features/history/HistoryPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, err) => !(err instanceof ApiError && [401, 403, 404].includes(err.status)) && count < 2,
      refetchOnWindowFocus: true,
    },
  },
});

function Loading() {
  return (
    <div className="stack">
      <Skeleton h={28} w={240} />
      <Skeleton h={120} />
      <Skeleton h={320} />
    </div>
  );
}

function AppRoutes() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="page"><Loading /></div>;

  const manager = user ? isManager(user) : false;
  const dept = user?.role === "department";
  const dev = user?.role === "developer";
  const page = (el: ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>;

  return (
    <MetaProvider userKey={user ? user.id : "anon"}>
      {!user ? (
        <Routes>
          <Route path="/kirish" element={<LoginPage />} />
          <Route path="/royxatdan-otish" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/kirish" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route element={<Layout />}>
            <Route index element={dept ? <Navigate to="/buyurtmalar" replace /> : page(<Dashboard />)} />
            {!dept && <Route path="vazifalar" element={page(<TasksPage />)} />}
            {!dept && <Route path="taqvim" element={page(<CalendarPage />)} />}
            {dev && <Route path="mening-ishim" element={page(<BoardPage />)} />}
            {manager && <Route path="tekshiruv" element={page(<ReviewPage />)} />}
            {manager && <Route path="loyihalar" element={page(<ProjectsPage />)} />}
            {(manager || dept) && <Route path="buyurtmalar" element={page(<OrdersPage />)} />}
            <Route path="bildirishnomalar" element={page(<NotificationsPage />)} />
            <Route path="tarix" element={page(<HistoryPage />)} />
            <Route path="*" element={<Navigate to={dept ? "/buyurtmalar" : "/"} replace />} />
          </Route>
        </Routes>
      )}
    </MetaProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
