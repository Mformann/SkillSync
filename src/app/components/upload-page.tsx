import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Upload, FileText, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useState, useRef } from "react";
import axios, { AxiosProgressEvent } from "axios";

const API_BASE_URL = "http://localhost:8000"; // Replace with your backend URL

export function UploadPage() {
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (selectedFile: File) => {
    // Validate file type
    const validTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!validTypes.includes(selectedFile.type)) {
      alert("Please upload a PDF or Word document");
      return;
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB");
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_BASE_URL}/resume/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          }
        },
      });

      console.log("Upload successful:", response.data);
      navigate("/analysis");
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload the file. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl tracking-tight">Upload Your Resume</h1>
          <p className="text-lg text-muted-foreground">
            Upload your resume to get started with AI-powered analysis
          </p>
        </div>

        {/* Upload Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
          {!file ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-all ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-accent/50"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx"
                onChange={handleChange}
                title="Upload your resume file"
                placeholder="Choose a file"
              />

              <motion.div
                initial={{ scale: 1 }}
                animate={{ scale: dragActive ? 1.05 : 1 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
                  <Upload className="size-8 text-primary" />
                </div>

                <h3 className="mb-2 text-xl">Drop your resume here</h3>
                <p className="mb-4 text-muted-foreground">or click to browse files</p>

                <div className="mx-auto max-w-xs">
                  <button
                    type="button"
                    className="rounded-lg bg-primary px-6 py-2 text-sm text-primary-foreground transition-all hover:bg-primary/90"
                  >
                    Choose File
                  </button>
                </div>

                <p className="mt-6 text-sm text-muted-foreground">
                  Supported formats: PDF, DOC, DOCX (Max 10MB)
                </p>
              </motion.div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              {/* File Preview */}
              <div className="mb-6 rounded-xl border border-border bg-muted/50 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="size-6 text-primary" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate">{file.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>

                      <button
                        onClick={removeFile}
                        disabled={uploading}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    {/* Progress Bar */}
                    {uploading && (
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Uploading...</span>
                          <span className="text-primary">{uploadProgress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-secondary">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                            transition={{ duration: 0.3 }}
                            className="h-full bg-primary"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              {!uploading && (
                <button
                  onClick={handleUpload}
                  title="Upload and analyze your resume"
                  aria-label="Upload and analyze your resume"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
                >
                  <Upload className="size-4" />
                  <span>Analyze Resume</span>
                </button>
              )}
            </motion.div>
          )}
        </div>

        {/* Info Cards */}
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <CheckCircle2 className="size-5 text-primary" />
            </div>
            <h4 className="mb-1">Secure Upload</h4>
            <p className="text-sm text-muted-foreground">
              Your data is encrypted and secure
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <CheckCircle2 className="size-5 text-primary" />
            </div>
            <h4 className="mb-1">Fast Analysis</h4>
            <p className="text-sm text-muted-foreground">
              Get results in seconds with AI
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <CheckCircle2 className="size-5 text-primary" />
            </div>
            <h4 className="mb-1">Actionable Insights</h4>
            <p className="text-sm text-muted-foreground">
              Detailed recommendations to improve
            </p>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <h4 className="mb-2">Tips for best results</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Use your most recent and complete resume</li>
                <li>• Ensure all sections are clearly labeled</li>
                <li>• Include relevant skills and experience</li>
                <li>• Use a clean, readable format</li>
              </ul>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
