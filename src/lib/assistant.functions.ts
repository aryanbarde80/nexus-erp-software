import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const schema = z.object({
  question: z.string().min(1).max(2000),
});

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Pull a compact snapshot of the user's ERP for grounding
    const [c, p, inv, pay, exp, t, tk, lv] = await Promise.all([
      supabase.from("customers").select("name,status,company").limit(50),
      supabase.from("products").select("name,stock,price,low_stock_threshold").limit(50),
      supabase.from("invoices").select("invoice_number,amount,status,due_date,issue_date").limit(50),
      supabase.from("payments").select("amount,method,payment_date").limit(50),
      supabase.from("expenses").select("amount,category,date,vendor").limit(50),
      supabase.from("tasks").select("title,status,priority,due_date").limit(50),
      supabase.from("tickets").select("subject,status,priority").limit(30),
      supabase.from("leave_requests").select("leave_type,status,start_date,end_date").limit(30),
    ]);

    const snapshot = {
      customers: c.data ?? [],
      products: p.data ?? [],
      invoices: inv.data ?? [],
      payments: pay.data ?? [],
      expenses: exp.data ?? [],
      tasks: t.data ?? [],
      tickets: tk.data ?? [],
      leave_requests: lv.data ?? [],
    };

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("Lovable AI is not configured.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are Nexus, an inline ERP assistant. Answer using ONLY the user's data snapshot provided below. " +
              "Be concise, use plain language, format numbers as USD when relevant, and bullet key findings. " +
              "If asked for trends or totals, compute them from the snapshot. If the data is empty say so.\n\n" +
              "DATA:\n" + JSON.stringify(snapshot).slice(0, 30000),
          },
          { role: "user", content: data.question },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Rate limit reached — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted — add credits in Lovable Cloud.");
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI error: ${t.slice(0, 200)}`);
    }

    const json: any = await res.json();
    const answer = json.choices?.[0]?.message?.content ?? "No response.";
    return { answer };
  });
