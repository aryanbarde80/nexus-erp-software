import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Boxes, Sparkles, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/nexus/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex gap-2">
          <Link to="/login">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link to="/signup">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-16 pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" /> One workspace for the whole business
          </span>
          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Run every part of your business with{" "}
            <span className="bg-gradient-to-r from-primary to-chart-5 bg-clip-text text-transparent">
              Nexus ERP
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Sales, inventory, finance, and HR — unified in a single, beautifully calm
            workspace. Spin up your operations in minutes, not months.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="shadow-lift">
                Start free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline">Sign in</Button>
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {[
            { icon: BarChart3, title: "Sales & CRM", body: "Track leads, customers, and invoices in real time." },
            { icon: Boxes, title: "Inventory", body: "Product catalog, stock levels, low-stock alerts." },
            { icon: ShieldCheck, title: "Finance & HR", body: "Invoices, expenses, payroll roster — secure by default." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border/60 bg-card p-6 shadow-soft">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
