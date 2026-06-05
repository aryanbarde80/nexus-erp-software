import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export function ActivityTimeline({
  entityType,
  entityId,
  title = "Activity",
}: {
  entityType: "invoice" | "project" | "task" | "payment";
  entityId: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["activity-log", entityType, entityId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="View activity">
          <History className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Activity className="h-4 w-4" /> {title}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-2">
          {q.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : !q.data?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ol className="relative ml-2 space-y-4 border-l border-border pl-5">
              {q.data.map((a: any) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] uppercase">{a.action}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                  </div>
                  {a.description && (
                    <p className="mt-1 text-sm text-foreground/90">{a.description}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
