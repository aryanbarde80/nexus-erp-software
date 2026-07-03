import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const TRIGGERS = [
  { id: "invoice_overdue", label: "Invoice becomes overdue" },
  { id: "low_stock", label: "Product hits low stock" },
  { id: "ticket_urgent_open", label: "Urgent ticket stays open > N hours" },
  { id: "task_due_soon", label: "Task due within N days" },
  { id: "customer_inactive", label: "Customer inactive > N days" },
  { id: "large_expense", label: "Expense over threshold logged" },
] as const;

export const ACTIONS = [
  { id: "create_task", label: "Create a task" },
  { id: "create_reminder", label: "Create a reminder" },
  { id: "log_activity", label: "Log an activity entry" },
] as const;

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  trigger: z.string().min(1),
  params: z.record(z.string(), z.any()).default({}),
  action: z.string().min(1),
  action_params: z.record(z.string(), z.any()).default({}),
  enabled: z.boolean().default(true),
});

export const listAutomations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("automations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("automations")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const toggleAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("automations")
      .update({ enabled: data.enabled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("automations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Evaluate a trigger and return list of matching entity descriptions
async function evaluateTrigger(supabase: any, userId: string, trigger: string, params: any): Promise<string[]> {
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  switch (trigger) {
    case "invoice_overdue": {
      const { data } = await supabase
        .from("invoices")
        .select("invoice_number, amount, due_date, status")
        .in("status", ["sent", "overdue"])
        .lt("due_date", today);
      return (data ?? []).map((i: any) => `Invoice ${i.invoice_number} ($${i.amount}) overdue since ${i.due_date}`);
    }
    case "low_stock": {
      const { data } = await supabase.from("products").select("name, stock, low_stock_threshold");
      return (data ?? [])
        .filter((p: any) => Number(p.stock) <= Number(p.low_stock_threshold))
        .map((p: any) => `${p.name} low on stock (${p.stock} left)`);
    }
    case "ticket_urgent_open": {
      const hours = Number(params.hours ?? 4);
      const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
      const { data } = await supabase
        .from("tickets")
        .select("subject, priority, status, created_at")
        .eq("priority", "urgent")
        .neq("status", "closed")
        .lt("created_at", cutoff);
      return (data ?? []).map((t: any) => `Urgent ticket open >${hours}h: ${t.subject}`);
    }
    case "task_due_soon": {
      const days = Number(params.days ?? 2);
      const soon = new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("tasks")
        .select("title, due_date, status")
        .neq("status", "done")
        .lte("due_date", soon)
        .gte("due_date", today);
      return (data ?? []).map((t: any) => `Task "${t.title}" due ${t.due_date}`);
    }
    case "customer_inactive": {
      const days = Number(params.days ?? 60);
      const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
      const { data } = await supabase
        .from("customers")
        .select("name, updated_at")
        .lt("updated_at", cutoff);
      return (data ?? []).map((c: any) => `Customer "${c.name}" inactive since ${c.updated_at?.slice(0, 10)}`);
    }
    case "large_expense": {
      const threshold = Number(params.amount ?? 1000);
      const since = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("expenses")
        .select("vendor, amount, category, date")
        .gte("date", since)
        .gte("amount", threshold);
      return (data ?? []).map((e: any) => `Large expense $${e.amount} — ${e.vendor ?? e.category}`);
    }
    default:
      return [];
  }
}

async function executeAction(
  supabase: any,
  userId: string,
  action: string,
  actionParams: any,
  matches: string[],
  automationName: string,
) {
  if (!matches.length) return 0;
  const summary = matches.slice(0, 10).join("; ");
  const title = String(actionParams.title || `Automation: ${automationName}`);
  switch (action) {
    case "create_task": {
      await supabase.from("tasks").insert({
        user_id: userId,
        title,
        description: `Auto-created by "${automationName}". Matches:\n- ${matches.join("\n- ")}`,
        priority: String(actionParams.priority || "high"),
        status: "todo",
        due_date: actionParams.due_date ?? null,
      });
      return matches.length;
    }
    case "create_reminder": {
      await supabase.from("reminders").insert({
        user_id: userId,
        title,
        notes: summary,
        remind_at: actionParams.remind_at ?? new Date(Date.now() + 3600_000).toISOString(),
        status: "pending",
      });
      return matches.length;
    }
    case "log_activity":
    default: {
      await supabase.from("activity_log").insert({
        user_id: userId,
        entity_type: "automation",
        entity_id: automationName,
        action: "triggered",
        description: `${automationName} matched ${matches.length}: ${summary}`.slice(0, 500),
      });
      return matches.length;
    }
  }
}

export const runAutomations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let query = supabase.from("automations").select("*").eq("enabled", true);
    if (data.id) query = query.eq("id", data.id);
    const { data: rules, error } = await query;
    if (error) throw new Error(error.message);

    const results: any[] = [];
    for (const rule of rules ?? []) {
      try {
        const matches = await evaluateTrigger(supabase, userId, rule.trigger, rule.params ?? {});
        const count = await executeAction(supabase, userId, rule.action, rule.action_params ?? {}, matches, rule.name);
        await supabase
          .from("automations")
          .update({
            last_run_at: new Date().toISOString(),
            last_run_count: count,
            total_runs: (rule.total_runs ?? 0) + (count > 0 ? 1 : 0),
          })
          .eq("id", rule.id);
        results.push({ id: rule.id, name: rule.name, matched: matches.length, executed: count });
      } catch (e: any) {
        results.push({ id: rule.id, name: rule.name, error: e.message });
      }
    }
    return { results, ran: results.length };
  });

export const suggestAutomations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [inv, prod, tk] = await Promise.all([
      supabase.from("invoices").select("status").limit(200),
      supabase.from("products").select("stock, low_stock_threshold").limit(200),
      supabase.from("tickets").select("priority, status").limit(200),
    ]);
    const overdue = (inv.data ?? []).filter((i: any) => i.status === "overdue").length;
    const low = (prod.data ?? []).filter((p: any) => Number(p.stock) <= Number(p.low_stock_threshold)).length;
    const urgent = (tk.data ?? []).filter((t: any) => t.priority === "urgent" && t.status !== "closed").length;

    const suggestions = [];
    if (overdue > 0)
      suggestions.push({
        name: "Chase overdue invoices",
        trigger: "invoice_overdue",
        params: {},
        action: "create_task",
        action_params: { title: "Follow up overdue invoices", priority: "high" },
      });
    if (low > 0)
      suggestions.push({
        name: "Restock alert",
        trigger: "low_stock",
        params: {},
        action: "create_reminder",
        action_params: { title: "Order stock for low items" },
      });
    if (urgent > 0)
      suggestions.push({
        name: "Escalate stale urgent tickets",
        trigger: "ticket_urgent_open",
        params: { hours: 4 },
        action: "create_task",
        action_params: { title: "Escalate urgent tickets", priority: "urgent" },
      });
    suggestions.push({
      name: "Weekly re-engagement",
      trigger: "customer_inactive",
      params: { days: 60 },
      action: "create_task",
      action_params: { title: "Re-engage inactive customers", priority: "medium" },
    });
    return { suggestions };
  });
