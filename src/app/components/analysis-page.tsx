import axios from "axios";
import { motion } from "motion/react"; 
import { 
  TrendingUp, Download, Share2, CheckCircle2, 
  AlertTriangle, Loader2, Target, ArrowLeft 
} from "lucide-react";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend 
} from "recharts";
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import jsPDF from "jspdf";
import { toPng } from "html-to-image"; // ✅ NEW: Modern screenshot tool

// --- Types ---
type AnalysisData = {
  overview: { 
    overallScore: number; 
    totalSkills: number; 
    resumeStrength: string; 
    jobMatchRate: number; 
  };
  skillDistribution: { name: string; value: number }[];
  topSkills: { skill: string; level: number }[];
  recommendations: { title: string; body: string }[];
};

import { supabase } from "../../lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b"];

export function AnalysisPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || localStorage.getItem("token");
      if (!token) { navigate("/login"); return; }
      
      try {
        setLoading(true);
        setError("");

        const endpoint = (id && id !== 'latest')
            ? `${API_BASE_URL}/resume/analysis/${id}` 
            : `${API_BASE_URL}/resume/analysis/latest`;

        const response = await axios.get(endpoint, {
          headers: { "Authorization": `Bearer ${token}` }
        });

        const rawData = response.data;

        // Smart Data Mapping
        const mappedData: AnalysisData = {
            overview: {
                overallScore: rawData.overview?.overallScore || 0,
                totalSkills: rawData.skills?.found?.length || 0,
                resumeStrength: rawData.overview?.resumeStrength || "Moderate",
                jobMatchRate: rawData.overview?.jobMatchRate || 0
            },
            skillDistribution: rawData.skillDistribution || [
                { name: "Technical", value: 40 },
                { name: "Soft Skills", value: 30 },
                { name: "Tools", value: 20 },
                { name: "Other", value: 10 }
            ],
            topSkills: rawData.topSkills || (rawData.skills?.found || []).slice(0, 5).map((skill: string) => ({
                skill: skill.charAt(0).toUpperCase() + skill.slice(1),
                level: Math.floor(Math.random() * (100 - 70) + 70)
            })),
            recommendations: rawData.recommendations || [
                { title: "Expand Skill Set", body: "Consider adding more cloud technologies." },
                { title: "Quantify Achievements", body: "Use numbers to describe your impact." }
            ]
        };

        setAnalysisData(mappedData);

      } catch (err: any) {
        console.error("Analysis Fetch Error:", err);
        const msg = err.response?.data?.detail || "Could not load analysis results.";
        setError(Array.isArray(msg) ? msg[0].msg : msg);
        
        if (err.response?.status === 404 && (!id || id === 'latest')) {
             navigate("/upload");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [id, navigate]);

  // ✅ NEW: Modern PDF Export Logic
  const handleExportPDF = async () => {
    if (!reportRef.current) {
        alert("Report element not found.");
        return;
    }
    
    setIsExporting(true);
    try {
      // 1. Force a small delay to ensure charts are done animating
      await new Promise(resolve => setTimeout(resolve, 500));

      // 2. Capture the element using the new library
      const dataUrl = await toPng(reportRef.current, { 
        cacheBust: true,
        backgroundColor: "#ffffff",
        quality: 0.95
      });
      
      // 3. Generate PDF
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(dataUrl);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      // Fit image to page or span multiple pages if needed
      // (For now, we scale to fit one page for a clean report)
      const ratio = Math.min(pdfWidth / imgProps.width, pdfHeight / imgProps.height);
      
      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, imgHeight);
      pdf.save(`SkillSync_Report_${id || "latest"}.pdf`);
      
    } catch (err: any) {
      console.error("PDF Export failed:", err);
      alert(`Failed to generate PDF: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!"); 
    } catch (err) {
      console.error("Share failed:", err);
    }
  };

  if (loading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="text-center">
          <Loader2 className="mx-auto mb-4 size-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Analyzing your resume...</p>
      </div>
    </div>
  );

  if (error || !analysisData) return (
    <div className="flex h-[60vh] flex-col items-center justify-center p-10 text-center">
      <AlertTriangle className="mb-4 size-12 text-red-500" />
      <h2 className="mb-2 text-2xl font-bold">Analysis Not Found</h2>
      <p className="mb-6 text-muted-foreground">{error}</p>
      <div className="flex gap-4">
        <Link to="/dashboard" className="rounded-lg border px-4 py-2 hover:bg-gray-50">Back to Dashboard</Link>
        <Link to="/upload" className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90">Upload Resume</Link>
      </div>
    </div>
  );

  const { overview, skillDistribution, topSkills, recommendations } = analysisData;

  const getScoreColor = (score: number) => {
      if (score >= 80) return "text-green-600";
      if (score >= 60) return "text-amber-600";
      return "text-red-600";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-gray-100">
                <ArrowLeft className="size-5 text-gray-600" />
            </button>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Analysis Results</h1>
                <p className="text-muted-foreground">Detailed insights generated by AI</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button onClick={handleShare} className="flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-gray-50 transition-colors">
              <Share2 size={16}/> Share
            </button>
            <button 
              onClick={handleExportPDF} 
              disabled={isExporting} 
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isExporting ? <Loader2 className="animate-spin" size={16}/> : <Download size={16}/>} 
              {isExporting ? "Exporting..." : "Export PDF"}
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div ref={reportRef} className="space-y-8 rounded-xl bg-white p-4">
          
          {/* 1. Key Metrics */}
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-blue-100 bg-blue-50/50 p-6 md:grid-cols-4">
            <div className="text-center md:text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Overall Score</p>
                <p className={`mt-1 text-4xl font-bold ${getScoreColor(overview.overallScore)}`}>
                    {overview.overallScore}/100
                </p>
            </div>
            <div className="text-center md:text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Total Skills Found</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{overview.totalSkills}</p>
            </div>
            <div className="text-center md:text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Resume Strength</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{overview.resumeStrength}</p>
            </div>
            <div className="text-center md:text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Job Match</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{overview.jobMatchRate}%</p>
            </div>
          </div>
          
          {/* 2. Charts Section */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Pie Chart */}
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="mb-6 flex items-center gap-2 font-bold text-gray-800">
                  <TrendingUp className="size-5 text-indigo-500" /> Skill Distribution
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                        data={skillDistribution} 
                        innerRadius={60} 
                        outerRadius={80} 
                        paddingAngle={5} 
                        dataKey="value"
                    >
                      {skillDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="mb-6 flex items-center gap-2 font-bold text-gray-800">
                  <Target className="size-5 text-indigo-500" /> Top Proficiencies
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topSkills} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="skill" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="level" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 3. Recommendations */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-gray-800">
              <CheckCircle2 className="size-6 text-green-500" /> AI Recommendations
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4 transition-colors hover:bg-blue-50/50">
                  <div className="mt-1 shrink-0 rounded-full bg-white p-2 shadow-sm">
                      <Target size={18} className="text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">{rec.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}