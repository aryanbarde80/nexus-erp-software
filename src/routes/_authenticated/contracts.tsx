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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSignature, AlarmClock, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/contracts")({ component: Contracts });
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function Contracts() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [title, setTitle] = useState("");
  const [party, setParty] = useState("");
  const [type, setType] = useState("service");
  const [value, setValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");

  const add = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("contracts").insert({
      user_id: user.id,
      title, party: party || null, contract_type: type, value: Number(value || 0),
      start_date: startDate || null, end_date: endDate || null, status, notes: notes || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Contract added");
    setTitle(""); setParty(""); setType("service"); setValue(""); setStartDate(""); setEndDate(""); setStatus("active"); setNotes("");
    qc.invalidateQueries({ queryKey: ["contracts"] });
  };

  const rows = (q.data ?? []).filter((c: any) =>
    !search || `${c.title} ${c.party ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );
  const totalValue = (q.data ?? []).reduce((s: number, c: any) => s + Number(c.value || 0), 0);
  const active = (q.data ?? []).filter((c: any) => c.status === "active").length;
  const soon = (q.data ?? []).filter((c: any) => {
    if (!c.end_date) return false;
    const d = new Date(c.end_date).getTime() - Date.now();
    return d > 0 && d < 1000 * 60 * 60 * 24 * 30;
  }).length;

  return (
    <div>
      <PageHeader title="Contracts" subtitle="Manage agreements with clients and vendors." />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Active contracts" value={String(active)} icon={FileSignature} />
        <StatCard label="Expiring soon" value={String(soon)} icon={AlarmClock} hint="Next 30 days" />
        <StatCard label="Total value" value={money(totalValue)} icon={DollarSign} />
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <Input placeholder="Search contracts…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <CreateDialog title="New contract" triggerLabel="Add contract" busy={busy} onSubmit={add}>
          <Field label="Title"><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Party"><Input value={party} onChange={(e) => setParty(e.target.value)} /></Field>
            <Field label="Type">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="nda">NDA</SelectItem>
                  <SelectItem value="employment">Employment</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="lease">Lease</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field label="End date"><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Value"><Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
            <Field label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </CreateDialog>
      </div>

      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? rows.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell className="text-muted-foreground">{c.party || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.contract_type}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {c.start_date || "—"} → {c.end_date || "—"}
                  </TableCell>
                  <TableCell>{money(Number(c.value))}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "active" ? "default" : c.status === "expired" || c.status === "terminated" ? "destructive" : "secondary"}>
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowDelete table="contracts" id={c.id} invalidateKeys={[["contracts"]]} />
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No contracts yet.</TableCell></TableRow>
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
