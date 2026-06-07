import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------- helpers ----------
async function callAI(messages: any[], opts: { json?: boolean } = {}) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Lovable AI is not configured.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (res.status === 429) throw new Error("Rate limit reached — try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted.");
  if (!res.ok) throw new Error(`AI error: ${(await res.text()).slice(0, 200)}`);
  const j: any = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

function linreg(ys: number[]) {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 };
  const xs = ys.map((_, i) => i);
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: my - slope * mx };
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---------- 1. Revenue forecast (linear regression + AI commentary) ----------
export const forecastRevenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: invoices } = await supabase
      .from("invoices")
      .select("amount, status, issue_date")
      .eq("status", "paid");

    const buckets = new Map<string, number>();
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.set(monthKey(d), 0);
    }
    (invoices ?? []).forEach((inv) => {
      const k = monthKey(new Date(inv.issue_date));
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + Number(inv.amount));
    });
    const history = Array.from(buckets, ([m, v]) => ({ m, value: v }));
    const ys = history.map((h) => h.value);
    const { slope, intercept } = linreg(ys);

    const forecast: { m: string; value: number; forecast: boolean }[] = history.map((h) => ({
      ...h, forecast: false,
    }));
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const x = ys.length - 1 + i;
      const v = Math.max(0, Math.round(intercept + slope * x));
      forecast.push({ m: monthKey(d), value: v, forecast: true });
    }

    let commentary = "";
    try {
      commentary = await callAI([
        { role: "system", content: "You are a CFO analyst. In 2-3 short sentences, summarize the revenue trend and forecast. Be concrete, mention USD figures." },
        { role: "user", content: `Monthly paid revenue (last 12 months) USD: ${JSON.stringify(ys)}. Forecast next 3 months: ${JSON.stringify(forecast.slice(-3).map(f => f.value))}. Slope: ${slope.toFixed(1)}/mo.` },
      ]);
    } catch (e: any) { commentary = `Trend slope ${slope >= 0 ? "+" : ""}${slope.toFixed(0)} USD/month.`; }

    return { series: forecast, slope, commentary };
  });

// ---------- 2. Lead scoring ----------
export const scoreLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: leads } = await supabase
      .from("customers").select("id, name, company, email, status, notes, created_at").limit(50);

    if (!leads?.length) return { leads: [] };

    const prompt = `Score each lead 0-100 for likelihood to convert/expand. Return JSON: {"scores":[{"id":"...","score":number,"reason":"<=15 words","priority":"high|medium|low"}]}.\nLeads:\n${JSON.stringify(leads)}`;

    let parsed: any = { scores: [] };
    try {
      const raw = await callAI([
        { role: "system", content: "You are a B2B sales analyst. Output ONLY valid JSON." },
        { role: "user", content: prompt },
      ], { json: true });
      parsed = JSON.parse(raw);
    } catch {
      parsed = { scores: leads.map((l) => ({ id: l.id, score: 50, reason: "Heuristic baseline", priority: "medium" })) };
    }

    const byId = new Map(parsed.scores.map((s: any) => [s.id, s]));
    const merged = leads.map((l) => ({ ...l, ...(byId.get(l.id) ?? { score: 50, reason: "—", priority: "medium" }) }));
    merged.sort((a: any, b: any) => b.score - a.score);
    return { leads: merged };
  });

// ---------- 3. Anomaly detection (z-score on expenses) ----------
export const detectAnomalies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: expenses } = await supabase
      .from("expenses").select("id, amount, category, vendor, date, description").limit(500);
    const xs = (expenses ?? []).map((e) => Number(e.amount));
    if (xs.length < 3) return { anomalies: [], summary: "Not enough data." };
    const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
    const variance = xs.reduce((s, v) => s + (v - mean) ** 2, 0) / xs.length;
    const sd = Math.sqrt(variance) || 1;
    const anomalies = (expenses ?? [])
      .map((e) => ({ ...e, z: (Number(e.amount) - mean) / sd }))
      .filter((e) => Math.abs(e.z) >= 2)
      .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
      .slice(0, 15);
    return {
      anomalies,
      summary: `Analyzed ${xs.length} expenses · mean ${mean.toFixed(0)} USD · σ ${sd.toFixed(0)}. Flagged ${anomalies.length} outliers (|z|≥2).`,
    };
  });

// ---------- 4. Churn risk per customer ----------
export const predictChurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: customers }, { data: invoices }, { data: tickets }] = await Promise.all([
      supabase.from("customers").select("id, name, company, status").eq("status", "customer").limit(40),
      supabase.from("invoices").select("customer_id, amount, status, issue_date"),
      supabase.from("tickets").select("customer_id, status, priority"),
    ]);
    if (!customers?.length) return { customers: [] };

    const now = Date.now();
    const enriched = customers.map((c) => {
      const inv = (invoices ?? []).filter((i) => i.customer_id === c.id);
      const lastInv = inv.length ? Math.max(...inv.map((i) => new Date(i.issue_date).getTime())) : 0;
      const daysSince = lastInv ? Math.floor((now - lastInv) / 86400000) : 999;
      const overdue = inv.filter((i) => i.status === "overdue").length;
      const open = (tickets ?? []).filter((t) => t.customer_id === c.id && t.status !== "closed").length;
      const urgent = (tickets ?? []).filter((t) => t.customer_id === c.id && t.priority === "urgent").length;
      // simple heuristic risk
      let risk = 0;
      risk += Math.min(50, daysSince / 4);
      risk += overdue * 10;
      risk += open * 5 + urgent * 10;
      risk = Math.max(0, Math.min(100, Math.round(risk)));
      const band = risk >= 70 ? "high" : risk >= 40 ? "medium" : "low";
      return { ...c, daysSince, overdue, openTickets: open, risk, band };
    });
    enriched.sort((a, b) => b.risk - a.risk);
    return { customers: enriched };
  });

// ---------- 5. Smart restock recommendations ----------
export const recommendRestock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: products }, { data: moves }] = await Promise.all([
      supabase.from("products").select("id, name, sku, stock, low_stock_threshold, price"),
      supabase.from("stock_movements").select("product_id, quantity, movement_type, created_at"),
    ]);
    const now = Date.now();
    const recs = (products ?? []).map((p) => {
      const last30 = (moves ?? []).filter(
        (m) => m.product_id === p.id && m.movement_type === "out" &&
        (now - new Date(m.created_at).getTime()) / 86400000 <= 30
      );
      const sold = last30.reduce((s, m) => s + Number(m.quantity), 0);
      const dailyRate = sold / 30;
      const daysLeft = dailyRate > 0 ? Math.floor(p.stock / dailyRate) : null;
      const reorder = dailyRate > 0
        ? Math.max(0, Math.ceil(dailyRate * 45) - p.stock) // 45-day buffer
        : Math.max(0, (p.low_stock_threshold ?? 0) * 2 - p.stock);
      const urgency = p.stock <= (p.low_stock_threshold ?? 0)
        ? "high"
        : daysLeft !== null && daysLeft <= 14 ? "medium" : "low";
      return { ...p, dailyRate: Number(dailyRate.toFixed(2)), daysLeft, reorder, urgency };
    }).filter((r) => r.reorder > 0)
      .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
    return { recommendations: recs };
  });

// ---------- 6. Business insights (executive AI summary) ----------
export const generateInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [c, inv, exp, prod, tasks, tickets] = await Promise.all([
      supabase.from("customers").select("status").limit(500),
      supabase.from("invoices").select("amount, status, issue_date, due_date").limit(500),
      supabase.from("expenses").select("amount, category, date").limit(500),
      supabase.from("products").select("name, stock, low_stock_threshold").limit(500),
      supabase.from("tasks").select("status, priority").limit(500),
      supabase.from("tickets").select("status, priority").limit(500),
    ]);

    const stats = {
      customers: c.data?.length ?? 0,
      paidRevenue: (inv.data ?? []).filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0),
      outstanding: (inv.data ?? []).filter(i => i.status !== "paid").reduce((s, i) => s + Number(i.amount), 0),
      overdue: (inv.data ?? []).filter(i => i.status === "overdue").length,
      expenses: (exp.data ?? []).reduce((s, e) => s + Number(e.amount), 0),
      lowStock: (prod.data ?? []).filter(p => p.stock <= p.low_stock_threshold).length,
      openTasks: (tasks.data ?? []).filter(t => t.status !== "done").length,
      urgentTickets: (tickets.data ?? []).filter(t => t.priority === "urgent" && t.status !== "closed").length,
    };

    const raw = await callAI([
      { role: "system", content: "You are Nexus, a McKinsey-style ERP analyst. Return ONLY JSON: {\"headline\":\"<=12 words\",\"insights\":[{\"title\":\"...\",\"detail\":\"<=25 words\",\"impact\":\"high|medium|low\",\"action\":\"<=15 words\"}],\"kpis\":[{\"label\":\"...\",\"value\":\"...\",\"trend\":\"up|down|flat\"}]}. Give 4-6 insights." },
      { role: "user", content: `ERP snapshot: ${JSON.stringify(stats)}` },
    ], { json: true });

    try { return JSON.parse(raw); }
    catch { return { headline: "Insights unavailable", insights: [], kpis: [] }; }
  });

// ---------- 7. Smart classify (used inline e.g. for expense) ----------
const classifySchema = z.object({ text: z.string().min(1).max(500) });
export const classifyExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => classifySchema.parse(d))
  .handler(async ({ data }) => {
    const raw = await callAI([
      { role: "system", content: "Classify a business expense into ONE of: Travel, Software, Marketing, Office, Payroll, Utilities, Equipment, Meals, Professional Services, Other. Return JSON {\"category\":\"...\",\"confidence\":0-1}." },
      { role: "user", content: data.text },
    ], { json: true });
    try { return JSON.parse(raw); } catch { return { category: "Other", confidence: 0.3 }; }
  });
