import axios from "axios";
import {
  AlertCircle,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const VALID_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function UploadPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [aiConsent, setAiConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const validateFile = (selectedFile: File) => {
    setError("");
    const extension = selectedFile.name.toLowerCase().split(".").pop();
    if (!VALID_TYPES.includes(selectedFile.type) || !["pdf", "docx"].includes(extension || "")) {
      setError("Choose a valid PDF or DOCX resume.");
      return;
    }
    if (selectedFile.size > MAX_FILE_BYTES) {
      setError("Your resume must be 10 MB or smaller.");
      return;
    }
    setFile(selectedFile);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const selectedFile = event.dataTransfer.files[0];
    if (selectedFile) validateFile(selectedFile);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) validateFile(selectedFile);
  };

  const removeFile = () => {
    setFile(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!file) {
      setError("Add your resume before creating the workspace.");
      return;
    }
    if (description.trim().length < 50) {
      setError("Paste a job description of at least 50 characters.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("job_role", title.trim());
    formData.append("company", company.trim());
    formData.append("job_description", description.trim());
    formData.append("ai_consent", String(aiConsent));

    try {
      setUploading(true);
      setProgress(0);
      const response = await api.post("/resume/upload", formData, {
        onUploadProgress: (event) => {
          if (event.total) setProgress(Math.round((event.loaded * 100) / event.total));
        },
      });
      navigate(`/analysis/${response.data.analysis_id}`);
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        const detail = requestError.response?.data?.detail;
        setError(typeof detail === "string" ? detail : "We could not create this workspace.");
      } else {
        setError("We could not create this workspace.");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="mb-8 max-w-3xl">
          <p className="mb-2 text-sm font-medium text-primary">New target workspace</p>
          <h1 className="text-3xl tracking-tight sm:text-4xl">Match your resume to a real opportunity</h1>
          <p className="mt-3 text-muted-foreground">
            Add the job description and the resume you plan to use. SkillSync will
            verify resume evidence and calculate an explainable match.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <BriefcaseBusiness className="size-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl">Target job</h2>
                <p className="text-sm text-muted-foreground">Tell us which role you are preparing for.</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="job-title" className="mb-2 block text-sm">Job title</label>
                <input
                  id="job-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  maxLength={160}
                  placeholder="Frontend Engineer"
                  className="min-h-11 w-full rounded-lg border border-input bg-input-background px-3 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="company" className="mb-2 block text-sm">Company <span className="font-normal text-muted-foreground">(optional)</span></label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <input
                    id="company"
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    maxLength={160}
                    placeholder="Acme"
                    className="min-h-11 w-full rounded-lg border border-input bg-input-background pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-4">
                <label htmlFor="job-description" className="text-sm">Job description</label>
                <span className="text-xs text-muted-foreground">{description.length.toLocaleString()} / 50,000</span>
              </div>
              <textarea
                id="job-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                minLength={50}
                maxLength={50_000}
                rows={15}
                placeholder="Paste the complete job description, including responsibilities and requirements…"
                aria-describedby="job-description-help"
                className="w-full resize-y rounded-lg border border-input bg-input-background p-3 leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p id="job-description-help" className="mt-2 text-sm text-muted-foreground">
                Include the complete description so future analysis can distinguish required and preferred skills.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <FileText className="size-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl">Resume</h2>
                <p className="text-sm text-muted-foreground">PDF or DOCX, up to 10 MB.</p>
              </div>
            </div>

            {!file ? (
              <div
                onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  dragActive ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleChange}
                  className="sr-only"
                  id="resume-file"
                />
                <Upload className="mx-auto size-8 text-primary" aria-hidden="true" />
                <p className="mt-4 font-medium">Drop your resume here</p>
                <p className="mt-1 text-sm text-muted-foreground">or choose a file from your device</p>
                <label
                  htmlFor="resume-file"
                  className="mt-5 inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-primary px-5 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Choose resume
                </label>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-muted/40 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="flex size-11 items-center justify-center rounded-lg hover:bg-accent"
                    aria-label="Remove selected resume"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-5 flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4">
              <input
                type="checkbox"
                checked={aiConsent}
                onChange={(event) => setAiConsent(event.target.checked)}
                className="mt-1 size-4 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium">Enable AI-assisted analysis</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  Allows SkillSync to send the job description and extracted resume text to the configured Groq model.
                  Leave this off to use the limited on-server comparison.
                </span>
              </span>
            </label>

            {uploading && (
              <div className="mt-5" role="status">
                <div className="mb-2 flex justify-between text-sm">
                  <span>Creating workspace</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading}
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {uploading ? "Creating workspace…" : "Create workspace"}
            </button>

            <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
              Your original file is processed in memory. Extracted text is saved in your workspace and sent externally only with the consent above.
            </p>
          </section>
        </form>
      </motion.div>
    </main>
  );
}
