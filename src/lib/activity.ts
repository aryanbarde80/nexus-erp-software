import { supabase } from "@/integrations/supabase/client";

export type EntityType = "invoice" | "project" | "task" | "payment";

export async function logActivity(params: {
  userId: string;
  entityType: EntityType;
  entityId: string;
  action: string;
  description?: string;
}) {
  await supabase.from("activity_log").insert({
    user_id: params.userId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    description: params.description ?? null,
  });
}
