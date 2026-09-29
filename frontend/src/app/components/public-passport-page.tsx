import axios from "axios";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api, API_BASE_URL } from "../../lib/api";
import { externalUrl, growthError } from "../../lib/growth";
import { useAuth } from "../auth-provider";
import { GrowthCard, GrowthFeedback, growthButton, growthField, growthSecondary, useGrowthAction } from "./growth-ui";

type Review = { evidence_id: number; reviewer_name: string; relationship: string; clarity: number; relevance: number; reproducibility: number; comments: string; status: string };
type Passport = { name: string | null; headline: string | null; disclaimer: string; expires_at: string;
  evidence: { id: number; title: string; description: string; skills: string[]; url: string | null }[];
  assessments: { skill: string; score: number; assessed_at: string; scope: string }[]; reviews: Review[] };

export function PublicPassportPage() {
  const { token } = useParams();
  const { session } = useAuth();
  const location = useLocation();
  const [data, setData] = useState<Passport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [evidenceId, setEvidenceId] = useState("");
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [comments, setComments] = useState("");
  const [ratings, setRatings] = useState({ clarity: 3, relevance: 3, reproducibility: 3 });
  const [reviewed, setReviewed] = useState(false);
  const action = useGrowthAction();
  useEffect(() => {
    const metas = ["robots", "referrer"].map(name => { const node = document.createElement("meta"); node.name = name; node.content = name === "robots" ? "noindex, nofollow" : "no-referrer"; document.head.appendChild(node); return node; });
    return () => metas.forEach(node => node.remove());
  }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setData(null);
    axios.get<Passport>(`${API_BASE_URL}/growth/public/passport/${encodeURIComponent(token || "")}`, { signal: controller.signal, timeout: 15000 }).then(response => { if (!controller.signal.aborted) setData(response.data); }).catch(error => { if (!controller.signal.aborted) setError(growthError(error)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, version]);
  const submitReview = (event: FormEvent) => { event.preventDefault(); void action.run(async () => {
    await api.post(`/growth/public/passport/${encodeURIComponent(token || "")}/reviews`, { evidence_id: Number(evidenceId), reviewer_name: name, relationship, ...ratings, comments, reviewed_evidence: reviewed });
    setVersion(v => v + 1); action.setMessage("Your account-based review was saved. Your name, relationship, ratings, and comments are visible to anyone with this link.");
  }); };
  return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6"><p className="text-sm font-medium text-primary">SkillSync · Shared Skills Passport</p><h1 className="mt-3 text-3xl font-medium">{data?.name || "Skills Passport"}</h1>{data?.headline && <p className="mt-3 text-muted-foreground">{data.headline}</p>}<GrowthFeedback busy={loading} error={error} />{error && <button type="button" className={`${growthSecondary} mt-3`} onClick={() => setVersion(v => v + 1)}>Try again</button>}
    {data && <div className="mt-6 space-y-6"><p className="rounded-xl border border-border bg-muted p-4 text-sm leading-relaxed">{data.disclaimer} Link expires {new Date(data.expires_at).toLocaleDateString()}.</p><GrowthCard title="Project evidence · self-reported"><div className="space-y-4">{data.evidence.map(e => <article key={e.id} className="rounded-xl border border-border p-5"><h3 className="font-medium">{e.title}</h3><p className="mt-2 text-sm text-muted-foreground">{e.skills.join(", ")} · Self-reported</p><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{e.description}</p>{externalUrl(e.url) && <a href={externalUrl(e.url)} className={`${growthSecondary} mt-4`} target="_blank" rel="noopener noreferrer">View supporting evidence</a>}<div className="mt-4 space-y-3">{data.reviews.filter(r => r.evidence_id === e.id).map((review, index) => <div key={index} className="rounded-lg border border-border bg-muted p-4"><p className="text-sm font-medium">{review.reviewer_name} · {review.relationship}</p><p className="mt-2 text-xs text-muted-foreground">Account-based review · Identity/expertise not verified</p><p className="mt-2 text-sm">Clarity {review.clarity}/5 · Relevance {review.relevance}/5 · Reproducibility {review.reproducibility}/5</p><p className="mt-3 whitespace-pre-wrap text-sm">{review.comments}</p></div>)}</div></article>)}{!data.evidence.length && <p className="text-sm text-muted-foreground">No project evidence was selected for this snapshot.</p>}</div></GrowthCard><GrowthCard title="Knowledge assessment results"><div className="grid gap-4 sm:grid-cols-2">{data.assessments.map((assessment, index) => <article key={index} className="rounded-xl border border-border p-5"><h3 className="font-medium">{assessment.skill} · {assessment.score}%</h3><p className="mt-2 text-sm">Knowledge assessed · {new Date(assessment.assessed_at).toLocaleDateString()}</p><p className="mt-2 text-xs text-muted-foreground">{assessment.scope}</p></article>)}{!data.assessments.length && <p className="text-sm text-muted-foreground">No assessments were selected.</p>}</div></GrowthCard>
    {!!data.evidence.length && <GrowthCard title="Review published evidence" description="The passport owner cannot review their own work. Reviews require a signed-in account and a declaration of your relationship; they are not a verified expert endorsement.">{session ? <form onSubmit={submitReview} className="space-y-4"><label className="block text-sm">Evidence reviewed<select required className={growthField} value={evidenceId} onChange={e => setEvidenceId(e.target.value)}><option value="">Select published evidence</option>{data.evidence.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Your public display name<input required minLength={2} maxLength={160} className={growthField} value={name} onChange={e => setName(e.target.value)} /></label><label className="text-sm">Your relationship to the candidate<input required minLength={2} maxLength={160} className={growthField} value={relationship} onChange={e => setRelationship(e.target.value)} placeholder="Former teammate, mentor, no prior relationship…" /></label></div><div className="grid gap-4 sm:grid-cols-3">{(["clarity", "relevance", "reproducibility"] as const).map(rating => <label key={rating} className="text-sm capitalize">{rating}<select className={growthField} value={ratings[rating]} onChange={e => setRatings(r => ({ ...r, [rating]: Number(e.target.value) }))}>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value}/5</option>)}</select></label>)}</div><label className="block text-sm">Public review comments<textarea required minLength={20} maxLength={2000} className={`${growthField} min-h-28`} value={comments} onChange={e => setComments(e.target.value)} /></label><label className="flex min-h-11 items-start gap-3 text-sm"><input required type="checkbox" className="mt-1" checked={reviewed} onChange={e => setReviewed(e.target.checked)} /><span>I reviewed this evidence and agree that my review details will be published to anyone with the link.</span></label><button className={growthButton} disabled={action.busy || !reviewed || !evidenceId}>Publish account-based review</button></form> : <Link to="/login" state={{ from: location.pathname + location.search }} className={growthSecondary}>Sign in to review evidence</Link>}<GrowthFeedback {...action} /></GrowthCard>}</div>}
  </main>;
}
