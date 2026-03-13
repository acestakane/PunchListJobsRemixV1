import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import { Toaster } from "sonner";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import CrewDashboard from "./pages/CrewDashboard";
import ContractorDashboard from "./pages/ContractorDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ProfilePage from "./pages/ProfilePage";
import SubscriptionPage from "./pages/SubscriptionPage";

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-[#050A30] flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7EC8E3]" />
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function DashboardRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth" replace />;
  if (user.role === "crew") return <Navigate to="/crew/dashboard" replace />;
  if (user.role === "contractor") return <Navigate to="/contractor/dashboard" replace />;
  if (user.role === "admin") return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/" element={user ? <DashboardRedirect /> : <LandingPage />} />
      <Route path="/auth" element={user ? <DashboardRedirect /> : <AuthPage />} />
      <Route path="/crew/dashboard" element={
        <ProtectedRoute roles={["crew"]}>
          <WebSocketProvider><CrewDashboard /></WebSocketProvider>
        </ProtectedRoute>
      } />
      <Route path="/contractor/dashboard" element={
        <ProtectedRoute roles={["contractor"]}>
          <WebSocketProvider><ContractorDashboard /></WebSocketProvider>
        </ProtectedRoute>
      } />
      <Route path="/admin/dashboard" element={
        <ProtectedRoute roles={["admin"]}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute><ProfilePage /></ProtectedRoute>
      } />
      <Route path="/subscription" element={
        <ProtectedRoute><SubscriptionPage /></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
