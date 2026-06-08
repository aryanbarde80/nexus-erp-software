import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Plus, Check, AlarmClock, Trash2, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Reminder = {
  id: string;
  title: string;
  notes: string | null;
  remind_at: string | null;
  status: "pending" | "done" | "snoozed";
};

export function RemindersDialog({ trigger }: { trigger: React.ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [remindAt, setRemindAt] = useState("");

  const q = useQuery({
    queryKey: ["reminders"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Reminder[];
    },
  });

  const add = async () => {
    if (!user || !title.trim()) return;
    const { error } = await supabase.from("reminders").insert({
      user_id: user.id,
      title: title.trim(),
      notes: notes.trim() || null,
      remind_at: remindAt ? new Date(remindAt).toISOString() : null,
    });
    if (error) return toast.error(error.message);
    setTitle(""); setNotes(""); setRemindAt("");
    toast.success("Reminder saved");
    qc.invalidateQueries({ queryKey: ["reminders"] });
  };

  const setStatus = async (id: string, status: Reminder["status"]) => {
    const { error } = await supabase.from("reminders").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["reminders"] });
  };

  const del = async (id: string) => {
    await supabase.from("reminders").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["reminders"] });
  };

  const groups = {
    pending: (q.data ?? []).filter(r => r.status === "pending"),
    snoozed: (q.data ?? []).filter(r => r.status === "snoozed"),
    done: (q.data ?? []).filter(r => r.status === "done"),
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlarmClock className="h-4 w-4 text-primary" /> Your reminders
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call supplier about PO #421" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Remind at</Label>
              <Input type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} />
            </div>
          </div>
          <Button size="sm" onClick={add} disabled={!title.trim()} className="w-full">
            <Plus className="mr-1 h-3.5 w-3.5" /> Add reminder
          </Button>
        </div>

        <Tabs defaultValue="pending">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">Pending ({groups.pending.length})</TabsTrigger>
            <TabsTrigger value="snoozed">Snoozed ({groups.snoozed.length})</TabsTrigger>
            <TabsTrigger value="done">Done ({groups.done.length})</TabsTrigger>
          </TabsList>
          {(["pending", "snoozed", "done"] as const).map(key => (
            <TabsContent key={key} value={key}>
              <ScrollArea className="max-h-[260px] pr-2">
                {groups[key].length ? (
                  <ul className="space-y-1.5">
                    {groups[key].map(r => (
                      <li key={r.id} className="flex items-start gap-2 rounded-md border p-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{r.title}</p>
                          {r.notes && <p className="text-xs text-muted-foreground line-clamp-2">{r.notes}</p>}
                          {r.remind_at && (
                            <Badge variant="outline" className="mt-1 text-[10px]">
                              {new Date(r.remind_at).toLocaleString()}
                            </Badge>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {r.status !== "done" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setStatus(r.id, "done")} title="Mark done">
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            </Button>
                          )}
                          {r.status === "pending" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setStatus(r.id, "snoozed")} title="Snooze">
                              <Pause className="h-3.5 w-3.5 text-amber-500" />
                            </Button>
                          )}
                          {r.status === "snoozed" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setStatus(r.id, "pending")} title="Resume">
                              <Bell className="h-3.5 w-3.5 text-primary" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del(r.id)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">No reminders here.</p>
                )}
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
