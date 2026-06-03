import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/nexus/Logo";

export const Route = createFileRoute("/_authenticated/store/invoice/$id")({
  component: InvoicePage,
});

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function InvoicePage() {
  const { id } = Route.useParams();

  const invQ = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(name,email,phone,notes), payments(amount,method,payment_date,reference)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  if (invQ.isLoading) return <p className="text-sm text-muted-foreground">Loading invoice…</p>;
  if (!invQ.data) return <p>Invoice not found.</p>;

  const inv = invQ.data;
  const customer = inv.customers;
  const payment = inv.payments?.[0];

  // Parse line items from notes
  const lines: { qty: number; name: string; price: number }[] = [];
  if (inv.notes) {
    for (const line of inv.notes.split("\n")) {
      const m = line.match(/^(\d+)\s*×\s*(.+?)\s*@\s*\$?([\d,.]+)/);
      if (m) lines.push({ qty: +m[1], name: m[2], price: parseFloat(m[3].replace(/,/g, "")) });
    }
  }
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0) || Number(inv.amount) - Number(inv.tax);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/store"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Back to store</Button></Link>
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print / Save PDF</Button>
      </div>

      <Card className="mx-auto max-w-3xl border-border/60 shadow-soft print:border-0 print:shadow-none">
        <CardContent className="p-10">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <Logo />
              <p className="mt-2 text-xs text-muted-foreground">Nexus ERP · Business Software</p>
            </div>
            <div className="text-right">
              <h2 className="font-display text-2xl font-semibold">Invoice</h2>
              <p className="text-sm text-muted-foreground">{inv.invoice_number}</p>
              <Badge className="mt-1" variant={inv.status === "paid" ? "default" : "secondary"}>
                {inv.status === "paid" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                {inv.status}
              </Badge>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Bill to</p>
              <p className="font-medium">{customer?.name || "—"}</p>
              {customer?.email && <p className="text-muted-foreground">{customer.email}</p>}
              {customer?.phone && <p className="text-muted-foreground">{customer.phone}</p>}
              {customer?.notes && <p className="text-muted-foreground whitespace-pre-line">{customer.notes}</p>}
            </div>
            <div className="text-right">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Issued</p>
              <p>{inv.issue_date}</p>
              <p className="mt-2 mb-1 text-xs uppercase tracking-wide text-muted-foreground">Due</p>
              <p>{inv.due_date || "—"}</p>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2">Item</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Price</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.length ? lines.map((l, i) => (
                <tr key={i} className="border-b">
                  <td className="py-3">{l.name}</td>
                  <td className="py-3 text-right">{l.qty}</td>
                  <td className="py-3 text-right">{money(l.price)}</td>
                  <td className="py-3 text-right">{money(l.qty * l.price)}</td>
                </tr>
              )) : (
                <tr className="border-b">
                  <td className="py-3" colSpan={3}>Order items</td>
                  <td className="py-3 text-right">{money(subtotal)}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-6 flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{money(subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>{money(Number(inv.tax))}</span></div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span>{money(Number(inv.amount))}</span></div>
              {payment && (
                <div className="mt-3 flex justify-between text-emerald-600">
                  <span>Paid · {String(payment.method).replace("_", " ")}</span>
                  <span>{money(Number(payment.amount))}</span>
                </div>
              )}
            </div>
          </div>

          <p className="mt-10 border-t pt-4 text-center text-xs text-muted-foreground">
            Thank you for your business!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
