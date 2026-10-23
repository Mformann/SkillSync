export const workspaceLimits = { titleMin: 2, titleMax: 160, companyMax: 160, descriptionMin: 50, descriptionMax: 50_000 };

export function workspaceInputError(title: string, company: string, description: string): string | null {
  if (title.trim().length < workspaceLimits.titleMin || title.trim().length > workspaceLimits.titleMax) return "Job title must be 2–160 characters after trimming spaces.";
  if (company.trim().length > workspaceLimits.companyMax) return "Company must be 160 characters or fewer.";
  if (description.trim().length < workspaceLimits.descriptionMin || description.trim().length > workspaceLimits.descriptionMax) return "Job description must be 50–50,000 characters after trimming spaces.";
  return null;
}

export function validationDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail.find(item => item && typeof item.msg === "string");
    if (first) {
      const field = first.loc?.at(-1) as string | undefined;
      const label = ({ job_role: "Job title", title: "Job title", job_description: "Job description", description: "Job description", company: "Company", ai_consent: "AI processing preference" } as Record<string, string>)[field || ""];
      return `${label ? `${label}: ` : ""}${first.msg}`;
    }
  }
  return fallback;
}
