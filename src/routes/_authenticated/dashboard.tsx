import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Package, Wallet, UserCog, TrendingUp, AlertTriangle } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/nexus/PageHeader";
import { StatCard } from "@/components/nexus/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [customers, products, invoices, expenses, employees] = await Promise.all([
        supabase.from("customers").select("id, status, created_at"),
        supabase.from("products").select("id, stock, low_stock_threshold, price"),
        supabase.from("invoices").select("id, amount, status, issue_date"),
        supabase.from("expenses").select("id, amount, date, category"),
        supabase.from("employees").select("id, status, department"),
      ]);
      return {
        customers: customers.data ?? [],
        products: products.data ?? [],
        invoices: invoices.data ?? [],
        expenses: expenses.data ?? [],
        employees: employees.data ?? [],
      };
    },
  });

  const revenue = (data?.invoices ?? [])
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.amount), 0);
  const expensesTotal = (data?.expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const outstanding = (data?.invoices ?? [])
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + Number(i.amount), 0);
  const lowStock = (data?.products ?? []).filter((p) => p.stock <= p.low_stock_threshold).length;

  // 6-month series from invoices/expenses
  const months: { m: string; revenue: number; expense: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString("en", { month: "short" });
    const r = (data?.invoices ?? [])
      .filter((inv) => {
        const id = new Date(inv.issue_date);
        return id.getMonth() === d.getMonth() && id.getFullYear() === d.getFullYear() && inv.status === "paid";
      })
      .reduce((s, x) => s + Number(x.amount), 0);
    const e = (data?.expenses ?? [])
      .filter((ex) => {
        const id = new Date(ex.date);
        return id.getMonth() === d.getMonth() && id.getFullYear() === d.getFullYear();
      })
      .reduce((s, x) => s + Number(x.amount), 0);
    months.push({ m: key, revenue: r, expense: e });
  }

  const deptCounts: Record<string, number> = {};
  (data?.employees ?? []).forEach((e) => {
    const d = e.department || "Unassigned";
    deptCounts[d] = (deptCounts[d] ?? 0) + 1;
  });
  const deptData = Object.entries(deptCounts).map(([name, value]) => ({ name, value }));
  const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="A live snapshot of your operations."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue (paid)" value={money(revenue)} delta="All-time" icon={TrendingUp} tone="success" />
        <StatCard label="Outstanding" value={money(outstanding)} delta="Unpaid invoices" icon={Wallet} tone="warning" />
        <StatCard label="Customers" value={data?.customers.length ?? 0} icon={Users} />
        <StatCard label="Low-stock items" value={lowStock} icon={AlertTriangle} tone={lowStock ? "destructive" : "primary"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 shadow-soft lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <AreaChart data={months}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="m" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} fill="url(#rev)" />
                  <Area type="monotone" dataKey="expense" stroke="var(--chart-3)" strokeWidth={2} fill="url(#exp)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Team by department</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {deptData.length ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={deptData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                      {deptData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart icon={UserCog} label="No employees yet" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent invoices</CardTitle>
            <Badge variant="outline">{data?.invoices.length ?? 0}</Badge>
          </CardHeader>
          <CardContent>
            {(data?.invoices ?? []).slice(0, 5).map((i) => (
              <div key={i.id} className="flex items-center justify-between border-b border-border/60 py-2 text-sm last:border-0">
                <div className="font-medium">{money(Number(i.amount))}</div>
                <Badge variant={i.status === "paid" ? "default" : i.status === "overdue" ? "destructive" : "secondary"}>{i.status}</Badge>
              </div>
            ))}
            {!data?.invoices.length && <EmptyChart icon={Wallet} label="No invoices yet" />}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Net profit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-4xl font-semibold">{money(revenue - expensesTotal)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Revenue {money(revenue)} − Expenses {money(expensesTotal)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyChart({ icon: Icon, label }: { icon: typeof Package; label: string }) {
  return (
    <div className="grid h-full place-items-center text-sm text-muted-foreground">
      <div className="flex flex-col items-center gap-2">
        <Icon className="h-6 w-6 opacity-50" />
        {label}
      </div>
    </div>
  );
}
