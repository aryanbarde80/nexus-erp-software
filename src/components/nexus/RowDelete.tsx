import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function RowDelete({
  table,
  id,
  invalidateKeys,
}: {
  table: "customers" | "invoices" | "products" | "expenses" | "employees" | "projects" | "tasks" | "suppliers" | "purchase_orders" | "quotes" | "payments" | "leave_requests" | "stock_movements" | "meetings" | "activity_log" | "assets" | "tickets" | "contracts" | "announcements" | "departments";
  id: string;
  invalidateKeys: string[][];
}) {
  const qc = useQueryClient();
  const onDelete = async () => {
    if (!confirm("Delete this record? This cannot be undone.")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
  };
  return (
    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDelete}>
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
