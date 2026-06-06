import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Activity, FileText, Briefcase, ListChecks, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/nexus/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/activity")({
  component: ActivityFeed,
});

const ENTITY_ICON: Record<string, any> = {
  invoice: FileText,
  project: Briefcase,
  task: ListChecks,
  payment: CreditCard,
};

function ActivityFeed() {
  const [entity, setEntity] = useState<string>("all");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["activity-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const filtered = (q.data ?? []).filter((a: any) => {
    if (entity !== "all" && a.entity_type !== entity) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        a.action?.toLowerCase().includes(s) ||
        a.description?.toLowerCase().includes(s) ||
        a.entity_type?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  // Group by date
  const grouped: Record<string, any[]> = {};
  filtered.forEach((a: any) => {
    const day = new Date(a.created_at).toDateString();
    (grouped[day] ??= []).push(a);
  });

  return (
    <div>
      <PageHeader
        title="Activity feed"
        subtitle="Every status change, payment, and update across your workspace."
        actions={
          <div className="flex gap-2">
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-48"
            />
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                <SelectItem value="invoice">Invoices</SelectItem>
                <SelectItem value="project">Projects</SelectItem>
                <SelectItem value="task">Tasks</SelectItem>
                <SelectItem value="payment">Payments</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-6">
          {q.isLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
          ) : !filtered.length ? (
            <div className="py-16 text-center">
              <Activity className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No activity yet — start using the modules and history will appear here.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(grouped).map(([day, items]) => (
                <div key={day}>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {day}
                  </h3>
                  <ol className="relative ml-2 space-y-3 border-l border-border pl-5">
                    {items.map((a: any) => {
                      const Icon = ENTITY_ICON[a.entity_type] ?? Activity;
                      return (
                        <li key={a.id} className="relative">
                          <span className="absolute -left-[30px] top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-background bg-primary/15">
                            <Icon className="h-2.5 w-2.5 text-primary" />
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] uppercase">{a.entity_type}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{a.action}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(a.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          {a.description && (
                            <p className="mt-1 text-sm text-foreground/90">{a.description}</p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
