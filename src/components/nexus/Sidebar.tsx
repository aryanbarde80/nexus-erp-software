import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Package,
  Wallet,
  UserCog,
  LogOut,
  Briefcase,
  Truck,
  BarChart3,
  Settings,
  FileText,
  CreditCard,
  Calendar,
  CalendarOff,
  Boxes,
  HardDrive,
  LifeBuoy,
  FileSignature,
  Megaphone,
  Building2,
} from "lucide-react";
import { Logo } from "./Logo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sales", label: "Sales & CRM", icon: Users },
  { to: "/quotes", label: "Quotes", icon: FileText },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/contracts", label: "Contracts", icon: FileSignature },
  { to: "/tickets", label: "Support tickets", icon: LifeBuoy },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/stock", label: "Stock movements", icon: Boxes },
  { to: "/assets", label: "Assets", icon: HardDrive },
  { to: "/suppliers", label: "Suppliers & PO", icon: Truck },
  { to: "/projects", label: "Projects", icon: Briefcase },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/finance", label: "Finance", icon: Wallet },
  { to: "/hr", label: "HR", icon: UserCog },
  { to: "/departments", label: "Departments", icon: Building2 },
  { to: "/leaves", label: "Leave requests", icon: CalendarOff },
  { to: "/announcements", label: "Announcements", icon: Megaphone },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar({ email }: { email?: string | null }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="px-6 py-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 text-xs text-muted-foreground">
          Signed in as
          <div className="truncate font-medium text-foreground">{email}</div>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
          <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
        </Button>
      </div>
    </aside>
  );
}
