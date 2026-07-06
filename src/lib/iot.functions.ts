import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function callAI(messages: any[], json = false) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Lovable AI not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (res.status === 429) throw new Error("Rate limit — try again shortly");
  if (res.status === 402) throw new Error("AI credits exhausted");
  if (!res.ok) throw new Error(`AI error: ${(await res.text()).slice(0, 200)}`);
  const j: any = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

export const listDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("devices")
      .select("*").order("created_at", { ascending: false });
    if (error) throw error;
    const now = Date.now();
    return (data ?? []).map((d: any) => ({
      ...d,
      live: d.last_seen && now - new Date(d.last_seen).getTime() < 60_000,
    }));
  });

export const createDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; kind?: string; location?: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("devices").insert({
      user_id: context.userId,
      name: data.name,
      kind: data.kind ?? "esp32",
      location: data.location ?? null,
    }).select("*").single();
    if (error) throw error;
    return row;
  });

export const deleteDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("devices").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const rotateDeviceKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const newKey = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    const { data: row, error } = await context.supabase.from("devices")
      .update({ device_key: newKey }).eq("id", data.id).select("device_key").single();
    if (error) throw error;
    return row;
  });

export const getTelemetry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { deviceId: string; limit?: number }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("device_telemetry")
      .select("*").eq("device_id", data.deviceId)
      .order("recorded_at", { ascending: false }).limit(data.limit ?? 200);
    if (error) throw error;
    return rows ?? [];
  });

export const sendCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { deviceId: string; command: string; args?: any }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("device_commands").insert({
      device_id: data.deviceId, user_id: context.userId,
      command: data.command, args: data.args ?? {},
    }).select("*").single();
    if (error) throw error;
    return row;
  });

export const listRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("device_rules")
      .select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const createRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    name: string; metric: string; operator: string; threshold: number;
    action: string; device_id?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("device_rules").insert({
      user_id: context.userId,
      device_id: data.device_id ?? null,
      name: data.name, metric: data.metric,
      operator: data.operator, threshold: data.threshold, action: data.action,
    }).select("*").single();
    if (error) throw error;
    return row;
  });

export const toggleRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("device_rules")
      .update({ enabled: data.enabled }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("device_rules").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const aiAnalyzeDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { deviceId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: device } = await context.supabase.from("devices").select("*").eq("id", data.deviceId).single();
    const { data: rows } = await context.supabase.from("device_telemetry")
      .select("metric,value,unit,recorded_at").eq("device_id", data.deviceId)
      .order("recorded_at", { ascending: false }).limit(150);
    if (!rows?.length) return { insight: "No telemetry yet. Send data from the device first.", anomalies: [], suggested_rules: [] };

    const byMetric: Record<string, number[]> = {};
    for (const r of rows) (byMetric[r.metric] ??= []).push(Number(r.value));
    const stats = Object.entries(byMetric).map(([m, vs]) => {
      const mean = vs.reduce((s, v) => s + v, 0) / vs.length;
      const std = Math.sqrt(vs.reduce((s, v) => s + (v - mean) ** 2, 0) / vs.length);
      return { metric: m, count: vs.length, mean: +mean.toFixed(3), std: +std.toFixed(3), min: Math.min(...vs), max: Math.max(...vs), latest: vs[0] };
    });

    const raw = await callAI([
      { role: "system", content: `IoT edge analytics expert. Return JSON: {"insight":"<=40 words plain English","anomalies":[{"metric":"","reason":"<=15 words"}],"suggested_rules":[{"name":"","metric":"","operator":">","threshold":0,"action":"alert"}]} — max 3 anomalies, max 3 suggested rules.` },
      { role: "user", content: `Device "${device?.name}" (${device?.kind}). Stats: ${JSON.stringify(stats)}` },
    ], true);
    try { return JSON.parse(raw); } catch { return { insight: raw, anomalies: [], suggested_rules: [] }; }
  });
