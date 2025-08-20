import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/Navigation";
import { AuthProvider } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
import NotFound from "./pages/NotFound";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import { ThemeToggle } from "./components/ThemeToggle";
import { FixedHeader } from "./components/FixedHeader";


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
            <FixedHeader />
            <div className="pt-[73px]">
              <Routes>
              {/* Public route - only accessible when not authenticated */}
              <Route path="/" element={<Auth />} />
              
              {/* Protected routes - require authentication */}
              <Route path="/onboarding" element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/messages" element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              } />
              <Route path="/fans" element={
                <ProtectedRoute>
                  <Fans />
                </ProtectedRoute>
              } />
              <Route path="/fans/categories" element={
                <ProtectedRoute>
                  <FansCategories />
                </ProtectedRoute>
              } />
              <Route path="/fans/lists" element={
                <ProtectedRoute>
                  <FansLists />
                </ProtectedRoute>
              } />
              <Route path="/fans/lists/:listId" element={
                <ProtectedRoute>
                  <FanListDetail />
                </ProtectedRoute>
              } />
              <Route path="/pending-signups" element={
                <ProtectedRoute>
                  <PendingSignups />
                </ProtectedRoute>
              } />
              <Route path="/library" element={
                <ProtectedRoute>
                  <ContentLibrary />
                </ProtectedRoute>
              } />
              <Route path="/upload" element={
                <ProtectedRoute>
                  <Upload />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/management/users" element={
                <ProtectedRoute>
                  <Users />
                </ProtectedRoute>
              } />
            <Route path="/management/pending-deletions" element={
              <ProtectedRoute>
                <PendingDeletions />
              </ProtectedRoute>
            } />
            <Route path="/fan-deletions" element={
              <ProtectedRoute>
                <FanDeletions />
              </ProtectedRoute>
            } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              
              {/* Catch-all route */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </SidebarProvider>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
