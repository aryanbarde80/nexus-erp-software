import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/nexus/PageHeader";
import { StatCard } from "@/components/nexus/StatCard";
import { CreateDialog } from "@/components/nexus/CreateDialog";
import { RowDelete } from "@/components/nexus/RowDelete";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/finance")({
  component: Finance,
});

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const CATEGORIES = ["Rent", "Payroll", "Software", "Marketing", "Travel", "Utilities", "Other"];

function Finance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const invoicesQ = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("amount, status");
      if (error) throw error; return data;
    },
  });
  const expensesQ = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("date", { ascending: false });
      if (error) throw error; return data;
    },
  });

  const revenue = (invoicesQ.data ?? []).filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const totalExp = (expensesQ.data ?? []).reduce((s, e) => s + Number(e.amount), 0);

  const [category, setCategory] = useState("Other");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const add = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("expenses").insert({
      user_id: user.id,
      category, description: description || null, amount: Number(amount || 0),
      vendor: vendor || null, date,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Expense logged");
    setDescription(""); setAmount(""); setVendor("");
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  return (
    <div>
      <PageHeader
        title="Finance" subtitle="Income, expenses and net position."
        actions={
          <CreateDialog title="New expense" triggerLabel="Log expense" busy={busy} onSubmit={add}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Amount"><Input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vendor"><Input value={vendor} onChange={(e) => setVendor(e.target.value)} /></Field>
              <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            </div>
            <Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          </CreateDialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Revenue" value={money(revenue)} icon={TrendingUp} tone="success" />
        <StatCard label="Expenses" value={money(totalExp)} icon={TrendingDown} tone="destructive" />
        <StatCard label="Net" value={money(revenue - totalExp)} icon={DollarSign} />
      </div>

      <h2 className="mt-8 mb-3 font-display text-lg font-semibold">Expense log</h2>
      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expensesQ.data?.length ? expensesQ.data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-muted-foreground">{e.date}</TableCell>
                  <TableCell>{e.category}</TableCell>
                  <TableCell className="text-muted-foreground">{e.vendor || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.description || "—"}</TableCell>
                  <TableCell className="text-right font-medium">{money(Number(e.amount))}</TableCell>
                  <TableCell className="text-right"><RowDelete table="expenses" id={e.id} invalidateKeys={[["expenses"]]} /></TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No expenses yet.</TableCell></TableRow>
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
