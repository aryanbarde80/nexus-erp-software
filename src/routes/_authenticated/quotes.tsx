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

export const Route = createFileRoute("/_authenticated/quotes")({ component: Quotes });

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function Quotes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const customersQ = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("id,name")).data ?? [],
  });

  const quotesQ = useQuery({
    queryKey: ["quotes-with-customer"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, customers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [qNumber, setQNumber] = useState("");
  const [qCustomer, setQCustomer] = useState("");
  const [qAmount, setQAmount] = useState("");
  const [qTax, setQTax] = useState("");
  const [qStatus, setQStatus] = useState("draft");
  const [qValid, setQValid] = useState("");
  const [qNotes, setQNotes] = useState("");

  const addQuote = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("quotes").insert({
      user_id: user.id,
      quote_number: qNumber || `QT-${Date.now().toString().slice(-6)}`,
      customer_id: qCustomer || null,
      amount: Number(qAmount || 0),
      tax: Number(qTax || 0),
      status: qStatus,
      valid_until: qValid || null,
      notes: qNotes || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Quote created");
    setQNumber(""); setQCustomer(""); setQAmount(""); setQTax(""); setQValid(""); setQNotes("");
    qc.invalidateQueries({ queryKey: ["quotes-with-customer"] });
  };

  const convertToInvoice = async (q: any) => {
    if (!user) return;
    const { error } = await supabase.from("invoices").insert({
      user_id: user.id,
      invoice_number: `INV-${Date.now().toString().slice(-6)}`,
      customer_id: q.customer_id,
      amount: Number(q.amount),
      tax: Number(q.tax),
      status: "sent",
      notes: `Converted from quote ${q.quote_number}`,
    });
    if (error) return toast.error(error.message);
    await supabase.from("quotes").update({ status: "accepted" }).eq("id", q.id);
    toast.success("Converted to invoice");
    qc.invalidateQueries({ queryKey: ["quotes-with-customer"] });
    qc.invalidateQueries({ queryKey: ["invoices-with-customer"] });
  };

  const filtered = (quotesQ.data ?? []).filter((q: any) =>
    !search || `${q.quote_number} ${q.customers?.name ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="Quotes" subtitle="Send quotations and convert them to invoices." />
      <div className="mb-4 flex items-center justify-between gap-3">
        <Input placeholder="Search quotes…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <CreateDialog title="New quote" triggerLabel="Add quote" busy={busy} onSubmit={addQuote}>
          <Field label="Quote #"><Input placeholder="auto" value={qNumber} onChange={(e) => setQNumber(e.target.value)} /></Field>
          <Field label="Customer">
            <Select value={qCustomer} onValueChange={setQCustomer}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customersQ.data?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount"><Input type="number" step="0.01" required value={qAmount} onChange={(e) => setQAmount(e.target.value)} /></Field>
            <Field label="Tax"><Input type="number" step="0.01" value={qTax} onChange={(e) => setQTax(e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valid until"><Input type="date" value={qValid} onChange={(e) => setQValid(e.target.value)} /></Field>
            <Field label="Status">
              <Select value={qStatus} onValueChange={setQStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Notes"><Textarea value={qNotes} onChange={(e) => setQNotes(e.target.value)} /></Field>
        </CreateDialog>
      </div>

      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Valid until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length ? filtered.map((q: any) => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.quote_number}</TableCell>
                  <TableCell className="text-muted-foreground">{q.customers?.name || "—"}</TableCell>
                  <TableCell>{money(Number(q.amount) + Number(q.tax))}</TableCell>
                  <TableCell className="text-muted-foreground">{q.valid_until || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={q.status === "accepted" ? "default" : q.status === "rejected" ? "destructive" : "secondary"}>
                      {q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="flex justify-end gap-1">
                    {q.status !== "accepted" && (
                      <Button size="sm" variant="outline" onClick={() => convertToInvoice(q)}>Convert</Button>
                    )}
                    <RowDelete table="quotes" id={q.id} invalidateKeys={[["quotes-with-customer"]]} />
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No quotes yet.</TableCell></TableRow>
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
