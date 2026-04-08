import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import BuilderPage from "./pages/BuilderPage";
import ProfilePage from "./pages/ProfilePage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import NotFound from "./pages/NotFound";
import PricingPage from "./pages/PricingPage";
import SupportPage from "./pages/SupportPage";
import ConnectPage from "./pages/ConnectPage";
import ShortlinksPage from "./pages/ShortlinksPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import PublicAppPage from "./pages/PublicAppPage";
import UnsubscribePage from "./pages/UnsubscribePage";
import EmailDashboardPage from "./pages/EmailDashboardPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/builder" element={<ProtectedRoute><BuilderPage /></ProtectedRoute>} />
            <Route path="/builder/:projectId" element={<ProtectedRoute><BuilderPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/connect" element={<ProtectedRoute><ConnectPage /></ProtectedRoute>} />
            <Route path="/shortlinks" element={<ProtectedRoute><ShortlinksPage /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
            <Route path="/app/:projectId" element={<PublicAppPage />} />
            <Route path="/app/:projectId/:slug" element={<PublicAppPage />} />
            <Route path="/unsubscribe" element={<UnsubscribePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
