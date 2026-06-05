import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/nexus/PageHeader";
import { CreateDialog } from "@/components/nexus/CreateDialog";
import { RowDelete } from "@/components/nexus/RowDelete";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "@tanstack/react-router";
import { CreditCard, ExternalLink } from "lucide-react";
import { logActivity } from "@/lib/activity";
import { ActivityTimeline } from "@/components/nexus/ActivityTimeline";

export const Route = createFileRoute("/_authenticated/sales")({
  component: Sales,
});

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function Sales() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const customersQ = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invoicesQ = useQuery({
    queryKey: ["invoices-with-customer"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Customer create
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cCompany, setCCompany] = useState("");
  const [cStatus, setCStatus] = useState("lead");
  const [cNotes, setCNotes] = useState("");

  const addCustomer = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("customers").insert({
      user_id: user.id,
      name: cName, email: cEmail || null, phone: cPhone || null,
      company: cCompany || null, status: cStatus, notes: cNotes || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Customer added");
    setCName(""); setCEmail(""); setCPhone(""); setCCompany(""); setCNotes("");
    qc.invalidateQueries({ queryKey: ["customers"] });
  };

  // Invoice create
  const [iNumber, setINumber] = useState("");
  const [iCustomer, setICustomer] = useState<string>("");
  const [iAmount, setIAmount] = useState("");
  const [iStatus, setIStatus] = useState("draft");
  const [iDue, setIDue] = useState("");

  const addInvoice = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("invoices").insert({
      user_id: user.id,
      invoice_number: iNumber || `INV-${Date.now().toString().slice(-6)}`,
      customer_id: iCustomer || null,
      amount: Number(iAmount || 0),
      status: iStatus,
      due_date: iDue || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Invoice created");
    setINumber(""); setICustomer(""); setIAmount(""); setIDue("");
    qc.invalidateQueries({ queryKey: ["invoices-with-customer"] });
  };

  const setInvoiceStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    if (user) {
      await logActivity({
        userId: user.id, entityType: "invoice", entityId: id,
        action: "status_changed", description: `Status set to ${status}`,
      });
    }
    toast.success(`Invoice marked ${status}`);
    qc.invalidateQueries({ queryKey: ["invoices-with-customer"] });
  };

  const recordPayment = async (inv: any) => {
    if (!user) return;
    const { error } = await supabase.from("payments").insert({
      user_id: user.id,
      invoice_id: inv.id,
      amount: Number(inv.amount),
      method: "card",
      reference: `Auto-${inv.invoice_number}`,
    });
    if (error) return toast.error(error.message);
    await supabase.from("invoices").update({ status: "paid" }).eq("id", inv.id);
    await logActivity({
      userId: user.id, entityType: "invoice", entityId: inv.id,
      action: "payment_received",
      description: `Payment of ${money(Number(inv.amount))} recorded via card`,
    });
    toast.success("Payment recorded");
    qc.invalidateQueries({ queryKey: ["invoices-with-customer"] });
    qc.invalidateQueries({ queryKey: ["payments-with-invoice"] });
  };

  return (
    <div>
      <PageHeader title="Sales & CRM" subtitle="Manage customers and invoices." />
      <div className="mb-4">
        <Input placeholder="Search customers or invoices…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      </div>
      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers"><Users className="mr-2 h-4 w-4" /> Customers</TabsTrigger>
          <TabsTrigger value="invoices"><FileText className="mr-2 h-4 w-4" /> Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="mt-4">
          <div className="mb-3 flex justify-end">
            <CreateDialog
              title="New customer" triggerLabel="Add customer"
              busy={busy} onSubmit={addCustomer}
            >
              <Field label="Name"><Input required value={cName} onChange={(e) => setCName(e.target.value)} /></Field>
              <Field label="Company"><Input value={cCompany} onChange={(e) => setCCompany(e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email"><Input type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} /></Field>
                <Field label="Phone"><Input value={cPhone} onChange={(e) => setCPhone(e.target.value)} /></Field>
              </div>
              <Field label="Status">
                <Select value={cStatus} onValueChange={setCStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="churned">Churned</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Notes"><Textarea value={cNotes} onChange={(e) => setCNotes(e.target.value)} /></Field>
            </CreateDialog>
          </div>
          <Card className="border-border/60 shadow-soft">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customersQ.data?.filter((c) => !search || `${c.name} ${c.company ?? ""} ${c.email ?? ""}`.toLowerCase().includes(search.toLowerCase())).length ? customersQ.data!.filter((c) => !search || `${c.name} ${c.company ?? ""} ${c.email ?? ""}`.toLowerCase().includes(search.toLowerCase())).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.company || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.email || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.phone || "—"}</TableCell>
                      <TableCell><Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                      <TableCell className="text-right"><RowDelete table="customers" id={c.id} invalidateKeys={[["customers"]]} /></TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No customers yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <div className="mb-3 flex justify-end">
            <CreateDialog title="New invoice" triggerLabel="Add invoice" busy={busy} onSubmit={addInvoice}>
              <Field label="Invoice #"><Input placeholder="auto" value={iNumber} onChange={(e) => setINumber(e.target.value)} /></Field>
              <Field label="Customer">
                <Select value={iCustomer} onValueChange={setICustomer}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customersQ.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount"><Input type="number" step="0.01" required value={iAmount} onChange={(e) => setIAmount(e.target.value)} /></Field>
                <Field label="Due date"><Input type="date" value={iDue} onChange={(e) => setIDue(e.target.value)} /></Field>
              </div>
              <Field label="Status">
                <Select value={iStatus} onValueChange={setIStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </CreateDialog>
          </div>
          <Card className="border-border/60 shadow-soft">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesQ.data?.filter((i: any) => !search || `${i.invoice_number} ${i.customers?.name ?? ""}`.toLowerCase().includes(search.toLowerCase())).length ? invoicesQ.data!.filter((i: any) => !search || `${i.invoice_number} ${i.customers?.name ?? ""}`.toLowerCase().includes(search.toLowerCase())).map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.invoice_number}</TableCell>
                      <TableCell className="text-muted-foreground">{i.customers?.name || "—"}</TableCell>
                      <TableCell>{money(Number(i.amount))}</TableCell>
                      <TableCell className="text-muted-foreground">{i.due_date || "—"}</TableCell>
                      <TableCell>
                        <Select value={i.status} onValueChange={(v) => setInvoiceStatus(i.id, v)}>
                          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="flex justify-end gap-1">
                        <Button asChild size="icon" variant="ghost" className="h-8 w-8" title="Open invoice">
                          <Link to="/store/invoice/$id" params={{ id: i.id }}><ExternalLink className="h-4 w-4" /></Link>
                        </Button>
                        <ActivityTimeline entityType="invoice" entityId={i.id} title={`Invoice ${i.invoice_number}`} />
                        {i.status !== "paid" && (
                          <Button size="sm" variant="outline" onClick={() => recordPayment(i)}>
                            <CreditCard className="mr-1 h-3.5 w-3.5" /> Pay
                          </Button>
                        )}
                        <RowDelete table="invoices" id={i.id} invalidateKeys={[["invoices-with-customer"], ["invoices"]]} />
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No invoices yet.</TableCell></TableRow>
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
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
