import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Truck, ClipboardList } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/suppliers")({
  component: Suppliers,
});

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function Suppliers() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const suppliersQ = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
  });

  const poQ = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_orders").select("*, suppliers(name)").order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
  });

  // Supplier form
  const [sName, setSName] = useState("");
  const [sContact, setSContact] = useState("");
  const [sEmail, setSEmail] = useState("");
  const [sPhone, setSPhone] = useState("");
  const [sAddress, setSAddress] = useState("");
  const [sNotes, setSNotes] = useState("");

  const addSupplier = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("suppliers").insert({
      user_id: user.id,
      name: sName, contact_name: sContact || null, email: sEmail || null,
      phone: sPhone || null, address: sAddress || null, notes: sNotes || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Supplier added");
    setSName(""); setSContact(""); setSEmail(""); setSPhone(""); setSAddress(""); setSNotes("");
    qc.invalidateQueries({ queryKey: ["suppliers"] });
  };

  // PO form
  const [poNum, setPoNum] = useState("");
  const [poSup, setPoSup] = useState<string>("");
  const [poTotal, setPoTotal] = useState("");
  const [poStatus, setPoStatus] = useState("draft");
  const [poExp, setPoExp] = useState("");

  const addPO = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("purchase_orders").insert({
      user_id: user.id,
      po_number: poNum || `PO-${Date.now().toString().slice(-6)}`,
      supplier_id: poSup || null,
      total: Number(poTotal || 0),
      status: poStatus,
      expected_date: poExp || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Purchase order created");
    setPoNum(""); setPoSup(""); setPoTotal(""); setPoExp("");
    qc.invalidateQueries({ queryKey: ["purchase-orders"] });
  };

  return (
    <div>
      <PageHeader title="Suppliers & Purchasing" subtitle="Vendor directory and purchase orders." />
      <Tabs defaultValue="suppliers">
        <TabsList>
          <TabsTrigger value="suppliers"><Truck className="mr-2 h-4 w-4" /> Suppliers</TabsTrigger>
          <TabsTrigger value="po"><ClipboardList className="mr-2 h-4 w-4" /> Purchase Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="suppliers" className="mt-4">
          <div className="mb-3 flex justify-end">
            <CreateDialog title="New supplier" triggerLabel="Add supplier" busy={busy} onSubmit={addSupplier}>
              <Field label="Name"><Input required value={sName} onChange={(e) => setSName(e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contact"><Input value={sContact} onChange={(e) => setSContact(e.target.value)} /></Field>
                <Field label="Phone"><Input value={sPhone} onChange={(e) => setSPhone(e.target.value)} /></Field>
              </div>
              <Field label="Email"><Input type="email" value={sEmail} onChange={(e) => setSEmail(e.target.value)} /></Field>
              <Field label="Address"><Input value={sAddress} onChange={(e) => setSAddress(e.target.value)} /></Field>
              <Field label="Notes"><Textarea value={sNotes} onChange={(e) => setSNotes(e.target.value)} /></Field>
            </CreateDialog>
          </div>
          <Card className="border-border/60 shadow-soft">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliersQ.data?.length ? suppliersQ.data.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.contact_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{s.email || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{s.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{s.address || "—"}</TableCell>
                      <TableCell className="text-right"><RowDelete table="suppliers" id={s.id} invalidateKeys={[["suppliers"]]} /></TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No suppliers yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="po" className="mt-4">
          <div className="mb-3 flex justify-end">
            <CreateDialog title="New purchase order" triggerLabel="New PO" busy={busy} onSubmit={addPO}>
              <Field label="PO Number"><Input placeholder="auto" value={poNum} onChange={(e) => setPoNum(e.target.value)} /></Field>
              <Field label="Supplier">
                <Select value={poSup} onValueChange={setPoSup}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliersQ.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Total"><Input type="number" step="0.01" required value={poTotal} onChange={(e) => setPoTotal(e.target.value)} /></Field>
                <Field label="Expected"><Input type="date" value={poExp} onChange={(e) => setPoExp(e.target.value)} /></Field>
              </div>
              <Field label="Status">
                <Select value={poStatus} onValueChange={setPoStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="ordered">Ordered</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
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
                    <TableHead>PO #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Ordered</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poQ.data?.length ? poQ.data.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.po_number}</TableCell>
                      <TableCell className="text-muted-foreground">{p.suppliers?.name || "—"}</TableCell>
                      <TableCell>{money(Number(p.total))}</TableCell>
                      <TableCell className="text-muted-foreground">{p.order_date}</TableCell>
                      <TableCell className="text-muted-foreground">{p.expected_date || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "received" ? "default" : p.status === "cancelled" ? "destructive" : "secondary"}>{p.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right"><RowDelete table="purchase_orders" id={p.id} invalidateKeys={[["purchase-orders"]]} /></TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No purchase orders yet.</TableCell></TableRow>
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
