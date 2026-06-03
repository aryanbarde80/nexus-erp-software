import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShoppingCart, Plus, Minus, Trash2, Package, CreditCard, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/nexus/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/store")({ component: Store });

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

type Item = { id: string; name: string; price: number; qty: number; stock: number };

function Store() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Checkout fields
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [method, setMethod] = useState("card");

  const productsQ = useQuery({
    queryKey: ["store-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,price,stock,sku,category")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    (productsQ.data ?? []).forEach((p: any) => p.category && set.add(p.category));
    return Array.from(set);
  }, [productsQ.data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (productsQ.data ?? []).filter((p: any) => {
      const m = !q || p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q);
      const c = category === "all" || p.category === category;
      return m && c;
    });
  }, [productsQ.data, search, category]);

  const addToCart = (p: any) => {
    if (p.stock <= 0) return toast.error("Out of stock");
    setCart((c) => {
      const ex = c.find((x) => x.id === p.id);
      if (ex) {
        if (ex.qty + 1 > p.stock) { toast.error("No more stock"); return c; }
        return c.map((x) => x.id === p.id ? { ...x, qty: x.qty + 1 } : x);
      }
      return [...c, { id: p.id, name: p.name, price: Number(p.price), qty: 1, stock: p.stock }];
    });
    toast.success(`Added ${p.name}`);
  };

  const setQty = (id: string, qty: number) => {
    setCart((c) => c.map((x) => x.id === id ? { ...x, qty: Math.max(1, Math.min(qty, x.stock)) } : x));
  };
  const removeItem = (id: string) => setCart((c) => c.filter((x) => x.id !== id));

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  const placeOrder = async () => {
    if (!user) return;
    if (!cart.length) return toast.error("Cart is empty");
    if (!custName.trim()) return toast.error("Customer name required");
    if (method === "card" && (cardNumber.replace(/\s/g, "").length < 12 || cardCvc.length < 3)) {
      return toast.error("Invalid card details");
    }
    setBusy(true);

    // 1. Find or create customer
    let customerId: string | null = null;
    if (custEmail) {
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", user.id)
        .eq("email", custEmail)
        .maybeSingle();
      if (existing) customerId = existing.id;
    }
    if (!customerId) {
      const { data: newCust, error: cErr } = await supabase
        .from("customers")
        .insert({
          user_id: user.id,
          name: custName,
          email: custEmail || null,
          phone: custPhone || null,
          status: "customer",
          notes: custAddress ? `Address: ${custAddress}` : null,
        })
        .select("id")
        .single();
      if (cErr || !newCust) { setBusy(false); return toast.error(cErr?.message ?? "Customer error"); }
      customerId = newCust.id;
    }

    // 2. Invoice
    const invNumber = `INV-${Date.now().toString().slice(-8)}`;
    const lineDetails = cart.map((i) => `${i.qty} × ${i.name} @ ${money(i.price)}`).join("\n");
    const { data: invoice, error: iErr } = await supabase
      .from("invoices")
      .insert({
        user_id: user.id,
        customer_id: customerId,
        invoice_number: invNumber,
        amount: total,
        tax,
        status: method === "cash" ? "pending" : "paid",
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: new Date().toISOString().slice(0, 10),
        notes: `Store order\n${lineDetails}\nSubtotal: ${money(subtotal)}\nTax: ${money(tax)}\nTotal: ${money(total)}\nBill to: ${custAddress || "—"}`,
      })
      .select("id")
      .single();
    if (iErr || !invoice) { setBusy(false); return toast.error(iErr?.message ?? "Invoice error"); }

    // 3. Stock movements + product stock decrement
    for (const item of cart) {
      await supabase.from("stock_movements").insert({
        user_id: user.id,
        product_id: item.id,
        movement_type: "out",
        quantity: item.qty,
        reference: invNumber,
        notes: "Store sale",
      });
      await supabase
        .from("products")
        .update({ stock: item.stock - item.qty })
        .eq("id", item.id);
    }

    // 4. Payment record
    await supabase.from("payments").insert({
      user_id: user.id,
      invoice_id: invoice.id,
      amount: total,
      method: method === "card" ? "card" : method,
      reference: method === "card" ? `**** ${cardNumber.slice(-4)}` : null,
      payment_date: new Date().toISOString().slice(0, 10),
      notes: "Storefront checkout",
    });

    setBusy(false);
    setCheckoutOpen(false);
    setSheetOpen(false);
    setCart([]);
    toast.success("Order placed!");
    navigate({ to: "/store/invoice/$id", params: { id: invoice.id } });
  };

  return (
    <div>
      <PageHeader
        title="Store"
        subtitle="Browse products, add to cart, and check out."
        actions={
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button className="relative">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Cart
                {cart.length > 0 && (
                  <Badge className="ml-2" variant="secondary">{cart.reduce((s, i) => s + i.qty, 0)}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="flex w-full flex-col sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Your cart</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto py-4">
                {cart.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">Cart is empty</p>
                ) : (
                  <div className="space-y-3">
                    {cart.map((i) => (
                      <div key={i.id} className="flex items-center gap-3 rounded-lg border p-3">
                        <div className="flex-1">
                          <div className="font-medium">{i.name}</div>
                          <div className="text-xs text-muted-foreground">{money(i.price)} each</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(i.id, i.qty - 1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-7 text-center text-sm">{i.qty}</span>
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(i.id, i.qty + 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="w-20 text-right font-medium">{money(i.price * i.qty)}</div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(i.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <SheetFooter className="flex-col gap-2 border-t pt-4 sm:flex-col">
                <div className="w-full space-y-1 text-sm">
                  <Row label="Subtotal" value={money(subtotal)} />
                  <Row label="Tax (10%)" value={money(tax)} />
                  <Row label="Total" value={money(total)} bold />
                </div>
                <Button
                  className="w-full"
                  disabled={!cart.length}
                  onClick={() => { setSheetOpen(false); setCheckoutOpen(true); }}
                >
                  <CreditCard className="mr-2 h-4 w-4" /> Checkout
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        }
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {productsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Package className="h-8 w-8" />
            <p>No products available. Add some in Inventory.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p: any) => (
            <Card key={p.id} className="border-border/60 shadow-soft transition hover:shadow-md">
              <CardContent className="p-4">
                <div className="mb-3 flex h-32 items-center justify-center rounded-md bg-muted">
                  <Package className="h-10 w-10 text-muted-foreground/60" />
                </div>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 font-medium">{p.name}</h3>
                  {p.stock <= 0 ? (
                    <Badge variant="destructive">Out</Badge>
                  ) : p.stock < 5 ? (
                    <Badge variant="secondary">Low</Badge>
                  ) : null}
                </div>
                {p.category && <p className="mb-2 text-xs text-muted-foreground">{p.category}</p>}
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-lg font-semibold">{money(Number(p.price))}</span>
                  <span className="text-xs text-muted-foreground">{p.stock} in stock</span>
                </div>
                <Button className="w-full" size="sm" disabled={p.stock <= 0} onClick={() => addToCart(p)}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add to cart
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Checkout</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Billing details</h4>
              <Field label="Full name"><Input value={custName} onChange={(e) => setCustName(e.target.value)} required /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email"><Input type="email" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} /></Field>
                <Field label="Phone"><Input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} /></Field>
              </div>
              <Field label="Address"><Textarea rows={2} value={custAddress} onChange={(e) => setCustAddress(e.target.value)} /></Field>

              <h4 className="pt-2 text-sm font-semibold">Payment</h4>
              <Field label="Method">
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Credit / Debit card</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                    <SelectItem value="cash">Cash on delivery</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {method === "card" && (
                <>
                  <Field label="Name on card"><Input value={cardName} onChange={(e) => setCardName(e.target.value)} /></Field>
                  <Field label="Card number">
                    <Input
                      inputMode="numeric"
                      maxLength={19}
                      placeholder="4242 4242 4242 4242"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value.replace(/[^\d ]/g, ""))}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Expiry"><Input placeholder="MM/YY" maxLength={5} value={cardExp} onChange={(e) => setCardExp(e.target.value)} /></Field>
                    <Field label="CVC"><Input maxLength={4} inputMode="numeric" value={cardCvc} onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ""))} /></Field>
                  </div>
                </>
              )}
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold">Order summary</h4>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="mb-3 space-y-2 text-sm">
                  {cart.map((i) => (
                    <div key={i.id} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{i.qty} × {i.name}</span>
                      <span>{money(i.price * i.qty)}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 border-t pt-3 text-sm">
                  <Row label="Subtotal" value={money(subtotal)} />
                  <Row label="Tax (10%)" value={money(tax)} />
                  <Row label="Total" value={money(total)} bold />
                </div>
              </div>
              <Button className="mt-4 w-full" disabled={busy} onClick={placeOrder}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {busy ? "Processing…" : `Pay ${money(total)}`}
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">Demo checkout. No real charge.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "border-t pt-2 text-base font-semibold" : "text-muted-foreground"}`}>
      <span>{label}</span><span className={bold ? "text-foreground" : ""}>{value}</span>
    </div>
  );
}
