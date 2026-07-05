import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function callAI(messages: any[], json = true) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Lovable AI is not configured.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (res.status === 429) throw new Error("Rate limit reached — try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted.");
  if (!res.ok) throw new Error(`AI error: ${(await res.text()).slice(0, 200)}`);
  const j: any = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

// z-score anomaly on a numeric series
function zscoreOutliers(series: { key: string; value: number }[]) {
  if (series.length < 4) return [];
  const vs = series.map((s) => s.value);
  const mean = vs.reduce((a, b) => a + b, 0) / vs.length;
  const variance = vs.reduce((a, b) => a + (b - mean) ** 2, 0) / vs.length;
  const sd = Math.sqrt(variance) || 1;
  return series
    .map((s) => ({ ...s, z: (s.value - mean) / sd }))
    .filter((s) => Math.abs(s.z) >= 2);
}

function daysBetween(a: string | Date, b: Date) {
  const d = new Date(a);
  return Math.round((b.getTime() - d.getTime()) / 86400000);
}

export const scanAnomalies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const now = new Date();

    const [inv, exp, pay, tk, prod, cust] = await Promise.all([
      supabase.from("invoices").select("amount,status,issue_date,due_date").limit(500),
      supabase.from("expenses").select("amount,category,date,vendor").limit(500),
      supabase.from("payments").select("amount,payment_date,method").limit(500),
      supabase.from("tickets").select("subject,status,priority,created_at").limit(300),
      supabase.from("products").select("name,stock,low_stock_threshold,price").limit(500),
      supabase.from("customers").select("name,status,created_at").limit(500),
    ]);

    const signals: Array<{
      id: string;
      module: string;
      severity: "low" | "medium" | "high";
      title: string;
      detail: string;
      metric?: number;
    }> = [];

    // Expense outliers by amount
    const expenses = (exp.data ?? []).filter((e) => Number(e.amount) > 0);
    if (expenses.length >= 5) {
      const vs = expenses.map((e) => Number(e.amount));
      const mean = vs.reduce((a, b) => a + b, 0) / vs.length;
      const sd = Math.sqrt(vs.reduce((a, b) => a + (b - mean) ** 2, 0) / vs.length) || 1;
      expenses.forEach((e, i) => {
        const z = (Number(e.amount) - mean) / sd;
        if (z >= 2.5) {
          signals.push({
            id: `exp-${i}`,
            module: "Finance",
            severity: z >= 4 ? "high" : "medium",
            title: `Large expense: ${e.vendor ?? e.category ?? "unknown"}`,
            detail: `$${Number(e.amount).toFixed(2)} — ${(z).toFixed(1)}σ above your average`,
            metric: Number(e.amount),
          });
        }
      });
    }

    // Overdue invoices
    (inv.data ?? []).forEach((i, idx) => {
      if (i.status !== "paid" && i.due_date && daysBetween(i.due_date, now) > 7) {
        signals.push({
          id: `inv-${idx}`,
          module: "Invoices",
          severity: daysBetween(i.due_date, now) > 30 ? "high" : "medium",
          title: `Overdue invoice — ${daysBetween(i.due_date, now)}d late`,
          detail: `$${Number(i.amount).toFixed(2)} unpaid`,
        });
      }
    });

    // Low stock
    (prod.data ?? []).forEach((p, idx) => {
      const th = Number(p.low_stock_threshold ?? 5);
      if (Number(p.stock) <= 0) {
        signals.push({
          id: `prod-${idx}`, module: "Inventory", severity: "high",
          title: `Out of stock: ${p.name}`, detail: `Restock immediately`,
        });
      } else if (Number(p.stock) <= th) {
        signals.push({
          id: `prod-${idx}`, module: "Inventory", severity: "medium",
          title: `Low stock: ${p.name}`, detail: `${p.stock} left (threshold ${th})`,
        });
      }
    });

    // Ticket surge (last 7d vs prior 7d)
    const tickets = tk.data ?? [];
    const last7 = tickets.filter((t) => t.created_at && daysBetween(t.created_at, now) <= 7).length;
    const prev7 = tickets.filter((t) => {
      const d = t.created_at ? daysBetween(t.created_at, now) : 999;
      return d > 7 && d <= 14;
    }).length;
    if (last7 > prev7 * 1.5 && last7 >= 5) {
      signals.push({
        id: "tk-surge", module: "Support", severity: last7 > prev7 * 2 ? "high" : "medium",
        title: `Ticket volume spike`,
        detail: `${last7} new tickets last 7d vs ${prev7} prior — ${Math.round(((last7 - prev7) / Math.max(1, prev7)) * 100)}% jump`,
        metric: last7,
      });
    }

    // Payment velocity drop (last 14d vs prior 14d)
    const pays = (pay.data ?? []).filter((p) => p.payment_date);
    const p14 = pays.filter((p) => daysBetween(p.payment_date!, now) <= 14).reduce((s, p) => s + Number(p.amount), 0);
    const pPrev = pays.filter((p) => {
      const d = daysBetween(p.payment_date!, now);
      return d > 14 && d <= 28;
    }).reduce((s, p) => s + Number(p.amount), 0);
    if (pPrev > 0 && p14 < pPrev * 0.6) {
      signals.push({
        id: "pay-drop", module: "Payments", severity: p14 < pPrev * 0.3 ? "high" : "medium",
        title: `Payment velocity dropping`,
        detail: `$${p14.toFixed(0)} last 14d vs $${pPrev.toFixed(0)} prior — down ${Math.round((1 - p14 / pPrev) * 100)}%`,
        metric: p14,
      });
    }

    // Inactive high-value customers
    const custs = cust.data ?? [];
    custs.forEach((c, idx) => {
      if (c.status === "inactive") return;
      if (c.created_at && daysBetween(c.created_at, now) > 90 && c.status !== "active") {
        signals.push({
          id: `cust-${idx}`, module: "CRM", severity: "low",
          title: `Stale lead: ${c.name}`, detail: `No conversion in 90+ days`,
        });
      }
    });

    // AI narrative summary
    let summary = "No critical signals detected.";
    let recommendations: string[] = [];
    if (signals.length > 0) {
      try {
        const raw = await callAI(
          [
            {
              role: "system",
              content: "You are a business risk analyst. Given a JSON list of anomaly signals from an ERP, return JSON `{ headline: string, recommendations: string[] }`. Headline is one crisp sentence. Recommendations: 3 short, concrete actions (max 12 words each). Prioritize high-severity signals.",
            },
            { role: "user", content: JSON.stringify(signals.slice(0, 30)) },
          ],
          true,
        );
        const parsed = JSON.parse(raw);
        summary = parsed.headline ?? summary;
        recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 5) : [];
      } catch {
        /* keep defaults */
      }
    }

    // Health score
    const weight = { low: 2, medium: 6, high: 12 };
    const penalty = signals.reduce((s, x) => s + weight[x.severity], 0);
    const health = Math.max(0, Math.min(100, 100 - penalty));

    return {
      health,
      summary,
      recommendations,
      signals: signals.sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2 };
        return rank[a.severity] - rank[b.severity];
      }),
      scanned_at: now.toISOString(),
    };
  });
