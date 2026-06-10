import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import ConnectorsHubPage from "./pages/ConnectorsHubPage";
import ConnectorDetailPage from "./pages/ConnectorDetailPage";
import ConnectorAboutPage from "./pages/ConnectorAboutPage";
import ConnectorSetupPage from "./pages/ConnectorSetupPage";
import ConnectorWeb3Page from "./pages/ConnectorWeb3Page";
import ConnectorWeb3HubPage from "./pages/ConnectorWeb3HubPage";
import ConnectorGmailPage from "./pages/ConnectorGmailPage";
import ConnectorSlackPage from "./pages/ConnectorSlackPage";
import ConnectorRenderPage from "./pages/ConnectorRenderPage";
import ShortlinksPage from "./pages/ShortlinksPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import PublicAppPage from "./pages/PublicAppPage";
import UnsubscribePage from "./pages/UnsubscribePage";
import EmailDashboardPage from "./pages/EmailDashboardPage";
import PlanPage from "./pages/PlanPage";
import SharedAuditPage from "./pages/SharedAuditPage";
import GamePage from "./pages/GamePage";
import AdminSkillsPage from "./pages/AdminSkillsPage";
import DomainsPage from "./pages/DomainsPage";
import CreativePage from "./pages/CreativePage";
import InvestigationPage from "./pages/creative/InvestigationPage";
import AuditTrailPage from "./pages/creative/AuditTrailPage";
import PresetsPage from "./pages/creative/PresetsPage";
import NotificationPreferencesPage from "./pages/creative/NotificationPreferencesPage";
import ExportDetailsPage from "./pages/creative/ExportDetailsPage";
import AgentsHubPage from "./pages/AgentsHubPage";
import AgentDetailPage from "./pages/AgentDetailPage";
import AdminPage from "./pages/AdminPage";
import OrchestratorPage from "./pages/OrchestratorPage";

const queryClient = new QueryClient();

// Canonical-domain redirect: any traffic landing on the lovable.app fallback
// hostname is bounced to the branded custom domain. Production-safe (only fires
// in the browser and only when the host actually contains "lovable.app").
if (typeof window !== 'undefined') {
  const host = window.location.hostname
  const previewHost = 'preview--kubo-secure-ai.lovable.app'
  if (host === previewHost) {
    // Already on the preview domain
  } else if (/(^|\.)lovable\.app$/i.test(host) && !host.startsWith('id-preview--')) {
    const target = `https://kubovibe.dev${window.location.pathname}${window.location.search}${window.location.hash}`
    window.location.replace(target)
  }
}

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
            <Route path="/connectors" element={<ProtectedRoute><ConnectorsHubPage /></ProtectedRoute>} />
            <Route path="/connectors/web3" element={<ProtectedRoute><ConnectorWeb3HubPage /></ProtectedRoute>} />
            <Route path="/connectors/web3/:provider" element={<ProtectedRoute><ConnectorWeb3Page /></ProtectedRoute>} />
            <Route path="/connectors/gmail" element={<ProtectedRoute><ConnectorGmailPage /></ProtectedRoute>} />
            <Route path="/connectors/slack" element={<ProtectedRoute><ConnectorSlackPage /></ProtectedRoute>} />
            <Route path="/connectors/render" element={<ProtectedRoute><ConnectorRenderPage /></ProtectedRoute>} />
            <Route path="/connectors/:slug/setup" element={<ProtectedRoute><ConnectorSetupPage /></ProtectedRoute>} />
            <Route path="/connectors/:slug/about" element={<ProtectedRoute><ConnectorAboutPage /></ProtectedRoute>} />
            <Route path="/connectors/:slug" element={<ProtectedRoute><ConnectorDetailPage /></ProtectedRoute>} />
            <Route path="/shortlinks" element={<ProtectedRoute><ShortlinksPage /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
            <Route path="/emails" element={<ProtectedRoute><EmailDashboardPage /></ProtectedRoute>} />
            <Route path="/plan/:id" element={<ProtectedRoute><PlanPage /></ProtectedRoute>} />
            <Route path="/app/:projectId" element={<PublicAppPage />} />
            <Route path="/app/:projectId/:slug" element={<PublicAppPage />} />
            <Route path="/unsubscribe" element={<UnsubscribePage />} />
            <Route path="/game" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
            <Route path="/admin/skills" element={<ProtectedRoute><AdminSkillsPage /></ProtectedRoute>} />
            <Route path="/domains" element={<ProtectedRoute><DomainsPage /></ProtectedRoute>} />
            <Route path="/creative" element={<ProtectedRoute><CreativePage /></ProtectedRoute>} />
            <Route path="/creative/investigation" element={<ProtectedRoute><ErrorBoundary resourceName="InvestigationPage"><InvestigationPage /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/creative/audit" element={<ProtectedRoute><ErrorBoundary resourceName="AuditTrailPage"><AuditTrailPage /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/creative/presets" element={<ProtectedRoute><ErrorBoundary resourceName="PresetsPage"><PresetsPage /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/creative/notifications" element={<ProtectedRoute><NotificationPreferencesPage /></ProtectedRoute>} />
            <Route path="/creative/exports/:id" element={<ProtectedRoute><ErrorBoundary resourceName="ExportDetailsPage"><ExportDetailsPage /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/creative/:tool" element={<ProtectedRoute><CreativePage /></ProtectedRoute>} />
            <Route path="/agents" element={<ProtectedRoute><AgentsHubPage /></ProtectedRoute>} />
            <Route path="/agents/:slug" element={<ProtectedRoute><AgentDetailPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
            <Route path="/orchestrator" element={<ProtectedRoute><OrchestratorPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
