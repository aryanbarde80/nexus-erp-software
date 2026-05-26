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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/hr")({
  component: HR,
});

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const DEPTS = ["Engineering", "Sales", "Marketing", "Operations", "Finance", "HR", "Support"];

function HR() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
  });

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("Engineering");
  const [salary, setSalary] = useState("");
  const [hireDate, setHireDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("active");

  const add = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("employees").insert({
      user_id: user.id,
      full_name: fullName, email: email || null, position: position || null,
      department, salary: Number(salary || 0), hire_date: hireDate, status,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Employee added");
    setFullName(""); setEmail(""); setPosition(""); setSalary("");
    qc.invalidateQueries({ queryKey: ["employees"] });
  };

  const initials = (n: string) =>
    n.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div>
      <PageHeader
        title="HR & Employees" subtitle="Team directory and payroll roster."
        actions={
          <CreateDialog title="New employee" triggerLabel="Add employee" busy={busy} onSubmit={add}>
            <Field label="Full name"><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label="Position"><Input value={position} onChange={(e) => setPosition(e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Department">
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DEPTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Salary"><Input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hire date"><Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} /></Field>
              <Field label="Status">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="onleave">On leave</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </CreateDialog>
        }
      />
      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Hired</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data?.length ? q.data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {initials(e.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{e.full_name}</div>
                        <div className="text-xs text-muted-foreground">{e.email || "—"}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.position || "—"}</TableCell>
                  <TableCell>{e.department || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.hire_date}</TableCell>
                  <TableCell>{money(Number(e.salary))}</TableCell>
                  <TableCell><Badge variant={e.status === "active" ? "default" : "secondary"}>{e.status}</Badge></TableCell>
                  <TableCell className="text-right"><RowDelete table="employees" id={e.id} invalidateKeys={[["employees"]]} /></TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No employees yet.</TableCell></TableRow>
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
