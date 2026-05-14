import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./components/theme-provider";
import { Navigation } from "./components/navigation";
import { LandingPage } from "./components/landing-page";
import { LoginPage } from "./components/login-page";
import { SignupPage } from "./components/signup-page";
import { UploadPage } from "./components/upload-page";
import { DashboardPage } from "./components/dashboard-page";
import { AnalysisPage } from "./components/analysis-page";
import { GapReportPage } from "./components/gap-report-page";
import { RoadmapPage } from "./components/roadmap-page";


export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="min-h-screen bg-background">
          <Navigation />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/upload" element={<UploadPage />} />
            
            {/* ✅ FIXED: Added routes with :id parameters */}
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/analysis/:id" element={<AnalysisPage />} />
            
            <Route path="/gap-report" element={<GapReportPage />} />
            <Route path="/gap-report/:id" element={<GapReportPage />} />
            
            <Route path="/roadmap" element={<RoadmapPage />} />
            <Route path="/roadmap/:id" element={<RoadmapPage />} />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}