import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, AlertTriangle, PackageX, CalendarOff, LifeBuoy, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type Alert = {
  id: string;
  icon: any;
  title: string;
  description: string;
  to: string;
  tone: "warning" | "danger" | "info";
};

export function NotificationsBell() {
  const q = useQuery({
    queryKey: ["notifications"],
    refetchInterval: 60000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [invoices, products, leaves, tickets] = await Promise.all([
        supabase.from("invoices").select("id, invoice_number, due_date, amount, status").neq("status", "paid"),
        supabase.from("products").select("id, name, stock, low_stock_threshold"),
        supabase.from("leave_requests").select("id, leave_type, start_date, status").eq("status", "pending"),
        supabase.from("tickets").select("id, subject, status, priority").in("status", ["open", "in_progress"]),
      ]);

      const alerts: Alert[] = [];

      (invoices.data ?? []).forEach((inv: any) => {
        if (inv.due_date && inv.due_date < today) {
          alerts.push({
            id: `inv-${inv.id}`,
            icon: AlertTriangle,
            title: `Overdue invoice ${inv.invoice_number}`,
            description: `Due ${inv.due_date} • $${Number(inv.amount).toFixed(2)}`,
            to: "/sales",
            tone: "danger",
          });
        }
      });

      (products.data ?? []).forEach((p: any) => {
        if (Number(p.stock) <= Number(p.low_stock_threshold)) {
          alerts.push({
            id: `prod-${p.id}`,
            icon: PackageX,
            title: `Low stock: ${p.name}`,
            description: `${p.stock} left (threshold ${p.low_stock_threshold})`,
            to: "/inventory",
            tone: "warning",
          });
        }
      });

      (leaves.data ?? []).forEach((l: any) => {
        alerts.push({
          id: `lv-${l.id}`,
          icon: CalendarOff,
          title: `Leave request pending`,
          description: `${l.leave_type} from ${l.start_date}`,
          to: "/leaves",
          tone: "info",
        });
      });

      (tickets.data ?? []).forEach((t: any) => {
        if (t.priority === "high" || t.priority === "urgent") {
          alerts.push({
            id: `tk-${t.id}`,
            icon: LifeBuoy,
            title: `${t.priority === "urgent" ? "Urgent" : "High-priority"} ticket`,
            description: t.subject,
            to: "/tickets",
            tone: t.priority === "urgent" ? "danger" : "warning",
          });
        }
      });

      return alerts;
    },
  });

  const count = q.data?.length ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">{count} active alert{count === 1 ? "" : "s"}</p>
          </div>
          <Badge variant="secondary" className="text-[10px]">Live</Badge>
        </div>
        <ScrollArea className="max-h-[380px]">
          {q.isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : !count ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
              All caught up — no alerts.
            </div>
          ) : (
            <ul className="divide-y">
              {q.data!.map((a) => {
                const Icon = a.icon;
                const toneCls =
                  a.tone === "danger" ? "text-destructive bg-destructive/10"
                  : a.tone === "warning" ? "text-amber-600 bg-amber-500/10"
                  : "text-primary bg-primary/10";
                return (
                  <li key={a.id}>
                    <Link
                      to={a.to as any}
                      className="flex items-start gap-3 px-4 py-3 transition hover:bg-muted/50"
                    >
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${toneCls}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.description}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
