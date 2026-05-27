import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
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
import { Wallet, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/payments")({ component: Payments });

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function Payments() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const invoicesQ = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => (await supabase.from("invoices").select("id,invoice_number,amount,status,customers(name)")).data ?? [],
  });

  const paymentsQ = useQuery({
    queryKey: ["payments-with-invoice"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, invoices(invoice_number, customers(name))")
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [pDate, setPDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const addPayment = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("payments").insert({
      user_id: user.id,
      invoice_id: invoiceId || null,
      amount: Number(amount || 0),
      method,
      reference: reference || null,
      payment_date: pDate,
      notes: notes || null,
    });
    if (!error && invoiceId) {
      await supabase.from("invoices").update({ status: "paid" }).eq("id", invoiceId);
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Payment recorded");
    setInvoiceId(""); setAmount(""); setReference(""); setNotes("");
    qc.invalidateQueries({ queryKey: ["payments-with-invoice"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["invoices-with-customer"] });
  };

  const totals = useMemo(() => {
    const rec = (paymentsQ.data ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
    const outstanding = (invoicesQ.data ?? [])
      .filter((i: any) => i.status !== "paid")
      .reduce((s: number, i: any) => s + Number(i.amount), 0);
    return { rec, outstanding, count: paymentsQ.data?.length ?? 0 };
  }, [paymentsQ.data, invoicesQ.data]);

  return (
    <div>
      <PageHeader title="Payments" subtitle="Record and reconcile payments." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Received" value={money(totals.rec)} icon={CheckCircle2} />
        <StatCard label="Outstanding" value={money(totals.outstanding)} icon={Clock} />
        <StatCard label="Total payments" value={String(totals.count)} icon={Wallet} />
      </div>

      <div className="mb-3 flex justify-end">
        <CreateDialog title="Record payment" triggerLabel="Add payment" busy={busy} onSubmit={addPayment}>
          <Field label="Invoice">
            <Select value={invoiceId} onValueChange={(v) => {
              setInvoiceId(v);
              const inv: any = invoicesQ.data?.find((i: any) => i.id === v);
              if (inv && !amount) setAmount(String(inv.amount));
            }}>
              <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
              <SelectContent>
                {invoicesQ.data?.map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>{i.invoice_number} — {money(Number(i.amount))}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount"><Input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Date"><Input type="date" required value={pDate} onChange={(e) => setPDate(e.target.value)} /></Field>
          </div>
          <Field label="Method">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </CreateDialog>
      </div>

      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentsQ.data?.length ? paymentsQ.data.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>{p.payment_date}</TableCell>
                  <TableCell className="font-medium">{p.invoices?.invoice_number || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.invoices?.customers?.name || "—"}</TableCell>
                  <TableCell>{money(Number(p.amount))}</TableCell>
                  <TableCell><Badge variant="secondary">{p.method.replace("_", " ")}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{p.reference || "—"}</TableCell>
                  <TableCell className="text-right"><RowDelete table="payments" id={p.id} invalidateKeys={[["payments-with-invoice"]]} /></TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No payments yet.</TableCell></TableRow>
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
