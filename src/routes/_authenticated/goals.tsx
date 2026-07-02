import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/nexus/PageHeader";
import { CreateDialog } from "@/components/nexus/CreateDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Target, Sparkles, Trash2, TrendingUp, Archive, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { StatCard } from "@/components/nexus/StatCard";
import {
  listGoals, createGoal, updateGoal, deleteGoal, coachGoal, suggestGoals,
} from "@/lib/goals.functions";

export const Route = createFileRoute("/_authenticated/goals")({ component: GoalsPage });

const METRICS: { value: string; label: string; unit: string }[] = [
  { value: "revenue", label: "Paid revenue", unit: "USD" },
  { value: "invoices_paid", label: "Invoices paid", unit: "count" },
  { value: "new_customers", label: "New customers", unit: "count" },
  { value: "tasks_done", label: "Tasks completed", unit: "count" },
  { value: "tickets_closed", label: "Tickets closed", unit: "count" },
  { value: "expenses_under", label: "Keep expenses under", unit: "USD" },
  { value: "stock_sold", label: "Units sold", unit: "count" },
];

function periodDates(period: string): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (period === "month") return { start: iso(new Date(y, m, 1)), end: iso(new Date(y, m + 1, 0)) };
  if (period === "quarter") {
    const qStart = Math.floor(m / 3) * 3;
    return { start: iso(new Date(y, qStart, 1)), end: iso(new Date(y, qStart + 3, 0)) };
  }
  if (period === "year") return { start: `${y}-01-01`, end: `${y}-12-31` };
  return { start: iso(now), end: iso(new Date(y, m + 1, 0)) };
}

function GoalsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listGoals);
  const create = useServerFn(createGoal);
  const update = useServerFn(updateGoal);
  const del = useServerFn(deleteGoal);
  const suggest = useServerFn(suggestGoals);

  const q = useQuery({ queryKey: ["goals"], queryFn: () => list({}) });

  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [metric, setMetric] = useState("revenue");
  const [target, setTarget] = useState("10000");
  const [period, setPeriod] = useState("month");

  const submit = async () => {
    setBusy(true);
    try {
      const { start, end } = periodDates(period);
      await create({ data: {
        title, description: description || null, metric_type: metric as any,
        target_value: Number(target), period: period as any, start_date: start, end_date: end,
      }});
      toast.success("Goal created");
      setTitle(""); setDescription(""); setTarget("10000");
      qc.invalidateQueries({ queryKey: ["goals"] });
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const runSuggest = async () => {
    setSuggesting(true);
    try {
      const r: any = await suggest({});
      setSuggestions(r.suggestions ?? []);
    } catch (e: any) { toast.error(e.message ?? "AI failed"); }
    finally { setSuggesting(false); }
  };

  const acceptSuggestion = async (s: any) => {
    const { start, end } = periodDates("month");
    await create({ data: {
      title: s.title, description: s.rationale ?? null, metric_type: s.metric_type,
      target_value: Number(s.target_value), period: "month", start_date: start, end_date: end,
    }});
    toast.success("Goal added");
    setSuggestions((xs) => xs.filter((x) => x !== s));
    qc.invalidateQueries({ queryKey: ["goals"] });
  };

  const goals: any[] = q.data?.goals ?? [];
  const active = goals.filter((g) => g.status === "active");
  const achieved = goals.filter((g) => g.status === "achieved").length;
  const onTrack = active.filter((g) => g.progress.onTrack).length;
  const behind = active.length - onTrack;

  return (
    <div>
      <PageHeader
        title="Goals & OKRs"
        subtitle="Set business targets that auto-track against your live data."
        actions={
          <>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={runSuggest}>
                  <Sparkles className="mr-2 h-4 w-4" /> AI suggest
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>AI-suggested goals</DialogTitle></DialogHeader>
                {suggesting ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Analyzing your business…
                  </div>
                ) : suggestions.length ? (
                  <div className="space-y-3">
                    {suggestions.map((s, i) => (
                      <div key={i} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{s.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {METRICS.find((m) => m.value === s.metric_type)?.label ?? s.metric_type} · target {s.target_value}
                            </p>
                            {s.rationale && <p className="mt-1 text-xs text-muted-foreground">{s.rationale}</p>}
                          </div>
                          <Button size="sm" onClick={() => acceptSuggestion(s)}>Add</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">Click "AI suggest" to generate goals from your data.</p>
                )}
              </DialogContent>
            </Dialog>

            <CreateDialog title="New goal" triggerLabel="Add goal" busy={busy} onSubmit={submit}>
              <Field label="Title"><Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Hit $50k in monthly revenue" /></Field>
              <Field label="Description"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Metric">
                  <Select value={metric} onValueChange={setMetric}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {METRICS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={`Target (${METRICS.find((m) => m.value === metric)?.unit ?? ""})`}>
                  <Input type="number" min="0" value={target} onChange={(e) => setTarget(e.target.value)} required />
                </Field>
              </div>
              <Field label="Period">
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">This month</SelectItem>
                    <SelectItem value="quarter">This quarter</SelectItem>
                    <SelectItem value="year">This year</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </CreateDialog>
          </>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Active goals" value={active.length} icon={Target} tone="primary" />
        <StatCard label="On track" value={onTrack} icon={TrendingUp} tone="success" />
        <StatCard label="Behind" value={behind} icon={AlertTriangle} tone="warning" />
        <StatCard label="Achieved" value={achieved} icon={CheckCircle2} tone="success" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {goals.length ? goals.map((g: any) => (
          <GoalCard key={g.id} g={g} onChanged={() => qc.invalidateQueries({ queryKey: ["goals"] })}
            update={update} del={del} />
        )) : (
          <Card className="md:col-span-2 border-border/60 shadow-soft">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No goals yet. Add one or try AI suggest.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function GoalCard({ g, update, del, onChanged }: any) {
  const coach = useServerFn(coachGoal);
  const [advice, setAdvice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const unit = METRICS.find((m) => m.value === g.metric_type)?.unit;
  const fmt = (n: number) => unit === "USD"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
    : Math.round(n).toLocaleString();

  const runCoach = async () => {
    setLoading(true);
    try { setAdvice(await coach({ data: { id: g.id } })); }
    catch (e: any) { toast.error(e.message ?? "AI failed"); }
    finally { setLoading(false); }
  };

  const badgeTone = g.status === "achieved" ? "default"
    : g.status === "missed" ? "destructive"
    : g.progress.onTrack ? "secondary" : "destructive";
  const badgeLabel = g.status !== "active" ? g.status : g.progress.onTrack ? "On track" : "Behind";

  return (
    <Card className="border-border/60 shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">{g.title}</CardTitle>
            <p className="text-xs text-muted-foreground">{g.metric_label} · {g.period}</p>
          </div>
          <Badge variant={badgeTone as any} className="shrink-0 capitalize">{badgeLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{fmt(g.progress.current)} / {fmt(Number(g.target_value))}</span>
            <span>{g.progress.pct}%</span>
          </div>
          <Progress value={g.progress.pct} className="h-2" />
          <p className="mt-1 text-[10px] text-muted-foreground">Time elapsed {g.progress.timePct}% · {g.start_date} → {g.end_date}</p>
        </div>

        {advice && (
          <div className="rounded-md border bg-muted/40 p-3 text-xs">
            <p className="mb-1 font-semibold">{advice.headline}</p>
            <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
              {(advice.actions ?? []).map((a: string, i: number) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={runCoach} disabled={loading}>
            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            AI Coach
          </Button>
          {g.status === "active" && (
            <>
              <Button size="sm" variant="outline" onClick={async () => {
                await update({ data: { id: g.id, status: "achieved" } });
                toast.success("Marked achieved"); onChanged();
              }}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Achieved
              </Button>
              <Button size="sm" variant="ghost" onClick={async () => {
                await update({ data: { id: g.id, status: "archived" } });
                onChanged();
              }}>
                <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
            if (!confirm("Delete this goal?")) return;
            await del({ data: { id: g.id } });
            toast.success("Deleted"); onChanged();
          }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
