import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Radar, Loader2, AlertTriangle, ShieldCheck, RefreshCw, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/nexus/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { scanAnomalies } from "@/lib/radar.functions";

export const Route = createFileRoute("/_authenticated/radar")({ component: RadarPage });

const sevColor = {
  high: "bg-red-500/10 text-red-500 border-red-500/30",
  medium: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  low: "bg-sky-500/10 text-sky-500 border-sky-500/30",
} as const;

function RadarPage() {
  const scan = useServerFn(scanAnomalies);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["anomaly-radar"],
    queryFn: () => scan(),
    staleTime: 5 * 60_000,
  });

  const modules = Array.from(new Set((data?.signals ?? []).map((s: any) => s.module)));
  const signals = (data?.signals ?? []).filter((s: any) => filter === "all" || s.module === filter);
  const health = data?.health ?? 0;
  const healthTint = health >= 80 ? "text-emerald-500" : health >= 50 ? "text-amber-500" : "text-red-500";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Anomaly Radar"
        subtitle="AI-powered outlier detection across finance, inventory, support and CRM."
        actions={
          <Button size="sm" variant="outline" disabled={isFetching} onClick={() => { qc.invalidateQueries({ queryKey: ["anomaly-radar"] }); refetch(); }}>
            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Rescan
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" /> Business health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={`text-5xl font-bold ${healthTint}`}>{health}</div>
            <Progress value={health} />
            <p className="text-xs text-muted-foreground">
              Score falls with every open risk, weighted by severity.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> AI headline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isFetching && !data ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Scanning your data…
              </div>
            ) : (
              <>
                <p className="text-sm">{data?.summary}</p>
                {(data?.recommendations ?? []).length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {data!.recommendations.map((r: string, i: number) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-primary">→</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={filter === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilter("all")}>
          All · {data?.signals?.length ?? 0}
        </Badge>
        {modules.map((m) => (
          <Badge key={m as string} variant={filter === m ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilter(m as string)}>
            {m as string}
          </Badge>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Radar className="h-4 w-4" /> Signals ({signals.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {signals.length === 0 && !isFetching && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-500">
              <ShieldCheck className="h-4 w-4" /> All clear — no anomalies detected.
            </div>
          )}
          {signals.map((s: any) => (
            <div key={s.id} className={`flex items-start gap-3 rounded-lg border p-3 ${sevColor[s.severity as keyof typeof sevColor]}`}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-foreground">{s.title}</div>
                  <div className="flex gap-1">
                    <Badge variant="outline" className="text-[10px]">{s.module}</Badge>
                    <Badge variant="secondary" className="text-[10px] uppercase">{s.severity}</Badge>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{s.detail}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {data?.scanned_at && (
        <p className="text-right text-xs text-muted-foreground">
          Last scan {new Date(data.scanned_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
