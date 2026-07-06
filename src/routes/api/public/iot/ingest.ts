import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-device-key",
};

export const Route = createFileRoute("/api/public/iot/ingest")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const key = request.headers.get("x-device-key") ?? "";
          const body = await request.json() as {
            device_key?: string;
            metrics?: Array<{ metric: string; value: number; unit?: string }>;
            metric?: string; value?: number; unit?: string;
            payload?: any; firmware?: string;
          };
          const deviceKey = key || body.device_key || "";
          if (!deviceKey) return Response.json({ error: "missing device key" }, { status: 401, headers: CORS });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: device } = await supabaseAdmin.from("devices")
            .select("id,user_id").eq("device_key", deviceKey).maybeSingle();
          if (!device) return Response.json({ error: "unknown device" }, { status: 403, headers: CORS });

          const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
          const metrics = body.metrics ?? (body.metric && body.value != null ? [{ metric: body.metric, value: body.value, unit: body.unit }] : []);
          const rows = metrics.filter(m => m.metric && Number.isFinite(Number(m.value))).map(m => ({
            device_id: device.id, user_id: device.user_id,
            metric: m.metric, value: Number(m.value), unit: m.unit ?? null,
            payload: body.payload ?? {},
          }));
          if (rows.length) await supabaseAdmin.from("device_telemetry").insert(rows);

          await supabaseAdmin.from("devices").update({
            last_seen: new Date().toISOString(),
            last_ip: ip,
            status: "online",
            ...(body.firmware ? { firmware: body.firmware } : {}),
          }).eq("id", device.id);

          // Edge rules evaluation
          const triggered: any[] = [];
          const { data: rules } = await supabaseAdmin.from("device_rules")
            .select("*").eq("user_id", device.user_id).eq("enabled", true);
          for (const rule of rules ?? []) {
            if (rule.device_id && rule.device_id !== device.id) continue;
            const m = rows.find(r => r.metric === rule.metric);
            if (!m) continue;
            const v = m.value, t = Number(rule.threshold);
            let hit = false;
            switch (rule.operator) {
              case ">": hit = v > t; break;
              case ">=": hit = v >= t; break;
              case "<": hit = v < t; break;
              case "<=": hit = v <= t; break;
              case "==": hit = v === t; break;
              case "!=": hit = v !== t; break;
            }
            if (!hit) continue;
            triggered.push({ rule: rule.name, metric: rule.metric, value: v });
            await supabaseAdmin.from("device_rules")
              .update({ last_triggered_at: new Date().toISOString(), trigger_count: (rule.trigger_count ?? 0) + 1 })
              .eq("id", rule.id);
            if (rule.action === "alert") {
              await supabaseAdmin.from("reminders").insert({
                user_id: device.user_id,
                title: `IoT alert: ${rule.name}`,
                notes: `${rule.metric} = ${v} ${rule.operator} ${t}`,
                status: "pending",
              });
            } else if (rule.action === "log") {
              await supabaseAdmin.from("activity_log").insert({
                user_id: device.user_id, entity_type: "device", entity_id: device.id,
                action: "rule_triggered", description: `${rule.name}: ${rule.metric}=${v}`,
              });
            } else if (rule.action === "command") {
              await supabaseAdmin.from("device_commands").insert({
                device_id: device.id, user_id: device.user_id,
                command: (rule.action_args as any)?.command ?? "alert",
                args: (rule.action_args as any) ?? {},
              });
            }
          }

          // Pending commands to hand back to device
          const { data: cmds } = await supabaseAdmin.from("device_commands")
            .select("id,command,args").eq("device_id", device.id).eq("status", "pending")
            .order("created_at", { ascending: true }).limit(5);
          if (cmds?.length) {
            await supabaseAdmin.from("device_commands")
              .update({ status: "delivered", delivered_at: new Date().toISOString() })
              .in("id", cmds.map(c => c.id));
          }

          return Response.json({ ok: true, accepted: rows.length, triggered, commands: cmds ?? [] }, { headers: CORS });
        } catch (e: any) {
          return Response.json({ error: e.message ?? "ingest failed" }, { status: 500, headers: CORS });
        }
      },
    },
  },
});
