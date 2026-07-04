import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------- helpers ----------
async function callVisionAI(prompt: string, image: string, opts: { json?: boolean; system?: string } = {}) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Lovable AI is not configured.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (res.status === 429) throw new Error("Rate limit reached — try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted.");
  if (!res.ok) throw new Error(`Vision AI error: ${(await res.text()).slice(0, 200)}`);
  const j: any = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

const imgSchema = z.string().max(8_500_000).refine(
  (s) => s.startsWith("data:image/") || s.startsWith("https://"),
  "image must be a data URL or https URL"
);

// ---------- 1. Receipt / invoice scanner → structured expense ----------
export const scanReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ image: imgSchema }).parse(d))
  .handler(async ({ data }) => {
    const raw = await callVisionAI(
      `Extract this receipt/invoice as JSON:
{"vendor":"...","date":"YYYY-MM-DD","total":number,"currency":"USD|EUR|...","tax":number|null,
"category":"Travel|Software|Marketing|Office|Payroll|Utilities|Equipment|Meals|Professional Services|Other",
"description":"<=15 word summary","line_items":[{"name":"...","qty":number,"price":number}],
"confidence":0-1,"warnings":["<=10 words",...]}
Use today's date if not visible. Total must be a number in the detected currency.`,
      data.image,
      { json: true, system: "You are a precise OCR + accounting assistant. Output ONLY valid JSON." }
    );
    try { return JSON.parse(raw); } catch { return { vendor: "", total: 0, category: "Other", confidence: 0, warnings: ["parse_failed"] }; }
  });

// ---------- 2. Save scanned receipt as an expense ----------
const saveSchema = z.object({
  vendor: z.string().max(200).optional().nullable(),
  amount: z.number().min(0).max(10_000_000),
  category: z.string().max(60).optional().nullable(),
  date: z.string().max(20).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});
export const saveScannedExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const date = data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : new Date().toISOString().slice(0, 10);
    const { data: row, error } = await supabase.from("expenses").insert({
      user_id: userId,
      vendor: data.vendor ?? "Unknown",
      amount: data.amount,
      category: data.category ?? "Other",
      date,
      description: data.description ?? "Scanned from receipt (Vision AI)",
    }).select("id").single();
    if (error) throw new Error(error.message);
    await supabase.from("activity_log").insert({
      user_id: userId,
      entity_type: "expense",
      entity_id: row.id,
      action: "vision_scan",
      description: `AI scanned receipt from ${data.vendor ?? "vendor"} · ${data.amount} ${data.category ?? ""}`.trim(),
    });
    return { id: row.id };
  });

// ---------- 3. Product image → identify + match inventory ----------
export const identifyProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ image: imgSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const raw = await callVisionAI(
      `Identify the product in the image. Return JSON:
{"name":"...","category":"...","brand":"...","attributes":["color","material","..."],"description":"<=30 words","keywords":["...","..."]}`,
      data.image,
      { json: true, system: "You are a product cataloger. Output ONLY JSON." }
    );
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch {}
    const q = [parsed.name, parsed.brand, ...(parsed.keywords ?? [])].filter(Boolean).join(" ");
    let matches: any[] = [];
    if (q) {
      const { data: prods } = await supabase
        .from("products")
        .select("id,name,sku,price,stock")
        .or(`name.ilike.%${(parsed.name ?? "").slice(0, 40)}%,description.ilike.%${(parsed.name ?? "").slice(0, 40)}%`)
        .limit(5);
      matches = prods ?? [];
    }
    return { ...parsed, matches };
  });

// ---------- 4. Asset condition / damage inspection ----------
export const inspectAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ image: imgSchema, asset_name: z.string().max(200).optional().nullable() }).parse(d))
  .handler(async ({ data }) => {
    const raw = await callVisionAI(
      `Inspect this business asset${data.asset_name ? ` ("${data.asset_name}")` : ""} for wear, damage, safety issues, and estimated condition. Return JSON:
{"condition":"excellent|good|fair|poor|critical","score":0-100,
"observations":["<=15 words each",...],
"damage":[{"area":"...","severity":"minor|moderate|severe","note":"<=15 words"}],
"recommended_action":"<=25 words","urgency":"low|medium|high"}`,
      data.image,
      { json: true, system: "You are a facilities/asset inspector. Be specific and conservative. Output ONLY JSON." }
    );
    try { return JSON.parse(raw); } catch { return { condition: "unknown", score: 0, observations: [], damage: [], recommended_action: "", urgency: "low" }; }
  });

// ---------- 5. Whiteboard / notes → structured tasks ----------
export const whiteboardToTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ image: imgSchema }).parse(d))
  .handler(async ({ data }) => {
    const raw = await callVisionAI(
      `Read this whiteboard / notes / sticky notes image. Extract action items. Return JSON:
{"summary":"<=25 words","tasks":[{"title":"<=12 words","priority":"low|medium|high|urgent","owner":"name or null","due_hint":"today|this_week|next_week|null"}]}`,
      data.image,
      { json: true, system: "You extract actionable tasks from meeting notes and whiteboards. Output ONLY JSON." }
    );
    try { return JSON.parse(raw); } catch { return { summary: "", tasks: [] }; }
  });

// ---------- 6. Bulk-create tasks from whiteboard scan ----------
const bulkTasksSchema = z.object({
  tasks: z.array(z.object({
    title: z.string().min(1).max(200),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    due_hint: z.string().max(20).optional().nullable(),
  })).max(30),
});
export const createTasksFromScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bulkTasksSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const dueFor = (hint?: string | null) => {
      const d = new Date();
      if (hint === "today") return d.toISOString().slice(0, 10);
      if (hint === "this_week") { d.setDate(d.getDate() + 5); return d.toISOString().slice(0, 10); }
      if (hint === "next_week") { d.setDate(d.getDate() + 10); return d.toISOString().slice(0, 10); }
      return null;
    };
    const rows = data.tasks.map(t => ({
      user_id: userId,
      title: t.title,
      priority: t.priority ?? "medium",
      status: "todo",
      due_date: dueFor(t.due_hint),
      description: "Captured via Vision AI (whiteboard scan)",
    }));
    const { error, data: inserted } = await supabase.from("tasks").insert(rows).select("id");
    if (error) throw new Error(error.message);
    await supabase.from("activity_log").insert({
      user_id: userId,
      entity_type: "task",
      entity_id: inserted?.[0]?.id ?? null,
      action: "vision_scan",
      description: `AI created ${inserted?.length ?? 0} task(s) from whiteboard scan`,
    });
    return { created: inserted?.length ?? 0 };
  });

// ---------- 7. Business card → customer lead ----------
export const scanBusinessCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ image: imgSchema }).parse(d))
  .handler(async ({ data }) => {
    const raw = await callVisionAI(
      `Extract business card fields as JSON:
{"name":"...","company":"...","title":"...","email":"...","phone":"...","website":"...","address":"...","notes":"<=20 words"}`,
      data.image,
      { json: true, system: "You extract contact info from business cards. Output ONLY JSON." }
    );
    try { return JSON.parse(raw); } catch { return {}; }
  });

const saveLeadSchema = z.object({
  name: z.string().min(1).max(200),
  company: z.string().max(200).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});
export const saveScannedLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveLeadSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("customers").insert({
      user_id: userId,
      name: data.name,
      company: data.company ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      status: "lead",
      notes: data.notes ?? "Captured via Vision AI (business card scan)",
    }).select("id").single();
    if (error) throw new Error(error.message);
    await supabase.from("activity_log").insert({
      user_id: userId,
      entity_type: "customer",
      entity_id: row.id,
      action: "vision_scan",
      description: `AI captured lead "${data.name}" from business card`,
    });
    return { id: row.id };
  });
