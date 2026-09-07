import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./components/theme-provider";
import { Navigation } from "./components/navigation";
import { AuthProvider } from "./auth-provider";
import { ProtectedRoute } from "./protected-route";
import { lazy, Suspense, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

const LandingPage = lazy(() => import("./components/landing-page").then((module) => ({ default: module.LandingPage })));
const LoginPage = lazy(() => import("./components/login-page").then((module) => ({ default: module.LoginPage })));
const SignupPage = lazy(() => import("./components/signup-page").then((module) => ({ default: module.SignupPage })));
const UploadPage = lazy(() => import("./components/upload-page").then((module) => ({ default: module.UploadPage })));
const DashboardPage = lazy(() => import("./components/dashboard-page").then((module) => ({ default: module.DashboardPage })));
const AnalysisPage = lazy(() => import("./components/analysis-page").then((module) => ({ default: module.AnalysisPage })));
const GapReportPage = lazy(() => import("./components/gap-report-page").then((module) => ({ default: module.GapReportPage })));
const RoadmapPage = lazy(() => import("./components/roadmap-page").then((module) => ({ default: module.RoadmapPage })));
const ResumeStudioPage = lazy(() => import("./components/resume-studio-page").then((module) => ({ default: module.ResumeStudioPage })));
const CareerHubPage = lazy(() => import("./components/career-hub-page").then((module) => ({ default: module.CareerHubPage })));
const WorkspacesPage = lazy(() => import("./components/workspaces-page").then((module) => ({ default: module.WorkspacesPage })));
const CareerVaultPage = lazy(() => import("./components/career-vault-page").then((module) => ({ default: module.CareerVaultPage })));
const ApplicationPackagePage = lazy(() => import("./components/application-package-page").then((module) => ({ default: module.ApplicationPackagePage })));
const PrivacyPage = lazy(() => import("./components/privacy-page").then((module) => ({ default: module.PrivacyPage })));

export default function App() {
  const protect = (page: ReactNode) => <ProtectedRoute>{page}</ProtectedRoute>;
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-background">
            <Navigation />
            <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center" role="status"><Loader2 className="size-7 animate-spin text-primary" /><span className="sr-only">Loading page</span></div>}>
              <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/dashboard" element={protect(<DashboardPage />)} />
            <Route path="/upload" element={protect(<UploadPage />)} />
            <Route path="/workspaces" element={protect(<WorkspacesPage />)} />
            
            {/* ✅ FIXED: Added routes with :id parameters */}
            <Route path="/analysis" element={protect(<AnalysisPage />)} />
            <Route path="/analysis/:id" element={protect(<AnalysisPage />)} />
            
            <Route path="/gap-report" element={protect(<GapReportPage />)} />
            <Route path="/gap-report/:id" element={protect(<GapReportPage />)} />
            
            <Route path="/roadmap" element={protect(<RoadmapPage />)} />
            <Route path="/roadmap/:id" element={protect(<RoadmapPage />)} />
            <Route path="/resume-studio/:id" element={protect(<ResumeStudioPage />)} />
            <Route path="/career" element={protect(<CareerHubPage />)} />
            <Route path="/career/vault" element={protect(<CareerVaultPage />)} />
            <Route path="/career/package/:id" element={protect(<ApplicationPackagePage />)} />
            <Route path="/privacy" element={protect(<PrivacyPage />)} />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
