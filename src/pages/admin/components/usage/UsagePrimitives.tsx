import { AlertTriangle, CheckCircle2, CircleDollarSign, Users } from "lucide-react";
import type { ReactNode } from "react";

export const money = (nanos = 0) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(nanos || 0) / 1_000_000_000);

export function UsageStatCard({ label, value, detail, tone = "brand" }: { label: string; value: string | number; detail?: string; tone?: "brand" | "warning" | "danger" }) {
  const Icon = tone === "danger" ? AlertTriangle : tone === "warning" ? CircleDollarSign : Users;
  const color = tone === "danger" ? "text-rose-300 border-rose-400/25 bg-rose-400/10" : tone === "warning" ? "text-amber-200 border-amber-300/25 bg-amber-300/10" : "text-brand border-brand/25 bg-brand/10";
  return <article className="rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/[0.08] to-background p-5 shadow-xl shadow-black/10">
    <div className="flex items-start justify-between gap-3"><div><p className="text-sm text-gray-400">{label}</p><p className="mt-2 text-3xl font-bold text-white">{value}</p></div><span className={`rounded-xl border p-2.5 ${color}`}><Icon className="h-5 w-5" /></span></div>
    {detail && <p className="mt-3 text-xs text-gray-500">{detail}</p>}
  </article>;
}

export function SourceBadge({ source }: { source?: string | null }) {
  const normalized = String(source || "estimated").replaceAll("_", " ");
  const confirmed = normalized === "confirmed" || normalized === "provider reported" || normalized === "provider";
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold capitalize ${confirmed ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-amber-300/25 bg-amber-300/10 text-amber-100"}`}><CheckCircle2 className="h-3 w-3" />{normalized}</span>;
}

export function UsagePanel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-brand/20 bg-background shadow-xl shadow-black/10"><header className="border-b border-brand/15 px-5 py-4"><h2 className="text-lg font-bold text-white">{title}</h2>{subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}</header>{children}</section>;
}
