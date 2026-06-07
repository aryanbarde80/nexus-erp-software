import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Brain, Sun, RefreshCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { dailyBriefing } from "@/lib/ml.functions";

export function DailyBriefing() {
  const fn = useServerFn(dailyBriefing);
  const q = useQuery({ queryKey: ["ml.briefing"], queryFn: () => fn({}) });

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background shadow-soft">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <Sun className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  AI daily briefing
                </span>
                {q.isFetching && <Badge variant="outline" className="text-[10px]">refreshing…</Badge>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => q.refetch()} className="h-7 px-2">
                <RefreshCcw className="h-3 w-3" />
              </Button>
            </div>
            {q.data ? (
              <>
                <p className="mt-2 font-display text-xl font-semibold">{q.data.greeting}</p>
                <p className="mt-1 text-sm text-muted-foreground">{q.data.summary}</p>
                {q.data.priorities?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {q.data.priorities.map((p: string, i: number) => (
                      <Badge key={i} variant="secondary" className="font-normal">
                        <span className="mr-1 text-primary">{i + 1}.</span>{p}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Preparing your briefing…</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
