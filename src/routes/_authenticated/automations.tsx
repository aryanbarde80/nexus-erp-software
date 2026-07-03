import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Zap, Play, Plus, Trash2, Sparkles, CheckCircle2, Pause } from "lucide-react";
import { PageHeader } from "@/components/nexus/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listAutomations, createAutomation, toggleAutomation, deleteAutomation,
  runAutomations, suggestAutomations, TRIGGERS, ACTIONS,
} from "@/lib/automations.functions";

export const Route = createFileRoute("/_authenticated/automations")({
  component: AutomationsPage,
});

function AutomationsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listAutomations);
  const create = useServerFn(createAutomation);
  const toggle = useServerFn(toggleAutomation);
  const del = useServerFn(deleteAutomation);
  const run = useServerFn(runAutomations);
  const suggest = useServerFn(suggestAutomations);

  const { data: rules = [] } = useQuery({ queryKey: ["automations"], queryFn: () => list() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", trigger: "invoice_overdue",
    action: "create_task", title: "", priority: "high", hours: 4, days: 2, amount: 1000,
  });

  const runMut = useMutation({
    mutationFn: (id?: string) => run({ data: id ? { id } : {} }),
    onSuccess: (r: any) => {
      const total = r.results.reduce((s: number, x: any) => s + (x.executed || 0), 0);
      toast.success(`Ran ${r.ran} rule(s), created ${total} item(s)`);
      qc.invalidateQueries({ queryKey: ["automations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const params: any = {};
      if (form.trigger === "ticket_urgent_open") params.hours = form.hours;
      if (form.trigger === "task_due_soon") params.days = form.days;
      if (form.trigger === "customer_inactive") params.days = form.days;
      if (form.trigger === "large_expense") params.amount = form.amount;
      const action_params: any = { title: form.title || undefined };
      if (form.action === "create_task") action_params.priority = form.priority;
      return create({
        data: {
          name: form.name, description: form.description || null,
          trigger: form.trigger, params, action: form.action, action_params, enabled: true,
        },
      });
    },
    onSuccess: () => {
      toast.success("Automation created");
      setOpen(false);
      setForm({ ...form, name: "", description: "", title: "" });
      qc.invalidateQueries({ queryKey: ["automations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const suggestMut = useMutation({
    mutationFn: () => suggest(),
    onSuccess: async (r: any) => {
      for (const s of r.suggestions) {
        await create({ data: { ...s, description: "Suggested by AI", enabled: true } });
      }
      toast.success(`Added ${r.suggestions.length} suggested rules`);
      qc.invalidateQueries({ queryKey: ["automations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Automations"
        subtitle="Rules that watch your data and take action automatically."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => suggestMut.mutate()} disabled={suggestMut.isPending}>
              <Sparkles className="mr-2 h-4 w-4" />AI suggest
            </Button>
            <Button variant="outline" onClick={() => runMut.mutate(undefined)} disabled={runMut.isPending}>
              <Play className="mr-2 h-4 w-4" />Run all
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />New rule</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>New automation</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Chase overdue invoices" /></div>
                  <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  <div>
                    <Label>When (trigger)</Label>
                    <Select value={form.trigger} onValueChange={(v) => setForm({ ...form, trigger: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TRIGGERS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {form.trigger === "ticket_urgent_open" && (
                    <div><Label>Hours open</Label><Input type="number" value={form.hours} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} /></div>
                  )}
                  {(form.trigger === "task_due_soon" || form.trigger === "customer_inactive") && (
                    <div><Label>Days</Label><Input type="number" value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })} /></div>
                  )}
                  {form.trigger === "large_expense" && (
                    <div><Label>Amount threshold ($)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
                  )}
                  <div>
                    <Label>Then (action)</Label>
                    <Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ACTIONS.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Follow up on overdue invoices" /></div>
                  {form.action === "create_task" && (
                    <div>
                      <Label>Priority</Label>
                      <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-3">
        {rules.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <Zap className="h-10 w-10 opacity-40" />
              <p>No automations yet. Click <b>AI suggest</b> to bootstrap rules from your data.</p>
            </CardContent>
          </Card>
        )}
        {rules.map((r: any) => {
          const trig = TRIGGERS.find((t) => t.id === r.trigger)?.label ?? r.trigger;
          const act = ACTIONS.find((a) => a.id === r.action)?.label ?? r.action;
          return (
            <Card key={r.id} className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <Zap className={`h-4 w-4 ${r.enabled ? "text-primary" : "text-muted-foreground"}`} />
                  <CardTitle className="text-base">{r.name}</CardTitle>
                  <Badge variant={r.enabled ? "default" : "secondary"}>{r.enabled ? "Active" : "Paused"}</Badge>
                  {r.total_runs > 0 && <Badge variant="outline"><CheckCircle2 className="mr-1 h-3 w-3" />{r.total_runs} runs</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={r.enabled} onCheckedChange={async (v) => {
                    await toggle({ data: { id: r.id, enabled: v } });
                    qc.invalidateQueries({ queryKey: ["automations"] });
                  }} />
                  <Button size="sm" variant="outline" onClick={() => runMut.mutate(r.id)}>
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    await del({ data: { id: r.id } });
                    qc.invalidateQueries({ queryKey: ["automations"] });
                    toast.success("Deleted");
                  }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p><b className="text-foreground">When</b> {trig} <b className="text-foreground">→ Then</b> {act}</p>
                {r.description && <p className="mt-1 italic">{r.description}</p>}
                {r.last_run_at && (
                  <p className="mt-2 text-xs">Last run: {new Date(r.last_run_at).toLocaleString()} — matched {r.last_run_count}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
