import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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

const METRIC_LABEL: Record<string, string> = {
  revenue: "Paid revenue (USD)",
  invoices_paid: "Invoices marked paid",
  new_customers: "New customers acquired",
  tasks_done: "Tasks completed",
  tickets_closed: "Support tickets closed",
  expenses_under: "Total expenses kept under (USD)",
  stock_sold: "Units sold (stock out)",
};

async function computeProgress(supabase: any, g: any) {
  const start = g.start_date;
  const end = g.end_date;
  const startISO = new Date(start).toISOString();
  const endISO = new Date(end + "T23:59:59").toISOString();
  let current = 0;
  switch (g.metric_type) {
    case "revenue": {
      const { data } = await supabase.from("payments")
        .select("amount, payment_date")
        .gte("payment_date", start).lte("payment_date", end);
      current = (data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      break;
    }
    case "invoices_paid": {
      const { data } = await supabase.from("invoices")
        .select("id, status, issue_date")
        .eq("status", "paid").gte("issue_date", start).lte("issue_date", end);
      current = data?.length ?? 0;
      break;
    }
    case "new_customers": {
      const { data } = await supabase.from("customers")
        .select("id, created_at").gte("created_at", startISO).lte("created_at", endISO);
      current = data?.length ?? 0;
      break;
    }
    case "tasks_done": {
      const { data } = await supabase.from("tasks")
        .select("id, status, updated_at").eq("status", "done")
        .gte("updated_at", startISO).lte("updated_at", endISO);
      current = data?.length ?? 0;
      break;
    }
    case "tickets_closed": {
      const { data } = await supabase.from("tickets")
        .select("id, status, updated_at").eq("status", "closed")
        .gte("updated_at", startISO).lte("updated_at", endISO);
      current = data?.length ?? 0;
      break;
    }
    case "expenses_under": {
      const { data } = await supabase.from("expenses")
        .select("amount, date").gte("date", start).lte("date", end);
      current = (data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      break;
    }
    case "stock_sold": {
      const { data } = await supabase.from("stock_movements")
        .select("quantity, movement_type, created_at").eq("movement_type", "out")
        .gte("created_at", startISO).lte("created_at", endISO);
      current = (data ?? []).reduce((s: number, r: any) => s + Number(r.quantity ?? 0), 0);
      break;
    }
  }
  const target = Number(g.target_value);
  const inverse = g.metric_type === "expenses_under";
  const pct = inverse
    ? Math.max(0, Math.min(100, Math.round((1 - current / (target || 1)) * 100)))
    : Math.max(0, Math.min(100, Math.round((current / (target || 1)) * 100)));
  // Days elapsed vs total
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const now = Date.now();
  const timePct = Math.max(0, Math.min(100, Math.round(((now - s) / (e - s || 1)) * 100)));
  const onTrack = inverse ? pct >= timePct - 5 : pct >= timePct - 5;
  return { current, pct, timePct, onTrack, inverse };
}

export const listGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: goals } = await supabase.from("goals").select("*").order("created_at", { ascending: false });
    const enriched = await Promise.all((goals ?? []).map(async (g: any) => ({
      ...g,
      metric_label: METRIC_LABEL[g.metric_type] ?? g.metric_type,
      progress: await computeProgress(supabase, g),
    })));
    return { goals: enriched };
  });

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  metric_type: z.enum(["revenue","invoices_paid","new_customers","tasks_done","tickets_closed","expenses_under","stock_sold"]),
  target_value: z.number().positive(),
  period: z.enum(["month","quarter","year","custom"]),
  start_date: z.string(),
  end_date: z.string(),
});

export const createGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("goals").insert({ ...data, user_id: userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["active","achieved","missed","archived"]).optional(),
  target_value: z.number().positive().optional(),
  title: z.string().max(200).optional(),
});

export const updateGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("goals").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("goals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const coachGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: g } = await supabase.from("goals").select("*").eq("id", data.id).maybeSingle();
    if (!g) throw new Error("Goal not found");
    const prog = await computeProgress(supabase, g);
    const raw = await callAI([
      { role: "system", content: "You are an operations coach. Return ONLY JSON: {\"status\":\"on_track|at_risk|behind|ahead\",\"headline\":\"<=15 words\",\"actions\":[\"<=15 words\",\"...\",\"...\"]} — exactly 3 concrete actions." },
      { role: "user", content: `Goal: ${g.title}\nMetric: ${METRIC_LABEL[g.metric_type]}\nTarget: ${g.target_value}\nCurrent: ${prog.current}\nProgress: ${prog.pct}% (time elapsed ${prog.timePct}%)\nPeriod: ${g.start_date} to ${g.end_date}\nDescription: ${g.description ?? "n/a"}` },
    ], { json: true });
    try { return { ...JSON.parse(raw), progress: prog }; }
    catch { return { status: prog.onTrack ? "on_track" : "at_risk", headline: "Progress computed.", actions: [], progress: prog }; }
  });

export const suggestGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: inv }, { data: cust }, { data: pay }] = await Promise.all([
      supabase.from("invoices").select("amount, status, issue_date").limit(500),
      supabase.from("customers").select("id, created_at").limit(500),
      supabase.from("payments").select("amount, payment_date").limit(500),
    ]);
    const paidLast30 = (pay ?? []).filter((p: any) => (Date.now() - new Date(p.payment_date).getTime()) / 86400000 <= 30)
      .reduce((s: number, p: any) => s + Number(p.amount), 0);
    const newCustLast30 = (cust ?? []).filter((c: any) => (Date.now() - new Date(c.created_at).getTime()) / 86400000 <= 30).length;
    const raw = await callAI([
      { role: "system", content: "You are an ERP goal planner. Given last-30-day stats, propose 4 realistic but ambitious goals for the coming month. Return ONLY JSON: {\"suggestions\":[{\"title\":\"<=10 words\",\"metric_type\":\"revenue|invoices_paid|new_customers|tasks_done|tickets_closed|expenses_under|stock_sold\",\"target_value\":number,\"rationale\":\"<=20 words\"}]}." },
      { role: "user", content: `Last 30d: paid_revenue_usd=${paidLast30.toFixed(0)}, new_customers=${newCustLast30}, total_invoices=${inv?.length ?? 0}.` },
    ], { json: true });
    try { return JSON.parse(raw); } catch { return { suggestions: [] }; }
  });
