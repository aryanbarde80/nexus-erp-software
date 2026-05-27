import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/stock")({ component: Stock });

function Stock() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const productsQ = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await supabase.from("products").select("id,name,stock,low_stock_threshold").order("name")).data ?? [],
  });

  const movementsQ = useQuery({
    queryKey: ["stock-movements-with-product"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*, products(name, sku)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const [productId, setProductId] = useState("");
  const [type, setType] = useState("in");
  const [qty, setQty] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const add = async () => {
    if (!user || !productId) { toast.error("Select a product"); return; }
    setBusy(true);
    const product: any = productsQ.data?.find((p: any) => p.id === productId);
    const delta = type === "in" ? Number(qty || 0) : -Number(qty || 0);
    const newStock = (product?.stock ?? 0) + delta;
    if (newStock < 0) { setBusy(false); toast.error("Insufficient stock"); return; }

    const { error } = await supabase.from("stock_movements").insert({
      user_id: user.id, product_id: productId,
      movement_type: type, quantity: Number(qty || 0),
      reference: reference || null, notes: notes || null,
    });
    if (!error) {
      await supabase.from("products").update({ stock: newStock }).eq("id", productId);
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Movement recorded");
    setProductId(""); setQty(""); setReference(""); setNotes("");
    qc.invalidateQueries({ queryKey: ["stock-movements-with-product"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const lowStock = useMemo(
    () => (productsQ.data ?? []).filter((p: any) => p.stock <= (p.low_stock_threshold ?? 5)),
    [productsQ.data]
  );

  return (
    <div>
      <PageHeader title="Stock movements" subtitle="Record stock in/out and watch low inventory." />
      <div className="mb-3 flex justify-end">
        <CreateDialog title="Record movement" triggerLabel="New movement" busy={busy} onSubmit={add}>
          <Field label="Product">
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {productsQ.data?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} (stock: {p.stock})</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Stock in</SelectItem>
                  <SelectItem value="out">Stock out</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Quantity"><Input type="number" min="1" required value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          </div>
          <Field label="Reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO #, Sale #, …" /></Field>
          <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </CreateDialog>
      </div>

      {lowStock.length > 0 && (
        <Card className="mb-6 border-warning/40 bg-warning/5">
          <CardContent className="p-4">
            <div className="mb-2 text-sm font-semibold">Low stock alerts ({lowStock.length})</div>
            <div className="flex flex-wrap gap-2">
              {lowStock.map((p: any) => (
                <Badge key={p.id} variant="secondary">{p.name} — {p.stock} left</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {movementsQ.data?.length ? movementsQ.data.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{m.products?.name || "—"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-sm ${m.movement_type === "in" ? "text-success" : "text-destructive"}`}>
                      {m.movement_type === "in" ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                      {m.movement_type}
                    </span>
                  </TableCell>
                  <TableCell>{m.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">{m.reference || "—"}</TableCell>
                  <TableCell className="text-right"><RowDelete table="stock_movements" id={m.id} invalidateKeys={[["stock-movements-with-product"]]} /></TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No movements yet.</TableCell></TableRow>
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
