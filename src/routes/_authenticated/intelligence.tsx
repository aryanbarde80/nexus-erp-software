import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import {
  Brain, TrendingUp, AlertTriangle, Users, Package, Sparkles,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCcw, Target, Activity,
} from "lucide-react";
import { PageHeader } from "@/components/nexus/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  forecastRevenue, scoreLeads, detectAnomalies, predictChurn, recommendRestock, generateInsights,
} from "@/lib/ml.functions";

export const Route = createFileRoute("/_authenticated/intelligence")({
  component: IntelligencePage,
});

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function IntelligencePage() {
  const fcst = useServerFn(forecastRevenue);
  const leads = useServerFn(scoreLeads);
  const anom = useServerFn(detectAnomalies);
  const churn = useServerFn(predictChurn);
  const restock = useServerFn(recommendRestock);
  const insights = useServerFn(generateInsights);

  const qF = useQuery({ queryKey: ["ml.forecast"], queryFn: () => fcst({}) });
  const qI = useQuery({ queryKey: ["ml.insights"], queryFn: () => insights({}) });
  const qL = useQuery({ queryKey: ["ml.leads"], queryFn: () => leads({}) });
  const qA = useQuery({ queryKey: ["ml.anomalies"], queryFn: () => anom({}) });
  const qC = useQuery({ queryKey: ["ml.churn"], queryFn: () => churn({}) });
  const qR = useQuery({ queryKey: ["ml.restock"], queryFn: () => restock({}) });

  const refetchAll = () => { qF.refetch(); qI.refetch(); qL.refetch(); qA.refetch(); qC.refetch(); qR.refetch(); };

  return (
    <div>
      <PageHeader
        title="AI Intelligence"
        subtitle="Forecasts, lead scoring, anomaly detection, churn risk, and demand planning — powered by ML & Lovable AI."
        actions={
          <Button onClick={refetchAll} variant="outline">
            <RefreshCcw className="mr-2 h-4 w-4" /> Recompute all
          </Button>
        }
      />

      {/* Executive insights */}
      <Card className="border-border/60 shadow-soft">
        <CardHeader className="flex flex-row items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <CardTitle className="text-base font-semibold">Executive insights</CardTitle>
          {qI.isFetching && <Badge variant="outline" className="ml-auto">analyzing…</Badge>}
        </CardHeader>
        <CardContent>
          {qI.data ? (
            <>
              <p className="font-display text-2xl font-semibold">{qI.data.headline}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(qI.data.insights ?? []).map((it: any, i: number) => (
                  <div key={i} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{it.title}</div>
                      <Badge variant={it.impact === "high" ? "destructive" : it.impact === "medium" ? "default" : "secondary"}>{it.impact}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{it.detail}</p>
                    <p className="mt-2 text-xs"><span className="text-primary">→</span> {it.action}</p>
                  </div>
                ))}
              </div>
              {qI.data.kpis?.length ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {qI.data.kpis.map((k: any, i: number) => (
                    <div key={i} className="rounded-lg bg-muted/40 p-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {k.trend === "up" ? <ArrowUpRight className="h-3 w-3 text-emerald-500" /> :
                          k.trend === "down" ? <ArrowDownRight className="h-3 w-3 text-rose-500" /> :
                          <Minus className="h-3 w-3" />}
                        {k.label}
                      </div>
                      <div className="mt-1 font-display text-lg font-semibold">{k.value}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Generating insights from your live data…</p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="forecast" className="mt-6">
        <TabsList>
          <TabsTrigger value="forecast"><TrendingUp className="mr-1.5 h-3.5 w-3.5" />Forecast</TabsTrigger>
          <TabsTrigger value="leads"><Target className="mr-1.5 h-3.5 w-3.5" />Lead scoring</TabsTrigger>
          <TabsTrigger value="anomalies"><AlertTriangle className="mr-1.5 h-3.5 w-3.5" />Anomalies</TabsTrigger>
          <TabsTrigger value="churn"><Users className="mr-1.5 h-3.5 w-3.5" />Churn risk</TabsTrigger>
          <TabsTrigger value="restock"><Package className="mr-1.5 h-3.5 w-3.5" />Demand planning</TabsTrigger>
        </TabsList>

        {/* FORECAST */}
        <TabsContent value="forecast">
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> 3-month revenue forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {qF.data ? (
                  <ResponsiveContainer>
                    <AreaChart data={qF.data.series}>
                      <defs>
                        <linearGradient id="rev2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="m" stroke="var(--muted-foreground)" fontSize={11} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                      <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                      <ReferenceLine
                        x={qF.data.series.find((s: any) => s.forecast)?.m}
                        stroke="var(--muted-foreground)"
                        strokeDasharray="3 3"
                        label={{ value: "forecast →", fill: "var(--muted-foreground)", fontSize: 11, position: "insideTopRight" }}
                      />
                      <Area type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} fill="url(#rev2)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <Skeleton label="Crunching 12 months of revenue…" />
                )}
              </div>
              {qF.data?.commentary && (
                <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                  <Brain className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
                  {qF.data.commentary}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* LEADS */}
        <TabsContent value="leads">
          <Card className="border-border/60 shadow-soft">
            <CardHeader><CardTitle className="text-base font-semibold">AI-scored leads & accounts</CardTitle></CardHeader>
            <CardContent>
              {qL.isLoading && <Skeleton label="Scoring leads…" />}
              <div className="space-y-2">
                {(qL.data?.leads ?? []).map((l: any) => (
                  <div key={l.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{l.name} <span className="text-xs text-muted-foreground">· {l.company}</span></div>
                        <div className="text-xs text-muted-foreground">{l.reason}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={l.priority === "high" ? "destructive" : l.priority === "medium" ? "default" : "secondary"}>{l.priority}</Badge>
                        <div className="w-32">
                          <div className="flex justify-between text-xs"><span>Score</span><span className="font-mono">{l.score}</span></div>
                          <Progress value={l.score} className="h-1.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANOMALIES */}
        <TabsContent value="anomalies">
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Expense anomalies (z-score ≥ 2)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">{qA.data?.summary ?? "Computing…"}</p>
              <div className="space-y-2">
                {(qA.data?.anomalies ?? []).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-sm">
                    <div>
                      <div className="font-medium">{money(Number(a.amount))} · <span className="text-muted-foreground">{a.category ?? "uncategorized"}</span></div>
                      <div className="text-xs text-muted-foreground">{a.vendor ?? "—"} · {a.description ?? ""}</div>
                    </div>
                    <Badge variant={Math.abs(a.z) >= 3 ? "destructive" : "default"}>
                      σ {a.z.toFixed(1)}
                    </Badge>
                  </div>
                ))}
                {qA.data && !qA.data.anomalies.length && <p className="text-sm text-muted-foreground">No outliers — spending looks healthy.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CHURN */}
        <TabsContent value="churn">
          <Card className="border-border/60 shadow-soft">
            <CardHeader><CardTitle className="text-base font-semibold">Customer churn risk</CardTitle></CardHeader>
            <CardContent>
              {qC.isLoading && <Skeleton label="Computing churn signals…" />}
              <div className="space-y-2">
                {(qC.data?.customers ?? []).map((c: any) => (
                  <div key={c.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{c.name} <span className="text-xs text-muted-foreground">· {c.company}</span></div>
                        <div className="text-xs text-muted-foreground">
                          {c.daysSince === 999 ? "no invoices" : `${c.daysSince}d since last invoice`} · {c.overdue} overdue · {c.openTickets} open tickets
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={c.band === "high" ? "destructive" : c.band === "medium" ? "default" : "secondary"}>{c.band}</Badge>
                        <div className="w-32">
                          <div className="flex justify-between text-xs"><span>Risk</span><span className="font-mono">{c.risk}</span></div>
                          <Progress value={c.risk} className="h-1.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RESTOCK */}
        <TabsContent value="restock">
          <Card className="border-border/60 shadow-soft">
            <CardHeader><CardTitle className="text-base font-semibold">Demand-based restock plan</CardTitle></CardHeader>
            <CardContent>
              {qR.isLoading && <Skeleton label="Modeling 30-day demand…" />}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="py-2">Product</th><th>Stock</th><th>Rate/day</th><th>Days left</th><th>Reorder</th><th>Urgency</th></tr>
                  </thead>
                  <tbody>
                    {(qR.data?.recommendations ?? []).map((r: any) => (
                      <tr key={r.id} className="border-t border-border/60">
                        <td className="py-2">{r.name} <span className="text-xs text-muted-foreground">· {r.sku}</span></td>
                        <td>{r.stock}</td>
                        <td>{r.dailyRate}</td>
                        <td>{r.daysLeft ?? "—"}</td>
                        <td className="font-medium">{r.reorder}</td>
                        <td><Badge variant={r.urgency === "high" ? "destructive" : r.urgency === "medium" ? "default" : "secondary"}>{r.urgency}</Badge></td>
                      </tr>
                    ))}
                    {qR.data && !qR.data.recommendations.length && (
                      <tr><td colSpan={6} className="py-4 text-center text-sm text-muted-foreground">All products well-stocked. <Activity className="ml-1 inline h-3 w-3" /></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Skeleton({ label }: { label: string }) {
  return <div className="grid h-32 place-items-center text-sm text-muted-foreground">{label}</div>;
}
