import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { LifeBuoy, AlertCircle, CheckCircle2, Wand2 } from "lucide-react";
import { autoPrioritizeTickets } from "@/lib/ml.functions";

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
        .from("tickets")
        .select("*, customers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [customer, setCustomer] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignee, setAssignee] = useState("");

  const add = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("tickets").insert({
      user_id: user.id,
      subject,
      description: description || null,
      customer_id: customer || null,
      priority,
      assignee: assignee || null,
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

      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? rows.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.subject}</TableCell>
                  <TableCell className="text-muted-foreground">{t.customers?.name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={t.priority === "urgent" ? "destructive" : t.priority === "high" ? "default" : "secondary"}>{t.priority}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.assignee || "—"}</TableCell>
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
                    <RowDelete table="tickets" id={t.id} invalidateKeys={[["tickets-with-customer"]]} />
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No tickets yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
