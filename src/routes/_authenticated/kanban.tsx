import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight, Trash2, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/nexus/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/_authenticated/kanban")({
  component: KanbanPage,
});

const COLUMNS = [
  { id: "todo", label: "To do", color: "bg-muted" },
  { id: "in_progress", label: "In progress", color: "bg-primary/15" },
  { id: "done", label: "Done", color: "bg-emerald-500/15" },
] as const;

type Status = (typeof COLUMNS)[number]["id"];

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/15 text-blue-600",
  high: "bg-amber-500/20 text-amber-700",
  urgent: "bg-destructive/15 text-destructive",
};

function KanbanPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filterProject, setFilterProject] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    project_id: "",
    due_date: "",
  });

  const tasksQ = useQuery({
    queryKey: ["kanban-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const projectsQ = useQuery({
    queryKey: ["kanban-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const all = tasksQ.data ?? [];
    return filterProject === "all" ? all : all.filter((t: any) => t.project_id === filterProject);
  }, [tasksQ.data, filterProject]);

  const byCol = (s: Status) => filtered.filter((t: any) => (t.status ?? "todo") === s);

  const moveTask = async (id: string, from: Status, to: Status) => {
    const { error } = await supabase.from("tasks").update({ status: to }).eq("id", id);
    if (error) return toast.error(error.message);
    if (user) await logActivity({ userId: user.id, entityType: "task", entityId: id, action: "status_changed", description: `${from} → ${to}` });
    qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks-with-project"] });
    toast.success("Moved");
  };

  const removeTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
    toast.success("Deleted");
  };

  const create = async () => {
    if (!user || !form.title.trim()) return toast.error("Title is required");
    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      title: form.title.trim(),
      description: form.description || null,
      priority: form.priority,
      status: "todo",
      project_id: form.project_id || null,
      due_date: form.due_date || null,
    });
    if (error) return toast.error(error.message);
    setOpen(false);
    setForm({ title: "", description: "", priority: "medium", project_id: "", due_date: "" });
    qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
    toast.success("Task created");
  };

  return (
    <div>
      <PageHeader
        title="Task Kanban"
        subtitle="Move work across stages — to do, in progress, done."
        actions={
          <div className="flex items-center gap-2">
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="h-9 w-48"><SelectValue placeholder="All projects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {(projectsQ.data ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1.5 h-4 w-4" /> New task</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create task</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Title</Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
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
                    <div>
                      <Label>Due date</Label>
                      <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Project (optional)</Label>
                    <Select value={form.project_id || "none"} onValueChange={(v) => setForm({ ...form, project_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {(projectsQ.data ?? []).map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={create}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col, idx) => {
          const items = byCol(col.id);
          return (
            <div key={col.id} className="rounded-xl border border-border/60 bg-card/30 p-3">
              <div className={`mb-3 flex items-center justify-between rounded-lg px-3 py-2 ${col.color}`}>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{col.label}</h3>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </div>
              </div>
              <div className="space-y-2">
                {items.length === 0 && (
                  <p className="px-2 py-8 text-center text-xs text-muted-foreground">No tasks here</p>
                )}
                {items.map((t: any) => {
                  const prev = COLUMNS[idx - 1];
                  const next = COLUMNS[idx + 1];
                  return (
                    <Card key={t.id} className="p-3 shadow-soft">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{t.title}</p>
                        <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1" onClick={() => removeTask(t.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      {t.description && (
                        <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                      )}
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[t.priority] ?? PRIORITY_COLORS.medium}`}>
                          <Flag className="h-2.5 w-2.5" /> {t.priority}
                        </span>
                        {t.projects?.name && (
                          <Badge variant="outline" className="text-[10px]">{t.projects.name}</Badge>
                        )}
                        {t.due_date && (
                          <Badge variant="secondary" className="text-[10px]">Due {t.due_date}</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-1 border-t pt-2">
                        <Button
                          variant="ghost" size="sm" className="h-7 px-2 text-xs"
                          disabled={!prev}
                          onClick={() => prev && moveTask(t.id, col.id, prev.id)}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" /> {prev?.label ?? ""}
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-7 px-2 text-xs"
                          disabled={!next}
                          onClick={() => next && moveTask(t.id, col.id, next.id)}
                        >
                          {next?.label ?? ""} <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
