import axios from "axios";

export function growthError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return "Some fields are invalid. Check the form and try again.";
  }
  return "Could not complete this request. Check your connection and try again.";
}

export function externalUrl(value: string | null | undefined): string | undefined {
  try {
    const url = new URL(value || "");
    if (url.protocol === "https:" && !url.username && !url.password) return url.href;
  } catch { /* Untrusted or incomplete URL: display text without a link. */ }
  return undefined;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function splitPreferences(value: string): string[] {
  return [...new Set(value.split(",").map(v => v.trim()).filter(Boolean))];
}

export function localDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
