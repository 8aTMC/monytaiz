import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/Navigation";
import { AuthProvider } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Messages from "./pages/Messages";
import Fans from "./pages/Fans";
import ContentLibrary from "./pages/ContentLibrary";
import AdminDashboard from "./pages/AdminDashboard";
import Users from "./pages/Users";
import Profile from "./pages/Profile";
import Upload from "./pages/Upload";
import FansCategories from "./pages/FansCategories";
import FansLists from "./pages/FansLists";
import PendingDeletions from "./pages/PendingDeletions";
import FanDeletions from "./pages/FanDeletions";
import PendingSignups from "./pages/PendingSignups";
import FanListDetail from "./pages/FanListDetail";
import FanDashboard from "./pages/FanDashboard";
import NotFound from "./pages/NotFound";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <PWAInstallPrompt />
        <BrowserRouter>
          <SidebarProvider>
            <Routes>
              {/* Public routes - no layout */}
              <Route path="/" element={<Auth />} />
              
              {/* Protected routes with layout */}
              <Route path="/onboarding" element={
                <ProtectedRoute>
                  <Layout>
                    <Onboarding />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/messages" element={
                <ProtectedRoute>
                  <Layout>
                    <Messages />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/fans" element={
                <ProtectedRoute>
                  <Layout>
                    <Fans />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/fans/categories" element={
                <ProtectedRoute>
                  <Layout>
                    <FansCategories />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/fans/lists" element={
                <ProtectedRoute>
                  <Layout>
                    <FansLists />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/fans/lists/:listId" element={
                <ProtectedRoute>
                  <Layout>
                    <FanListDetail />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/pending-signups" element={
                <ProtectedRoute>
                  <Layout>
                    <PendingSignups />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/library" element={
                <ProtectedRoute>
                  <Layout>
                    <ContentLibrary />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/upload" element={
                <ProtectedRoute>
                  <Layout>
                    <Upload />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute>
                  <Layout>
                    <AdminDashboard />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/management/users" element={
                <ProtectedRoute>
                  <Layout>
                    <Users />
                  </Layout>
                </ProtectedRoute>
              } />
            <Route path="/management/pending-deletions" element={
              <ProtectedRoute>
                <Layout>
                  <PendingDeletions />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/fan-deletions" element={
              <ProtectedRoute>
                <Layout>
                  <FanDeletions />
                </Layout>
              </ProtectedRoute>
            } />
              <Route path="/fan-dashboard" element={
                <ProtectedRoute>
                  <Layout>
                    <FanDashboard />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </ProtectedRoute>
              } />
              
                {/* Catch-all route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
          </SidebarProvider>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
