import { createFileRoute } from "@tanstack/react-router";

async function callAI(messages: any[], json = false) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  const j: any = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

export const Route = createFileRoute("/api/public/hooks/daily-briefing")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profiles } = await supabaseAdmin.from("profiles").select("id");
        const since = new Date(Date.now() - 7 * 86400000).toISOString();
        const sinceDate = since.slice(0, 10);
        const horizon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

        let generated = 0;
        for (const p of profiles ?? []) {
          try {
            const [inv, pay, exp, tk, lv, tasks] = await Promise.all([
              supabaseAdmin.from("invoices").select("amount,status,issue_date").eq("user_id", p.id).gte("issue_date", sinceDate),
              supabaseAdmin.from("payments").select("amount,payment_date").eq("user_id", p.id).gte("payment_date", sinceDate),
              supabaseAdmin.from("expenses").select("amount,category,date").eq("user_id", p.id).gte("date", sinceDate),
              supabaseAdmin.from("tickets").select("priority,status,created_at").eq("user_id", p.id).gte("created_at", since),
              supabaseAdmin.from("leave_requests").select("status,start_date").eq("user_id", p.id).gte("start_date", sinceDate),
              supabaseAdmin.from("tasks").select("status,due_date").eq("user_id", p.id).lte("due_date", horizon),
            ]);
            const stats = {
              week_revenue: (pay.data ?? []).reduce((s, x) => s + Number(x.amount), 0),
              week_invoices: inv.data?.length ?? 0,
              week_expenses: (exp.data ?? []).reduce((s, x) => s + Number(x.amount), 0),
              new_tickets: tk.data?.length ?? 0,
              urgent_tickets: (tk.data ?? []).filter(t => t.priority === "urgent" && t.status !== "closed").length,
              pending_leaves: (lv.data ?? []).filter(l => l.status === "pending").length,
              tasks_due_soon: (tasks.data ?? []).filter(t => t.status !== "done").length,
            };
            if (!stats.week_invoices && !stats.new_tickets && !stats.tasks_due_soon) continue;

            const raw = await callAI([
              { role: "system", content: "Morning briefing for an ERP owner. JSON: {\"greeting\":\"<=10 words\",\"summary\":\"<=40 words\",\"priorities\":[\"<=10 words\",\"\",\"\"]} — 3 priorities." },
              { role: "user", content: `Last 7 days: ${JSON.stringify(stats)}. Date: ${new Date().toDateString()}.` },
            ], true);
            const parsed = JSON.parse(raw);
            await supabaseAdmin.from("briefings").insert({
              user_id: p.id,
              greeting: parsed.greeting ?? "Good morning.",
              summary: parsed.summary ?? "",
              priorities: parsed.priorities ?? [],
              stats,
            });
            generated++;
          } catch (e) {
            console.error("briefing failed for", p.id, e);
          }
        }
        return Response.json({ ok: true, generated });
      },
    },
  },
});
