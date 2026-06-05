import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Briefcase, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/nexus/PageHeader";
import { CreateDialog } from "@/components/nexus/CreateDialog";
import { RowDelete } from "@/components/nexus/RowDelete";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/projects")({
  component: Projects,
});

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  planning: "secondary",
  active: "default",
  on_hold: "outline",
  completed: "default",
  cancelled: "destructive",
};

function Projects() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const projectsQ = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const tasksQ = useQuery({
    queryKey: ["tasks-with-project"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*, projects(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Project state
  const [pName, setPName] = useState("");
  const [pClient, setPClient] = useState("");
  const [pStatus, setPStatus] = useState("planning");
  const [pBudget, setPBudget] = useState("");
  const [pStart, setPStart] = useState("");
  const [pEnd, setPEnd] = useState("");
  const [pDesc, setPDesc] = useState("");

  const addProject = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("projects").insert({
      user_id: user.id,
      name: pName, client: pClient || null, status: pStatus,
      budget: Number(pBudget || 0), start_date: pStart || null, end_date: pEnd || null,
      description: pDesc || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Project created");
    setPName(""); setPClient(""); setPBudget(""); setPStart(""); setPEnd(""); setPDesc("");
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  // Task state
  const [tTitle, setTTitle] = useState("");
  const [tProject, setTProject] = useState<string>("");
  const [tAssignee, setTAssignee] = useState("");
  const [tPriority, setTPriority] = useState("medium");
  const [tStatus, setTStatus] = useState("todo");
  const [tDue, setTDue] = useState("");

  const addTask = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      title: tTitle, project_id: tProject || null,
      assignee: tAssignee || null, priority: tPriority, status: tStatus,
      due_date: tDue || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Task created");
    setTTitle(""); setTAssignee(""); setTDue("");
    qc.invalidateQueries({ queryKey: ["tasks-with-project"] });
  };

  const toggleTask = async (id: string, current: string) => {
    const next = current === "done" ? "todo" : "done";
    const { error } = await supabase.from("tasks").update({ status: next }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks-with-project"] });
  };

  const setProjectStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("projects").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Project ${status}`);
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  const setTaskStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks-with-project"] });
  };

  return (
    <div>
      <PageHeader title="Projects" subtitle="Track work, deliverables and tasks." />
      <Tabs defaultValue="projects">
        <TabsList>
          <TabsTrigger value="projects"><Briefcase className="mr-2 h-4 w-4" /> Projects</TabsTrigger>
          <TabsTrigger value="tasks"><ListChecks className="mr-2 h-4 w-4" /> Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-4">
          <div className="mb-3 flex justify-end">
            <CreateDialog title="New project" triggerLabel="Add project" busy={busy} onSubmit={addProject}>
              <Field label="Name"><Input required value={pName} onChange={(e) => setPName(e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Client"><Input value={pClient} onChange={(e) => setPClient(e.target.value)} /></Field>
                <Field label="Budget"><Input type="number" step="0.01" value={pBudget} onChange={(e) => setPBudget(e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start"><Input type="date" value={pStart} onChange={(e) => setPStart(e.target.value)} /></Field>
                <Field label="End"><Input type="date" value={pEnd} onChange={(e) => setPEnd(e.target.value)} /></Field>
              </div>
              <Field label="Status">
                <Select value={pStatus} onValueChange={setPStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Description"><Textarea value={pDesc} onChange={(e) => setPDesc(e.target.value)} /></Field>
            </CreateDialog>
          </div>
          <Card className="border-border/60 shadow-soft">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Timeline</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectsQ.data?.length ? projectsQ.data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.client || "—"}</TableCell>
                      <TableCell>
                        <Select value={p.status} onValueChange={(v) => setProjectStatus(p.id, v)}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="planning">Planning</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="on_hold">On hold</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{money(Number(p.budget))}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.start_date || "—"} → {p.end_date || "—"}</TableCell>
                      <TableCell className="text-right"><RowDelete table="projects" id={p.id} invalidateKeys={[["projects"]]} /></TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No projects yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <div className="mb-3 flex justify-end">
            <CreateDialog title="New task" triggerLabel="Add task" busy={busy} onSubmit={addTask}>
              <Field label="Title"><Input required value={tTitle} onChange={(e) => setTTitle(e.target.value)} /></Field>
              <Field label="Project">
                <Select value={tProject} onValueChange={setTProject}>
                  <SelectTrigger><SelectValue placeholder="Select project (optional)" /></SelectTrigger>
                  <SelectContent>
                    {projectsQ.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Assignee"><Input value={tAssignee} onChange={(e) => setTAssignee(e.target.value)} /></Field>
                <Field label="Due"><Input type="date" value={tDue} onChange={(e) => setTDue(e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Priority">
                  <Select value={tPriority} onValueChange={setTPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={tStatus} onValueChange={setTStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To do</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </CreateDialog>
          </div>
          <Card className="border-border/60 shadow-soft">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12" />
                    <TableHead>Task</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasksQ.data?.length ? tasksQ.data.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <input type="checkbox" checked={t.status === "done"} onChange={() => toggleTask(t.id, t.status)} className="h-4 w-4 cursor-pointer accent-primary" />
                      </TableCell>
                      <TableCell className={`font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</TableCell>
                      <TableCell className="text-muted-foreground">{t.projects?.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{t.assignee || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={t.priority === "urgent" || t.priority === "high" ? "destructive" : "secondary"}>{t.priority}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t.due_date || "—"}</TableCell>
                      <TableCell><Badge variant={t.status === "done" ? "default" : "outline"}>{t.status}</Badge></TableCell>
                      <TableCell className="text-right"><RowDelete table="tasks" id={t.id} invalidateKeys={[["tasks-with-project"]]} /></TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">No tasks yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
