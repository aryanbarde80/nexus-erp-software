import { Hexagon } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-chart-5 text-primary-foreground shadow-soft">
        <Hexagon className="h-4 w-4" strokeWidth={2.5} />
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-display text-base font-semibold tracking-tight">Nexus</span>
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          ERP
        </span>
      </div>
    </div>
  );
}
