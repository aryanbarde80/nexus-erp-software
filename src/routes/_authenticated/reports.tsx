import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/nexus/PageHeader";
import { StatCard } from "@/components/nexus/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, ShoppingCart, Users, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: Reports,
});

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Reports() {
  const { data } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const [invoices, expenses, customers, products, po] = await Promise.all([
        supabase.from("invoices").select("amount, status, issue_date"),
        supabase.from("expenses").select("amount, category, date"),
        supabase.from("customers").select("status, created_at"),
        supabase.from("products").select("name, stock, price, cost"),
        supabase.from("purchase_orders").select("total, status"),
      ]);
      return {
        invoices: invoices.data ?? [],
        expenses: expenses.data ?? [],
        customers: customers.data ?? [],
        products: products.data ?? [],
        po: po.data ?? [],
      };
    },
  });

  const revenue = (data?.invoices ?? []).filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const expensesTotal = (data?.expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const inventoryValue = (data?.products ?? []).reduce((s, p) => s + Number(p.price) * Number(p.stock), 0);
  const poTotal = (data?.po ?? []).reduce((s, p) => s + Number(p.total), 0);

  // Expense by category
  const catMap: Record<string, number> = {};
  (data?.expenses ?? []).forEach((e) => {
    catMap[e.category] = (catMap[e.category] ?? 0) + Number(e.amount);
  });
  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

  // Monthly cashflow last 12 months
  const months: { m: string; revenue: number; expense: number; net: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString("en", { month: "short" });
    const r = (data?.invoices ?? []).filter((inv) => {
      const id = new Date(inv.issue_date);
      return id.getMonth() === d.getMonth() && id.getFullYear() === d.getFullYear() && inv.status === "paid";
    }).reduce((s, x) => s + Number(x.amount), 0);
    const e = (data?.expenses ?? []).filter((ex) => {
      const id = new Date(ex.date);
      return id.getMonth() === d.getMonth() && id.getFullYear() === d.getFullYear();
    }).reduce((s, x) => s + Number(x.amount), 0);
    months.push({ m: key, revenue: r, expense: e, net: r - e });
  }

  // Top products by inventory value
  const topProducts = [...(data?.products ?? [])]
    .map((p) => ({ name: p.name, value: Number(p.price) * Number(p.stock) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Customer status breakdown
  const custMap: Record<string, number> = {};
  (data?.customers ?? []).forEach((c) => { custMap[c.status] = (custMap[c.status] ?? 0) + 1; });
  const custData = Object.entries(custMap).map(([name, value]) => ({ name, value }));

  return (
    <div>
      <PageHeader title="Reports & Analytics" subtitle="Cross-module performance insights." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total revenue" value={money(revenue)} icon={TrendingUp} tone="success" />
        <StatCard label="Total expenses" value={money(expensesTotal)} icon={Wallet} tone="warning" />
        <StatCard label="Inventory value" value={money(inventoryValue)} icon={ShoppingCart} />
        <StatCard label="Purchase orders" value={money(poTotal)} icon={Users} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 shadow-soft">
          <CardHeader><CardTitle className="text-base font-semibold">12-month cashflow</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={months}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="m" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} />
                  <Line type="monotone" dataKey="expense" stroke="var(--chart-3)" strokeWidth={2} />
                  <Line type="monotone" dataKey="net" stroke="var(--chart-2)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-soft">
          <CardHeader><CardTitle className="text-base font-semibold">Expenses by category</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              {catData.length ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={catData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <Empty label="No expense data" />}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-soft">
          <CardHeader><CardTitle className="text-base font-semibold">Top products by value</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              {topProducts.length ? (
                <ResponsiveContainer>
                  <BarChart data={topProducts} layout="vertical">
                    <CartesianGrid stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={12} width={100} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty label="No products yet" />}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-soft">
          <CardHeader><CardTitle className="text-base font-semibold">Customers by status</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              {custData.length ? (
                <ResponsiveContainer>
                  <BarChart data={custData}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty label="No customers yet" />}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="grid h-full place-items-center text-sm text-muted-foreground">{label}</div>;
}
