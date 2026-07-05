import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const INTENT_SCHEMA = `{
  "transcript": string,
  "intent": "create_task" | "create_expense" | "create_reminder" | "create_lead" | "navigate" | "query" | "unknown",
  "confidence": number (0-1),
  "params": {
    "title"?: string,
    "priority"?: "low" | "medium" | "high" | "urgent",
    "due_hint"?: string,
    "amount"?: number,
    "vendor"?: string,
    "category"?: string,
    "date"?: string (YYYY-MM-DD),
    "name"?: string,
    "company"?: string,
    "email"?: string,
    "phone"?: string,
    "remind_at"?: string (ISO),
    "note"?: string,
    "route"?: string (one of /dashboard /sales /inventory /tickets /finance /reports /goals /automations /vision /radar),
    "question"?: string
  },
  "confirmation": string (1 short sentence describing what will happen)
}`;

async function callAI(body: any) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Lovable AI is not configured.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("Rate limit reached — try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted.");
  if (!res.ok) throw new Error(`AI error: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const parseInput = z.object({
  audio: z.string().optional(), // data URL data:audio/webm;base64,...
  audio_format: z.string().optional(),
  text: z.string().optional(),
});

export const parseVoiceCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInput.parse(d))
  .handler(async ({ data }) => {
    const system = {
      role: "system",
      content:
        "You are Nexus Copilot, a voice-driven ERP assistant. Transcribe the user's audio (if any) and classify their intent, then return STRICT JSON matching this schema:\n" +
        INTENT_SCHEMA +
        "\nRules: Never invent data. If the user just asks a question, use intent='query' and put it in params.question. If they want to open a page, use intent='navigate'. Priority defaults to 'medium'. Confirmation is one short sentence in the user's language.",
    };

    let userContent: any;
    if (data.audio) {
      const m = data.audio.match(/^data:audio\/([\w+.-]+);base64,(.+)$/);
      if (!m) throw new Error("Invalid audio payload");
      const format = (data.audio_format || m[1] || "webm").split(";")[0];
      userContent = [
        { type: "text", text: "Understand this voice command and output the JSON only." },
        { type: "input_audio", input_audio: { data: m[2], format } },
      ];
    } else if (data.text) {
      userContent = data.text;
    } else {
      throw new Error("Provide audio or text");
    }

    const json = await callAI({
      model: "google/gemini-2.5-flash",
      messages: [system, { role: "user", content: userContent }],
      response_format: { type: "json_object" },
    });
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    try {
      return JSON.parse(raw);
    } catch {
      return { transcript: "", intent: "unknown", confidence: 0, params: {}, confirmation: "Could not understand." };
    }
  });

const execInput = z.object({
  intent: z.string(),
  params: z.record(z.string(), z.any()).default({}),
  transcript: z.string().optional(),
});

function hintToDate(hint?: string): string | null {
  if (!hint) return null;
  const now = new Date();
  const h = hint.toLowerCase();
  if (h.includes("today")) return now.toISOString().slice(0, 10);
  if (h.includes("tomorrow")) { now.setDate(now.getDate() + 1); return now.toISOString().slice(0, 10); }
  if (/next week/.test(h)) { now.setDate(now.getDate() + 7); return now.toISOString().slice(0, 10); }
  if (/\d{4}-\d{2}-\d{2}/.test(hint)) return hint.match(/\d{4}-\d{2}-\d{2}/)![0];
  return null;
}

export const executeCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => execInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const p = data.params as any;

    switch (data.intent) {
      case "create_task": {
        if (!p.title) throw new Error("Task title missing");
        const { error } = await supabase.from("tasks").insert({
          user_id: userId,
          title: p.title,
          priority: p.priority ?? "medium",
          status: "todo",
          due_date: hintToDate(p.due_hint) ?? null,
        });
        if (error) throw new Error(error.message);
        return { ok: true, message: `Task “${p.title}” created` };
      }
      case "create_expense": {
        if (!p.amount) throw new Error("Amount missing");
        const { error } = await supabase.from("expenses").insert({
          user_id: userId,
          amount: Number(p.amount),
          vendor: p.vendor ?? null,
          category: p.category ?? "General",
          date: p.date ?? new Date().toISOString().slice(0, 10),
          description: p.note ?? data.transcript ?? null,
        });
        if (error) throw new Error(error.message);
        return { ok: true, message: `Expense $${Number(p.amount).toFixed(2)} logged` };
      }
      case "create_reminder": {
        if (!p.title && !p.note) throw new Error("Reminder text missing");
        const { error } = await supabase.from("reminders").insert({
          user_id: userId,
          title: p.title ?? p.note,
          remind_at: p.remind_at ?? new Date(Date.now() + 3600_000).toISOString(),
          status: "pending",
        });
        if (error) throw new Error(error.message);
        return { ok: true, message: `Reminder set` };
      }
      case "create_lead": {
        if (!p.name) throw new Error("Lead name missing");
        const { error } = await supabase.from("customers").insert({
          user_id: userId,
          name: p.name,
          company: p.company ?? null,
          email: p.email ?? null,
          phone: p.phone ?? null,
          status: "lead",
        });
        if (error) throw new Error(error.message);
        return { ok: true, message: `Lead ${p.name} added` };
      }
      case "navigate":
      case "query":
        return { ok: true, message: "handled by client" };
      default:
        return { ok: false, message: "Unknown intent" };
    }
  });
