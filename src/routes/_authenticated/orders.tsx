import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Clock, CreditCard, Package, Truck, CheckCircle2, XCircle, FileText, Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/nexus/PageHeader";
import { StatCard } from "@/components/nexus/StatCard";
import { RowDelete } from "@/components/nexus/RowDelete";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/orders")({ component: Orders });

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const STEPS = [
  { key: "pending",   label: "Pending",    icon: Clock },
  { key: "paid",      label: "Paid",       icon: CreditCard },
  { key: "processing",label: "Processing", icon: Package },
  { key: "shipped",   label: "Shipped",    icon: Truck },
  { key: "completed", label: "Completed",  icon: CheckCircle2 },
] as const;

type StepKey = typeof STEPS[number]["key"];

const stepIndex = (s: string) => {
  // Treat legacy 'draft' as pending
  const norm = s === "draft" ? "pending" : s;
  const i = STEPS.findIndex((x) => x.key === norm);
  return i === -1 ? 0 : i;
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "completed") return "default";
  if (s === "cancelled") return "destructive";
  if (s === "paid" || s === "shipped") return "default";
  return "secondary";
};

function Orders() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const ordersQ = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(name,email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (ordersQ.data ?? []).filter((o: any) => {
      const matches = !q
        || o.invoice_number.toLowerCase().includes(q)
        || (o.customers?.name ?? "").toLowerCase().includes(q);
      const status = o.status === "draft" ? "pending" : o.status;
      const matchesFilter = filter === "all" || status === filter;
      return matches && matchesFilter;
    });
  }, [ordersQ.data, search, filter]);

  const stats = useMemo(() => {
    const all = ordersQ.data ?? [];
    const count = (k: string) => all.filter((o: any) => (o.status === "draft" ? "pending" : o.status) === k).length;
    const revenue = all
      .filter((o: any) => ["paid", "processing", "shipped", "completed"].includes(o.status))
      .reduce((s: number, o: any) => s + Number(o.amount), 0);
    return {
      total: all.length,
      pending: count("pending"),
      shipping: count("processing") + count("shipped"),
      completed: count("completed"),
      revenue,
    };
  }, [ordersQ.data]);

  const setStatus = async (id: string, status: StepKey | "cancelled") => {
    const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked as ${status}`);
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["invoices-with-customer"] });
  };

  return (
    <div>
      <PageHeader title="Orders" subtitle="Track each purchase from pending through to completion." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total orders" value={String(stats.total)} icon={FileText} />
        <StatCard label="Pending" value={String(stats.pending)} icon={Clock} />
        <StatCard label="In fulfilment" value={String(stats.shipping)} icon={Truck} />
        <StatCard label="Revenue" value={money(stats.revenue)} icon={CheckCircle2} />
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search orders…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STEPS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[340px]">Progress</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length ? filtered.map((o: any) => {
                const status = o.status === "draft" ? "pending" : o.status;
                const idx = stepIndex(status);
                const isCancelled = status === "cancelled";
                const next = STEPS[idx + 1];
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link to="/store/invoice/$id" params={{ id: o.id }} className="font-medium hover:underline">
                        {o.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{o.customers?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{o.issue_date}</TableCell>
                    <TableCell>{money(Number(o.amount))}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(status)} className="capitalize">{status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Stepper currentIndex={idx} cancelled={isCancelled} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!isCancelled && next && (
                          <Button size="sm" variant="outline" onClick={() => setStatus(o.id, next.key)}>
                            <next.icon className="mr-1 h-3.5 w-3.5" /> {next.label}
                          </Button>
                        )}
                        {!isCancelled && status !== "completed" && (
                          <Button size="sm" variant="ghost" onClick={() => setStatus(o.id, "cancelled")}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <RowDelete table="invoices" id={o.id} invalidateKeys={[["orders"], ["invoices"]]} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No orders yet. Place one from the Store.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stepper({ currentIndex, cancelled }: { currentIndex: number; cancelled: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => {
        const reached = !cancelled && i <= currentIndex;
        const Icon = s.icon;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div
              title={s.label}
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] transition ${
                cancelled
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : reached
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-5 ${!cancelled && i < currentIndex ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
