import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/nexus/PageHeader";
import { CreateDialog } from "@/components/nexus/CreateDialog";
import { RowDelete } from "@/components/nexus/RowDelete";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/leaves")({ component: Leaves });

function Leaves() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const employeesQ = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await supabase.from("employees").select("id,full_name").order("full_name")).data ?? [],
  });

  const leavesQ = useQuery({
    queryKey: ["leaves-with-employee"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*, employees(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [empId, setEmpId] = useState("");
  const [type, setType] = useState("vacation");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  const add = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("leave_requests").insert({
      user_id: user.id, employee_id: empId || null,
      leave_type: type, start_date: start, end_date: end, reason: reason || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Leave requested");
    setEmpId(""); setStart(""); setEnd(""); setReason("");
    qc.invalidateQueries({ queryKey: ["leaves-with-employee"] });
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("leave_requests").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    qc.invalidateQueries({ queryKey: ["leaves-with-employee"] });
  };

  const days = (a: string, b: string) =>
    Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1);

  return (
    <div>
      <PageHeader title="Leave requests" subtitle="Approve and track employee time off." />
      <div className="mb-3 flex justify-end">
        <CreateDialog title="New leave request" triggerLabel="Request leave" busy={busy} onSubmit={add}>
          <Field label="Employee">
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employeesQ.data?.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vacation">Vacation</SelectItem>
                <SelectItem value="sick">Sick</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start"><Input type="date" required value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="End"><Input type="date" required value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
          <Field label="Reason"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </CreateDialog>
      </div>

      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leavesQ.data?.length ? leavesQ.data.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.employees?.full_name || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{l.leave_type}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{l.start_date} → {l.end_date}</TableCell>
                  <TableCell>{days(l.start_date, l.end_date)}</TableCell>
                  <TableCell>
                    <Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"}>{l.status}</Badge>
                  </TableCell>
                  <TableCell className="flex justify-end gap-1">
                    {l.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setStatus(l.id, "approved")}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => setStatus(l.id, "rejected")}>Reject</Button>
                      </>
                    )}
                    <RowDelete table="leave_requests" id={l.id} invalidateKeys={[["leaves-with-employee"]]} />
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No leave requests.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
