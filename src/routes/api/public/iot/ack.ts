import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-device-key",
};

export const Route = createFileRoute("/api/public/iot/ack")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const key = request.headers.get("x-device-key") ?? "";
          const body = await request.json() as { device_key?: string; command_id: string; result?: any; status?: string };
          const deviceKey = key || body.device_key || "";
          if (!deviceKey || !body.command_id) return Response.json({ error: "missing fields" }, { status: 400, headers: CORS });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: device } = await supabaseAdmin.from("devices").select("id").eq("device_key", deviceKey).maybeSingle();
          if (!device) return Response.json({ error: "unknown device" }, { status: 403, headers: CORS });

          await supabaseAdmin.from("device_commands").update({
            status: body.status ?? "acked",
            result: body.result ?? null,
            acked_at: new Date().toISOString(),
          }).eq("id", body.command_id).eq("device_id", device.id);

          return Response.json({ ok: true }, { headers: CORS });
        } catch (e: any) {
          return Response.json({ error: e.message ?? "ack failed" }, { status: 500, headers: CORS });
        }
      },
    },
  },
});
