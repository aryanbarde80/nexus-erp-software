import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { User, LogOut, AlarmClock, Settings as Cog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { RemindersDialog } from "./RemindersMenu";

export function UserMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const pendingQ = useQuery({
    queryKey: ["reminders-pending-count"],
    refetchInterval: 60000,
    queryFn: async () => {
      const { count } = await supabase
        .from("reminders").select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
  });

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const initial = (user?.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-9 gap-2 px-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {initial}
          </span>
          {!!pendingQ.data && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {pendingQ.data > 9 ? "9+" : pendingQ.data}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <User className="h-3.5 w-3.5" />
          <span className="truncate text-xs">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <RemindersDialog
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <AlarmClock className="mr-2 h-4 w-4" /> Reminders
              {!!pendingQ.data && <Badge variant="secondary" className="ml-auto">{pendingQ.data}</Badge>}
            </DropdownMenuItem>
          }
        />
        <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
          <Cog className="mr-2 h-4 w-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
