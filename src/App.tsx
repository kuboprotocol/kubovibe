import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { lazy, Suspense, forwardRef } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AdGate from "@/components/AdGate";

// Lazy loading all pages
const Index = lazy(() => import("./pages/Index"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const BuilderPage = lazy(() => import("./pages/BuilderPage"));
const CanvasPage = lazy(() => import("./pages/CanvasPage"));
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
const EmailDashboardPage = lazy(() => import("./pages/EmailDashboardPage"));
const PlanPage = lazy(() => import("./pages/PlanPage"));
const SharedAuditPage = lazy(() => import("./pages/SharedAuditPage"));
const GamePage = lazy(() => import("./pages/GamePage"));
const GameEditorPage = lazy(() => import("./pages/GameEditorPage"));
const GameRetroPage = lazy(() => import("./pages/GameRetroPage"));
const GameRpgPage = lazy(() => import("./pages/GameRpgPage"));
const GameMetaversePage = lazy(() => import("./pages/GameMetaversePage"));
const GameSdkPage = lazy(() => import("./pages/GameSdkPage"));
const GameVrPage = lazy(() => import("./pages/GameVrPage"));
const GameAiPage = lazy(() => import("./pages/GameAiPage"));
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
const AdminDeployPage = lazy(() => import("./pages/AdminDeployPage"));
const OrchestratorPage = lazy(() => import("./pages/OrchestratorPage"));
const PwaTelemetryPage = lazy(() => import("./pages/PwaTelemetry"));
const PwaExportJobDetailsPage = lazy(() => import("./pages/PwaExportJobDetails"));
const DocsPage = lazy(() => import("./pages/DocsPage"));
const VibeCodePage = lazy(() => import("./pages/VibeCodePage"));
const MobileAgentPage = lazy(() => import("./pages/MobileAgentPage"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="text-sm text-muted-foreground animate-pulse">Loading Kubo Vibe...</p>
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
// Redirect logic moved to a separate safety check to prevent loops
if (typeof window !== 'undefined') {
  const host = window.location.hostname
  const searchParams = new URLSearchParams(window.location.search)
  const isLovableApp = /(^|\.)lovable\.app$/i.test(host)
  
  // Track redirect history in sessionStorage to catch client-side loops
  const REDIRECT_KEY = 'vibe_redirect_count'
  const redirectCount = parseInt(sessionStorage.getItem(REDIRECT_KEY) || '0', 10)
  
  if (redirectCount > 3) {
    console.error('Redirect loop detected. Stopping redirects.')
    sessionStorage.removeItem(REDIRECT_KEY)
  } else if (
    host === 'localhost' || 
    host === '127.0.0.1' || 
    host.includes('lovableproject.com') ||
    host.includes('lovable.app') ||
    host === 'kubovibe.dev' ||
    host === 'www.kubovibe.dev'
  ) {
    // Development, internal domains, or canonical domains - no redirect
    sessionStorage.removeItem(REDIRECT_KEY)
  } else {
    sessionStorage.setItem(REDIRECT_KEY, (redirectCount + 1).toString())
    const target = `https://kubovibe.dev${window.location.pathname}${window.location.search}${window.location.hash}`
    window.location.replace(target)
  }
}

// Global hook to catch navigation loops or unexpected crashes
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const errorMsg = event.message || '';
    if (errorMsg.includes('Redirect loop') || errorMsg.includes('Too many redirects')) {
      console.error('Critical navigation error caught globally:', errorMsg);
      
      // Metrics/Logs: Send to a hypothetical logging endpoint or telemetry page
      // In this app, we can use the PwaTelemetry logic if it exists
      const telemetryData = {
        type: 'redirect_loop_error',
        message: errorMsg,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };
      
      console.info('[Telemetry] Logging redirect loop error:', telemetryData);
      
      // Attempt recovery: Clear redirect counter and reload after a delay
      const REDIRECT_KEY = 'vibe_redirect_count';
      sessionStorage.setItem(REDIRECT_KEY, '0');
    }
  });

  // Also log successful loads in preview for baseline metrics
  const isPreview = window.location.hostname.includes('lovable.app') || window.location.search.includes('mock_preview=true');
  if (isPreview) {
    console.info(`[Metrics] App loaded on preview domain: ${window.location.hostname}`);
    
    // Check if we recovered from a loop recently
    const REDIRECT_KEY = 'vibe_redirect_count';
    const lastCount = sessionStorage.getItem(REDIRECT_KEY);
    if (lastCount && parseInt(lastCount, 10) > 0) {
      console.warn(`[Metrics] App recovered after ${lastCount} redirect attempts.`);
      sessionStorage.removeItem(REDIRECT_KEY);
    }
  }
}

// Marker for hydration verification
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const root = document.getElementById('root');
    if (root) {
      // Small delay to ensure React starts mounting and attribute is set
      setTimeout(() => {
        root.setAttribute('data-hydrated', 'true');
      }, 200);
    }
  });
}

const App = forwardRef<HTMLDivElement, any>((props, ref) => {
  return (

    <QueryClientProvider client={queryClient}>
      <div ref={ref}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AdGate />
            <ErrorBoundary global resourceName="App">
              <Suspense fallback={<PageLoader />}>


              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/support" element={<SupportPage />} />
                <Route path="/docs" element={<DocsPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                
                <Route path="/m" element={<ProtectedRoute><MobileAgentPage /></ProtectedRoute>} />
                <Route path="/mobile" element={<ProtectedRoute><MobileAgentPage /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/builder" element={<ProtectedRoute><BuilderPage /></ProtectedRoute>} />
                <Route path="/builder/:projectId" element={<ProtectedRoute><BuilderPage /></ProtectedRoute>} />
                <Route path="/canvas" element={<ProtectedRoute><CanvasPage /></ProtectedRoute>} />
                <Route path="/canvas/:canvasId" element={<ProtectedRoute><CanvasPage /></ProtectedRoute>} />
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
                <Route path="/game" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
                <Route path="/game/editor" element={<ProtectedRoute><GameEditorPage /></ProtectedRoute>} />
                <Route path="/game/retro" element={<ProtectedRoute><GameRetroPage /></ProtectedRoute>} />
                <Route path="/game/rpg" element={<ProtectedRoute><GameRpgPage /></ProtectedRoute>} />
                <Route path="/game/metaverse" element={<ProtectedRoute><GameMetaversePage /></ProtectedRoute>} />
                <Route path="/game/sdk" element={<ProtectedRoute><GameSdkPage /></ProtectedRoute>} />
                <Route path="/game/vr" element={<ProtectedRoute><GameVrPage /></ProtectedRoute>} />
                <Route path="/game/ai" element={<ProtectedRoute><GameAiPage /></ProtectedRoute>} />
                <Route path="/admin/skills" element={<ProtectedRoute requireRoles={["admin"]}><AdminSkillsPage /></ProtectedRoute>} />
                <Route path="/domains" element={<ProtectedRoute><DomainsPage /></ProtectedRoute>} />
                <Route path="/vibe-code" element={<ProtectedRoute><VibeCodePage /></ProtectedRoute>} />
                
                <Route path="/creative" element={<ProtectedRoute><CreativePage /></ProtectedRoute>} />
                <Route path="/creative/investigation" element={<ProtectedRoute><ErrorBoundary resourceName="InvestigationPage"><InvestigationPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/creative/audit" element={<ProtectedRoute><ErrorBoundary resourceName="AuditTrailPage"><AuditTrailPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/creative/presets" element={<ProtectedRoute><ErrorBoundary resourceName="PresetsPage"><PresetsPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/creative/notifications" element={<ProtectedRoute><NotificationPreferencesPage /></ProtectedRoute>} />
                <Route path="/creative/exports/:id" element={<ProtectedRoute><ErrorBoundary resourceName="ExportDetailsPage"><ExportDetailsPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/creative/:tool" element={<ProtectedRoute><CreativePage /></ProtectedRoute>} />
                
                <Route path="/agents" element={<ProtectedRoute><AgentsHubPage /></ProtectedRoute>} />
                <Route path="/agents/:slug" element={<ProtectedRoute><AgentDetailPage /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute requireRoles={["admin"]}><AdminPage /></ProtectedRoute>} />
                <Route path="/admin/deploy" element={<ProtectedRoute requireRoles={["admin"]}><AdminDeployPage /></ProtectedRoute>} />
                <Route path="/orchestrator" element={<ProtectedRoute requireRoles={["admin"]}><OrchestratorPage /></ProtectedRoute>} />
                <Route path="/pwa/telemetry" element={<ProtectedRoute requireRoles={["admin"]}><PwaTelemetryPage /></ProtectedRoute>} />
                <Route path="/pwa/telemetry/jobs/:jobId" element={<ProtectedRoute requireRoles={["admin"]}><PwaExportJobDetailsPage /></ProtectedRoute>} />

                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>

      </AuthProvider>
    </TooltipProvider>
      </div>
    </QueryClientProvider>
  );
});

export default App;