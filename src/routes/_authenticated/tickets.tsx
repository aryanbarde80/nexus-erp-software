import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/nexus/PageHeader";
import { CreateDialog } from "@/components/nexus/CreateDialog";
import { RowDelete } from "@/components/nexus/RowDelete";
import { StatCard } from "@/components/nexus/StatCard";
import { SmartReplyButton } from "@/components/nexus/SmartReply";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LifeBuoy, AlertCircle, CheckCircle2, Wand2, Timer, History, ThumbsUp, ThumbsDown } from "lucide-react";
import { autoPrioritizeTickets, predictTicketSla, submitSlaFeedback } from "@/lib/ml.functions";

export const Route = createFileRoute("/_authenticated/tickets")({ component: Tickets });

function Tickets() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const customersQ = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("id,name")).data ?? [],
  });
  const q = useQuery({
    queryKey: ["tickets-with-customer"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets").select("*, customers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Audit trail for auto_prioritize
  const auditQ = useQuery({
    queryKey: ["ticket-audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("entity_id, description, created_at")
        .eq("entity_type", "ticket")
        .eq("action", "auto_prioritize")
        .order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });
  const auditByTicket = useMemo(() => {
    const m = new Map<string, any[]>();
    (auditQ.data ?? []).forEach((a: any) => {
      const arr = m.get(a.entity_id) ?? [];
      arr.push(a); m.set(a.entity_id, arr);
    });
    return m;
  }, [auditQ.data]);

  // SLA predictions for open tickets
  const openTickets = useMemo(
    () => (q.data ?? []).filter((t: any) => t.status !== "closed" && t.status !== "resolved"),
    [q.data]
  );
  const slaFn = useServerFn(predictTicketSla);
  const slaQ = useQuery({
    queryKey: ["ticket-sla", openTickets.map((t: any) => t.id).join(",")],
    enabled: openTickets.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: () => slaFn({ data: { tickets: openTickets.slice(0, 50).map((t: any) => ({
      id: t.id, subject: t.subject, description: t.description, priority: t.priority, created_at: t.created_at,
    })) } }),
  });
  const slaByTicket = useMemo(() => {
    const m = new Map<string, any>();
    (slaQ.data?.predictions ?? []).forEach((p: any) => m.set(p.id, p));
    return m;
  }, [slaQ.data]);

  // Existing SLA feedback so we can highlight the user's prior rating
  const slaFeedbackQ = useQuery({
    queryKey: ["sla-feedback"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sla_feedback")
        .select("ticket_id,rating")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const feedbackByTicket = useMemo(() => {
    const m = new Map<string, "up" | "down">();
    (slaFeedbackQ.data ?? []).forEach((r: any) => { if (!m.has(r.ticket_id)) m.set(r.ticket_id, r.rating); });
    return m;
  }, [slaFeedbackQ.data]);

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [customer, setCustomer] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignee, setAssignee] = useState("");

  const add = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("tickets").insert({
      user_id: user.id, subject,
      description: description || null,
      customer_id: customer || null,
      priority, assignee: assignee || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Ticket created");
    setSubject(""); setDescription(""); setCustomer(""); setPriority("medium"); setAssignee("");
    qc.invalidateQueries({ queryKey: ["tickets-with-customer"] });
  };

  const setStatus = async (id: string, s: string) => {
    const { error } = await supabase.from("tickets").update({ status: s }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tickets-with-customer"] });
  };

  const rows = (q.data ?? []).filter((t: any) =>
    !search || `${t.subject} ${t.customers?.name ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );
  const open = (q.data ?? []).filter((t: any) => t.status === "open").length;
  const closed = (q.data ?? []).filter((t: any) => t.status === "closed").length;
  const urgent = (q.data ?? []).filter((t: any) => t.priority === "urgent" && t.status !== "closed").length;

  return (
    <TooltipProvider delayDuration={200}>
    <div>
      <PageHeader title="Support tickets" subtitle="Customer support and issue tracking." />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Open" value={String(open)} icon={LifeBuoy} />
        <StatCard label="Urgent" value={String(urgent)} icon={AlertCircle} />
        <StatCard label="Resolved" value={String(closed)} icon={CheckCircle2} />
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <Input placeholder="Search tickets…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <div className="flex items-center gap-2">
          <AutoPrioritize />
          <CreateDialog title="New ticket" triggerLabel="Add ticket" busy={busy} onSubmit={add}>
          <Field label="Subject"><Input required value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
          <Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Field label="Customer">
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customersQ.data?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Assignee"><Input value={assignee} onChange={(e) => setAssignee(e.target.value)} /></Field>
          </div>
          </CreateDialog>
        </div>
      </div>

      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1">
                    <Timer className="h-3.5 w-3.5" /> AI SLA
                    {slaQ.isFetching && <span className="text-[10px] text-muted-foreground">…</span>}
                  </span>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? rows.map((t: any) => {
                const sla = slaByTicket.get(t.id);
                const audit = auditByTicket.get(t.id) ?? [];
                const riskCls =
                  sla?.risk === "high" ? "border-destructive/40 text-destructive bg-destructive/10"
                  : sla?.risk === "medium" ? "border-amber-500/40 text-amber-600 bg-amber-500/10"
                  : "border-emerald-500/40 text-emerald-600 bg-emerald-500/10";
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        <span>{t.subject}</span>
                        {audit.length > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="cursor-help gap-1 border-primary/40 text-[10px] text-primary">
                                <History className="h-2.5 w-2.5" /> {audit.length}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <p className="mb-1 text-xs font-semibold">AI auto-prioritize history</p>
                              <ul className="space-y-1.5 text-xs">
                                {audit.slice(0, 5).map((a: any, i: number) => (
                                  <li key={i} className="border-l-2 border-primary/40 pl-2">
                                    <p className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                                    <p>{a.description}</p>
                                  </li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.customers?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={t.priority === "urgent" ? "destructive" : t.priority === "high" ? "default" : "secondary"}>{t.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      {t.status === "closed" || t.status === "resolved" ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : sla ? (
                        <div className="flex items-center gap-1.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`inline-flex cursor-help items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs ${riskCls}`}>
                                <span className="font-semibold">~{sla.eta_hours}h</span>
                                <span className="opacity-75">· {sla.risk}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">{sla.reason}</p>
                            </TooltipContent>
                          </Tooltip>
                          <SlaFeedback
                            ticketId={t.id}
                            prediction={sla}
                            current={feedbackByTicket.get(t.id)}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{slaQ.isFetching ? "…" : "—"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select value={t.status} onValueChange={(v) => setStatus(t.id, v)}>
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <SmartReplyButton ticket={t} />
                      <RowDelete table="tickets" id={t.id} invalidateKeys={[["tickets-with-customer"]]} />
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No tickets yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function AutoPrioritize() {
  const qc = useQueryClient();
  const fn = useServerFn(autoPrioritizeTickets);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const t = toast.loading("AI is triaging your tickets…");
    try {
      const res = await fn({});
      if (res.updated === 0) {
        toast.success("No changes — priorities already accurate", { id: t });
      } else {
        toast.success(
          `Re-prioritized ${res.updated} ticket${res.updated === 1 ? "" : "s"} — see ticket history for AI reasoning`,
          { id: t },
        );
      }
      qc.invalidateQueries({ queryKey: ["tickets-with-customer"] });
      qc.invalidateQueries({ queryKey: ["ticket-audit"] });
      qc.invalidateQueries({ queryKey: ["activity-feed"] });
    } catch (e: any) {
      toast.error(e.message ?? "Triage failed", { id: t });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={run} disabled={busy}>
      <Wand2 className="mr-2 h-3.5 w-3.5" /> {busy ? "Triaging…" : "AI auto-prioritize"}
    </Button>
  );
}

function SlaFeedback({
  ticketId,
  prediction,
  current,
}: {
  ticketId: string;
  prediction: { eta_hours?: number; risk?: string; reason?: string };
  current?: "up" | "down";
}) {
  const qc = useQueryClient();
  const fn = useServerFn(submitSlaFeedback);
  const [busy, setBusy] = useState(false);
  const rate = async (rating: "up" | "down") => {
    if (busy) return;
    setBusy(true);
    try {
      await fn({
        data: {
          ticket_id: ticketId,
          rating,
          predicted_eta_hours: prediction.eta_hours ?? null,
          predicted_risk: prediction.risk ?? null,
          reason: prediction.reason ?? null,
        },
      });
      toast.success(rating === "up" ? "Thanks — logged as accurate" : "Thanks — we'll learn from this");
      qc.invalidateQueries({ queryKey: ["sla-feedback"] });
      qc.invalidateQueries({ queryKey: ["ticket-audit"] });
      qc.invalidateQueries({ queryKey: ["activity-feed"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save feedback");
    } finally {
      setBusy(false);
    }
  };
  const base = "inline-flex h-6 w-6 items-center justify-center rounded border transition-colors disabled:opacity-50";
  return (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="SLA prediction was accurate"
            disabled={busy}
            onClick={() => rate("up")}
            className={`${base} ${current === "up" ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-600" : "border-border/60 text-muted-foreground hover:text-emerald-600 hover:border-emerald-500/40"}`}
          >
            <ThumbsUp className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent><p className="text-xs">Prediction was accurate</p></TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="SLA prediction was off"
            disabled={busy}
            onClick={() => rate("down")}
            className={`${base} ${current === "down" ? "border-destructive/60 bg-destructive/15 text-destructive" : "border-border/60 text-muted-foreground hover:text-destructive hover:border-destructive/40"}`}
          >
            <ThumbsDown className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent><p className="text-xs">Prediction was off — the model will adjust</p></TooltipContent>
      </Tooltip>
    </div>
  );
}
