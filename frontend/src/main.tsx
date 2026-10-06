import "./shared/styles.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, type ReactNode, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider, isManager, useAuth } from "./app/auth";
import Layout from "./app/Layout";
import { LoginPage, RegisterPage } from "./features/auth/AuthPages";
import LandingPage from "./features/auth/LandingPage";
import { ApiError } from "./shared/api";
import { MetaProvider } from "./shared/meta";
import { Skeleton, ToastProvider } from "./shared/ui";

const Dashboard = lazy(() => import("./features/dashboard/Dashboard"));
const DepartmentHome = lazy(() => import("./features/dashboard/DepartmentHome"));
const TasksPage = lazy(() => import("./features/tasks/TasksPage"));
const BoardPage = lazy(() => import("./features/tasks/BoardPage"));
const ReviewPage = lazy(() => import("./features/tasks/ReviewPage"));
const OrdersPage = lazy(() => import("./features/orders/OrdersPage"));
const ProjectsPage = lazy(() => import("./features/projects/ProjectsPage"));
const CalendarPage = lazy(() => import("./features/calendar/CalendarPage"));
const PeoplePage = lazy(() => import("./features/people/PeoplePage"));
const ProfilePage = lazy(() => import("./features/people/ProfilePage"));
const WorkDonePage = lazy(() => import("./features/history/WorkDonePage"));
const SuggestionsPage = lazy(() => import("./features/suggestions/SuggestionsPage"));
const MessagesPage = lazy(() => import("./features/chat/MessagesPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
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
          <Route path="/" element={<LandingPage />} />
          <Route path="/kirish" element={<LoginPage />} />
          <Route path="/royxatdan-otish" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route element={<Layout />}>
            <Route index element={page(dept ? <DepartmentHome /> : <Dashboard />)} />
            {!dept && <Route path="vazifalar" element={page(<TasksPage />)} />}
            {!dept && <Route path="taqvim" element={page(<CalendarPage />)} />}
            {dev && <Route path="mening-ishim" element={page(<BoardPage />)} />}
            {manager && <Route path="tekshiruv" element={page(<ReviewPage />)} />}
            {manager && <Route path="loyihalar" element={page(<ProjectsPage />)} />}
            {manager && <Route path="xodimlar" element={page(<PeoplePage />)} />}
            {(manager || dept) && <Route path="buyurtmalar" element={page(<OrdersPage />)} />}
            <Route path="takliflar" element={page(<SuggestionsPage />)} />
            <Route path="xabarlar" element={page(<MessagesPage />)} />
            <Route path="profil" element={page(<ProfilePage />)} />
            {manager && <Route path="qilingan-ishlar" element={page(<WorkDonePage />)} />}
            <Route path="*" element={<Navigate to="/" replace />} />
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
