import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/Navigation";
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
import NotFound from "./pages/NotFound";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PWAInstallPrompt />
      <BrowserRouter>
        <SidebarProvider>
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/fans" element={<Fans />} />
            <Route path="/fans/categories" element={<FansCategories />} />
            <Route path="/fans/lists" element={<FansLists />} />
            <Route path="/library" element={<ContentLibrary />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/management/users" element={<Users />} />
            <Route path="/management/pending-deletions" element={<PendingDeletions />} />
            <Route path="/profile" element={<Profile />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SidebarProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
