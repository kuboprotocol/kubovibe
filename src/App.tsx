import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Lazy loading all pages
const Index = lazy(() => import("./pages/Index"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const BuilderPage = lazy(() => import("./pages/BuilderPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const ConnectPage = lazy(() => import("./pages/ConnectPage"));
const ConnectorsHubPage = lazy(() => import("./pages/ConnectorsHubPage"));
const ConnectorDetailPage = lazy(() => import("./pages/ConnectorDetailPage"));
const ConnectorAboutPage = lazy(() => import("./pages/ConnectorAboutPage"));
const ConnectorSetupPage = lazy(() => import("./pages/ConnectorSetupPage"));
const ConnectorWeb3Page = lazy(() => import("./pages/ConnectorWeb3Page"));
const ConnectorWeb3HubPage = lazy(() => import("./pages/ConnectorWeb3HubPage"));
const ConnectorGmailPage = lazy(() => import("./pages/ConnectorGmailPage"));
const ConnectorSlackPage = lazy(() => import("./pages/ConnectorSlackPage"));
const ConnectorRenderPage = lazy(() => import("./pages/ConnectorRenderPage"));
const ShortlinksPage = lazy(() => import("./pages/ShortlinksPage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const PublicAppPage = lazy(() => import("./pages/PublicAppPage"));
const UnsubscribePage = lazy(() => import("./pages/UnsubscribePage"));
const EmailDashboardPage = lazy(() => import("./pages/EmailDashboardPage"));
const PlanPage = lazy(() => import("./pages/PlanPage"));
const SharedAuditPage = lazy(() => import("./pages/SharedAuditPage"));
const GamePage = lazy(() => import("./pages/GamePage"));
const AdminSkillsPage = lazy(() => import("./pages/AdminSkillsPage"));
const DomainsPage = lazy(() => import("./pages/DomainsPage"));
const CreativePage = lazy(() => import("./pages/CreativePage"));
const InvestigationPage = lazy(() => import("./pages/creative/InvestigationPage"));
const AuditTrailPage = lazy(() => import("./pages/creative/AuditTrailPage"));
const PresetsPage = lazy(() => import("./pages/creative/PresetsPage"));
const NotificationPreferencesPage = lazy(() => import("./pages/creative/NotificationPreferencesPage"));
const ExportDetailsPage = lazy(() => import("./pages/creative/ExportDetailsPage"));
const AgentsHubPage = lazy(() => import("./pages/AgentsHubPage"));
const AgentDetailPage = lazy(() => import("./pages/AgentDetailPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const OrchestratorPage = lazy(() => import("./pages/OrchestratorPage"));
const PwaTelemetryPage = lazy(() => import("./pages/PwaTelemetry"));
const PwaExportJobDetailsPage = lazy(() => import("./pages/PwaExportJobDetails"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="text-sm text-muted-foreground animate-pulse">Carregando Kubo Vibe...</p>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Canonical-domain redirect
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




const App = () => {
  console.log("[App] Rendering root component");
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ErrorBoundary resourceName="App">
              <Suspense fallback={<PageLoader />}>


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
                <Route path="/pwa/telemetry" element={<ProtectedRoute><PwaTelemetryPage /></ProtectedRoute>} />
                <Route path="/pwa/telemetry/jobs/:jobId" element={<ProtectedRoute><PwaExportJobDetailsPage /></ProtectedRoute>} />

                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>

      </AuthProvider>
    </TooltipProvider>
    </QueryClientProvider>
  );
};




export default App;