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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/departments")({ component: Departments });

function Departments() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const deptQ = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  const empQ = useQuery({
    queryKey: ["employees-by-dept"],
    queryFn: async () => (await supabase.from("employees").select("department")).data ?? [],
  });

  const [name, setName] = useState("");
  const [manager, setManager] = useState("");
  const [desc, setDesc] = useState("");

  const add = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("departments").insert({
      user_id: user.id, name, manager: manager || null, description: desc || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Department created");
    setName(""); setManager(""); setDesc("");
    qc.invalidateQueries({ queryKey: ["departments"] });
  };

  const counts = (empQ.data ?? []).reduce((m: Record<string, number>, e: any) => {
    const k = (e.department || "").toLowerCase();
    if (k) m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});

  return (
    <div>
      <PageHeader title="Departments" subtitle="Organize teams and reporting structure." />
      <div className="mb-4 flex justify-end">
        <CreateDialog title="New department" triggerLabel="Add department" busy={busy} onSubmit={add}>
          <Field label="Name"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Manager"><Input value={manager} onChange={(e) => setManager(e.target.value)} /></Field>
          <Field label="Description"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        </CreateDialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {deptQ.data?.length ? deptQ.data.map((d: any) => (
          <Card key={d.id} className="border-border/60 shadow-soft">
            <CardContent className="p-5">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">{d.name}</h3>
                </div>
                <RowDelete table="departments" id={d.id} invalidateKeys={[["departments"]]} />
              </div>
              {d.manager && <p className="text-sm text-muted-foreground">Manager: {d.manager}</p>}
              {d.description && <p className="mt-2 text-sm text-muted-foreground">{d.description}</p>}
              <Badge variant="secondary" className="mt-3">{counts[d.name.toLowerCase()] ?? 0} employees</Badge>
            </CardContent>
          </Card>
        )) : (
          <Card className="border-border/60 shadow-soft md:col-span-2 lg:col-span-3">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">No departments yet.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
