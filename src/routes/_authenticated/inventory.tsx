import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/nexus/PageHeader";
import { CreateDialog } from "@/components/nexus/CreateDialog";
import { RowDelete } from "@/components/nexus/RowDelete";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: Inventory,
});

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function Inventory() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const productsQ = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("");
  const [low, setLow] = useState("5");

  const add = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("products").insert({
      user_id: user.id,
      name, sku: sku || null, category: category || null,
      price: Number(price || 0), cost: Number(cost || 0),
      stock: Number(stock || 0), low_stock_threshold: Number(low || 5),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Product added");
    setName(""); setSku(""); setCategory(""); setPrice(""); setCost(""); setStock("");
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  return (
    <div>
      <PageHeader
        title="Inventory" subtitle="Products, stock levels and low-stock alerts."
        actions={
          <CreateDialog title="New product" triggerLabel="Add product" busy={busy} onSubmit={add}>
            <Field label="Name"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SKU"><Input value={sku} onChange={(e) => setSku(e.target.value)} /></Field>
              <Field label="Category"><Input value={category} onChange={(e) => setCategory(e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price"><Input type="number" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
              <Field label="Cost"><Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stock"><Input type="number" required value={stock} onChange={(e) => setStock(e.target.value)} /></Field>
              <Field label="Low stock threshold"><Input type="number" value={low} onChange={(e) => setLow(e.target.value)} /></Field>
            </div>
          </CreateDialog>
        }
      />
      <div className="mb-4">
        <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      </div>
      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsQ.data?.filter((p) => !search || `${p.name} ${p.sku ?? ""} ${p.category ?? ""}`.toLowerCase().includes(search.toLowerCase())).length ? productsQ.data!.filter((p) => !search || `${p.name} ${p.sku ?? ""} ${p.category ?? ""}`.toLowerCase().includes(search.toLowerCase())).map((p) => {
                const lowStock = p.stock <= p.low_stock_threshold;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.sku || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.category || "—"}</TableCell>
                    <TableCell>{money(Number(p.price))}</TableCell>
                    <TableCell>
                      {lowStock ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> {p.stock}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{p.stock}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right"><RowDelete table="products" id={p.id} invalidateKeys={[["products"]]} /></TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No products yet.</TableCell></TableRow>
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
