import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, Users, Package, Wallet, UserCog, Briefcase, Truck, BarChart3, Settings, FileText,
  CreditCard, Calendar, CalendarOff, Boxes, HardDrive, LifeBuoy, FileSignature, Megaphone, Building2,
  ShoppingCart, Sparkles, KanbanSquare, Bot, Activity, Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { seedDemoData } from "@/lib/seed-demo";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assistant", label: "AI Assistant", icon: Bot },
  { to: "/activity", label: "Activity feed", icon: Activity },
  { to: "/sales", label: "Sales & CRM", icon: Users },
  { to: "/store", label: "Store", icon: ShoppingCart },
  { to: "/orders", label: "Orders", icon: Package },
  { to: "/quotes", label: "Quotes", icon: FileText },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/contracts", label: "Contracts", icon: FileSignature },
  { to: "/tickets", label: "Support tickets", icon: LifeBuoy },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/stock", label: "Stock movements", icon: Boxes },
  { to: "/assets", label: "Assets", icon: HardDrive },
  { to: "/suppliers", label: "Suppliers & PO", icon: Truck },
  { to: "/projects", label: "Projects", icon: Briefcase },
  { to: "/kanban", label: "Task Kanban", icon: KanbanSquare },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/finance", label: "Finance", icon: Wallet },
  { to: "/hr", label: "HR", icon: UserCog },
  { to: "/departments", label: "Departments", icon: Building2 },
  { to: "/leaves", label: "Leave requests", icon: CalendarOff },
  { to: "/announcements", label: "Announcements", icon: Megaphone },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function CommandPaletteButton() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => { setOpen(false); navigate({ to: to as any }); };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9 w-full max-w-xs justify-between gap-2 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <span className="text-sm">Search or jump to…</span>
        <kbd className="pointer-events-none rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigate">
            {NAV.map((n) => (
              <CommandItem key={n.to} value={n.label} onSelect={() => go(n.to)}>
                <n.icon className="mr-2 h-4 w-4" />
                {n.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Quick actions">
            <CommandItem
              value="seed demo data"
              onSelect={async () => {
                if (!user) return;
                setOpen(false);
                const t = toast.loading("Seeding demo data…");
                try {
                  await seedDemoData(user.id);
                  toast.success("Demo data loaded", { id: t });
                } catch (e: any) {
                  toast.error(e.message ?? "Seed failed", { id: t });
                }
              }}
            >
              <Sparkles className="mr-2 h-4 w-4" /> Load demo data
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
