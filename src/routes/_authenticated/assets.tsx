import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/nexus/PageHeader";
import { CreateDialog } from "@/components/nexus/CreateDialog";
import { RowDelete } from "@/components/nexus/RowDelete";
import { StatCard } from "@/components/nexus/StatCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Boxes, CheckCircle2, Wrench } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assets")({ component: Assets });

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function Assets() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("available");
  const [value, setValue] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");

  const add = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("assets").insert({
      user_id: user.id,
      name,
      asset_tag: tag || null,
      category: category || null,
      location: location || null,
      status,
      value: Number(value || 0),
      purchase_date: purchaseDate || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Asset added");
    setName(""); setTag(""); setCategory(""); setLocation(""); setStatus("available"); setValue(""); setPurchaseDate("");
    qc.invalidateQueries({ queryKey: ["assets"] });
  };

  const updateStatus = async (id: string, s: string) => {
    const { error } = await supabase.from("assets").update({ status: s }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["assets"] });
  };

  const rows = (q.data ?? []).filter((a: any) =>
    !search || `${a.name} ${a.asset_tag ?? ""} ${a.category ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );
  const totalValue = (q.data ?? []).reduce((s: number, a: any) => s + Number(a.value || 0), 0);
  const inUse = (q.data ?? []).filter((a: any) => a.status === "assigned").length;
  const repair = (q.data ?? []).filter((a: any) => a.status === "maintenance").length;

  return (
    <div>
      <PageHeader title="Assets" subtitle="Track equipment, hardware and company property." />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Total assets" value={String(q.data?.length ?? 0)} icon={Boxes} />
        <StatCard label="In use" value={String(inUse)} icon={CheckCircle2} />
        <StatCard label="Maintenance" value={String(repair)} icon={Wrench} delta={money(totalValue) + " total value"} />
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <Input placeholder="Search assets…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <CreateDialog title="New asset" triggerLabel="Add asset" busy={busy} onSubmit={add}>
          <Field label="Name"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Asset tag"><Input value={tag} onChange={(e) => setTag(e.target.value)} /></Field>
            <Field label="Category"><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Laptop, Vehicle…" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location"><Input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
            <Field label="Value"><Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase date"><Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></Field>
            <Field label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
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
                <TableHead>Asset</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? rows.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-muted-foreground">{a.asset_tag || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{a.category || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{a.location || "—"}</TableCell>
                  <TableCell>{money(Number(a.value))}</TableCell>
                  <TableCell>
                    <Select value={a.status} onValueChange={(v) => updateStatus(a.id, v)}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="assigned">Assigned</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowDelete table="assets" id={a.id} invalidateKeys={[["assets"]]} />
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No assets yet.</TableCell></TableRow>
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
