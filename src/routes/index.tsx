import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import {
  ArrowRight, BarChart3, Boxes, Sparkles, ShieldCheck, Users, Wallet,
  ShoppingCart, Briefcase, CalendarCheck, MessageSquare, Check,
  Star, Globe, Zap, Lock,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/nexus/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Nexus ERP — One platform to run your entire business" },
      {
        name: "description",
        content:
          "Sales, inventory, finance, HR, projects and storefront — unified in a single, beautifully calm workspace. Start free.",
      },
    ],
  }),
});

function Landing() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition hover:text-foreground">Features</a>
            <a href="#modules" className="transition hover:text-foreground">Modules</a>
            <a href="#pricing" className="transition hover:text-foreground">Pricing</a>
            <a href="#testimonials" className="transition hover:text-foreground">Customers</a>
            <a href="#faq" className="transition hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/signup"><Button size="sm">Get started</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pt-20 pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" /> v2.4 — Storefront & invoicing now live
          </span>
          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            Run every part of your business with{" "}
            <span className="bg-gradient-to-r from-primary to-chart-5 bg-clip-text text-transparent">
              Nexus ERP
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground md:text-xl">
            Sales, inventory, finance, HR, projects and a built-in storefront — unified in a
            single, beautifully calm workspace. Spin up your operations in minutes, not months.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="shadow-lift">
                Start free — no card needed <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login"><Button size="lg" variant="outline">Sign in</Button></Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-success" /> 14-day Pro trial</span>
            <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-success" /> Unlimited users</span>
            <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-success" /> Cancel anytime</span>
          </div>
        </div>

        {/* Hero visual */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="absolute -inset-x-10 -top-10 -bottom-10 -z-10 bg-gradient-to-tr from-primary/15 via-chart-5/10 to-transparent blur-3xl" />
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
            <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
              <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-warning/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-success/70" />
              <span className="ml-3 text-xs text-muted-foreground">app.nexus-erp.com/dashboard</span>
            </div>
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
              {[
                { l: "Revenue", v: "$248,930", c: "text-success" },
                { l: "Outstanding", v: "$32,140", c: "text-warning" },
                { l: "Customers", v: "1,284", c: "text-primary" },
                { l: "Low stock", v: "6", c: "text-destructive" },
              ].map((s) => (
                <div key={s.l} className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">{s.l}</p>
                  <p className={`mt-1 font-display text-2xl font-semibold ${s.c}`}>{s.v}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 px-5 pb-5 md:grid-cols-3">
              <div className="rounded-xl border border-border/60 p-4 md:col-span-2">
                <p className="mb-3 text-xs font-medium text-muted-foreground">Revenue vs Expenses</p>
                <div className="flex h-32 items-end gap-1.5">
                  {[40, 55, 48, 70, 62, 85, 78, 92, 88, 110, 96, 124].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary/30 to-primary" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border/60 p-4">
                <p className="mb-3 text-xs font-medium text-muted-foreground">Recent orders</p>
                {["Acme · $2,450", "Globex · $5,800", "Wayne · $1,290", "Stark · $9,750"].map((o, i) => (
                  <div key={i} className="flex justify-between border-b border-border/40 py-1.5 text-xs last:border-0">
                    <span>{o.split(" · ")[0]}</span>
                    <span className="font-medium">{o.split(" · ")[1]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Logo strip */}
        <div className="mt-20">
          <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Trusted by 3,200+ growing businesses worldwide
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-10 opacity-60">
            {["ACME", "GLOBEX", "INITECH", "UMBRELLA", "WAYNE", "STARK"].map((n) => (
              <span key={n} className="font-display text-xl font-semibold tracking-widest text-muted-foreground">{n}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-border/40 bg-muted/30 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="mb-4">Why Nexus</Badge>
            <h2 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
              One workspace. Every department.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Stop wiring 12 SaaS tools together. Nexus replaces your spreadsheets, point
              solutions, and disconnected dashboards with one calm, real-time system of record.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {[
              { icon: Zap, title: "Real-time everywhere", body: "Orders, stock, payments and pipelines update across modules the moment they happen." },
              { icon: Lock, title: "Secure by default", body: "Row-level security, encrypted backups, SOC-2-ready audit logs and SSO included." },
              { icon: Globe, title: "Built for global teams", body: "Multi-currency invoicing, localised tax, and 30+ language UI in one switch." },
              { icon: Sparkles, title: "Beautifully calm UI", body: "Designed for daily use. No clutter, no ten-tab juggling — just the work." },
              { icon: BarChart3, title: "Live dashboards", body: "KPIs, P&L, cashflow and inventory health visualised the moment data lands." },
              { icon: ShieldCheck, title: "Compliance ready", body: "Audit trail on every record, role-based access, and GDPR data tools out of the box." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-border/60 bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">Modules</Badge>
          <h2 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Everything you need, day one.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Twenty integrated modules built around one shared database — no integrations to maintain.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: BarChart3, title: "Sales & CRM", body: "Leads, customers, pipeline, quotes." },
            { icon: Wallet, title: "Finance", body: "Invoices, expenses, payments, P&L." },
            { icon: Boxes, title: "Inventory", body: "SKUs, stock, low-stock alerts." },
            { icon: ShoppingCart, title: "Storefront", body: "Sell with cart, checkout, invoicing." },
            { icon: Users, title: "HR & People", body: "Employees, leave, departments." },
            { icon: Briefcase, title: "Projects", body: "Tasks, milestones, budgets." },
            { icon: CalendarCheck, title: "Calendar", body: "Meetings, deadlines, schedules." },
            { icon: MessageSquare, title: "Support", body: "Tickets, SLAs, customer chat." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border/60 bg-card p-5">
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="border-y border-border/40 bg-muted/30 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="mb-4">Customers</Badge>
            <h2 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
              Loved by operators who hate busywork.
            </h2>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {[
              { q: "We replaced 7 SaaS tools with Nexus in a month. The team actually enjoys closing the books now.", n: "Priya Shah", r: "COO, Lumen Goods" },
              { q: "Sales pipeline, invoicing and stock in one view — our reps stopped flipping tabs and revenue went up 22%.", n: "Marcus Liu", r: "Head of Sales, Trove" },
              { q: "Onboarding 40 staff took an afternoon. The HR module is the cleanest I've ever used.", n: "Hannah Reyes", r: "People Lead, Sundial" },
            ].map((t) => (
              <div key={t.n} className="rounded-2xl border border-border/60 bg-card p-6 shadow-soft">
                <div className="mb-3 flex gap-0.5 text-warning">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                </div>
                <p className="text-sm leading-relaxed">"{t.q}"</p>
                <div className="mt-4 flex items-center gap-3 border-t border-border/60 pt-4">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-chart-5 text-sm font-semibold text-primary-foreground">
                    {t.n.split(" ").map((p) => p[0]).join("")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.n}</p>
                    <p className="text-xs text-muted-foreground">{t.r}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { v: "3,200+", l: "Businesses" },
              { v: "$1.4B", l: "Processed" },
              { v: "99.99%", l: "Uptime" },
              { v: "4.9 / 5", l: "Avg rating" },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <p className="font-display text-4xl font-semibold">{s.v}</p>
                <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">Pricing</Badge>
          <h2 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Simple, fair pricing.
          </h2>
          <p className="mt-4 text-muted-foreground">No per-seat tax. No usage cliffs. Cancel anytime.</p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            { name: "Starter", price: "$0", tag: "for trying things out", features: ["Up to 3 users", "All modules", "1,000 records", "Email support"], cta: "Start free" },
            { name: "Growth", price: "$49", tag: "/ user / month — most popular", features: ["Unlimited records", "Custom roles", "API access", "Priority support"], cta: "Start trial", featured: true },
            { name: "Scale", price: "Custom", tag: "for larger teams", features: ["SSO + SAML", "Dedicated CSM", "SLA & onboarding", "Data residency"], cta: "Talk to sales" },
          ].map((p) => (
            <div key={p.name} className={`relative rounded-2xl border p-6 ${p.featured ? "border-primary bg-gradient-to-b from-primary/5 to-transparent shadow-lift" : "border-border/60 bg-card shadow-soft"}`}>
              {p.featured && <Badge className="absolute -top-3 left-6">Most popular</Badge>}
              <h3 className="font-display text-xl font-semibold">{p.name}</h3>
              <p className="mt-4 font-display text-4xl font-semibold">{p.price}</p>
              <p className="text-xs text-muted-foreground">{p.tag}</p>
              <ul className="my-6 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />{f}</li>
                ))}
              </ul>
              <Link to="/signup"><Button className="w-full" variant={p.featured ? "default" : "outline"}>{p.cta}</Button></Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border/40 bg-muted/30 py-24">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center">
            <Badge variant="outline" className="mb-4">FAQ</Badge>
            <h2 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">Questions, answered.</h2>
          </div>
          <div className="mt-12 space-y-3">
            {[
              { q: "Do I need to install anything?", a: "No. Nexus is fully cloud-hosted. Sign up, sign in and you're operating in under a minute." },
              { q: "Can I import my existing data?", a: "Yes. Import customers, products, invoices and employees from CSV, QuickBooks, HubSpot, Shopify and more." },
              { q: "Is my data secure?", a: "We use row-level security, encrypted backups, audit logs and SSO. Your data stays in your region." },
              { q: "Can I cancel anytime?", a: "Yes — there are no long-term contracts on Starter or Growth. Export all your data with one click." },
              { q: "Do you offer a free trial?", a: "Every paid plan ships with a 14-day Pro trial. No card needed to start." },
            ].map((f) => (
              <details key={f.q} className="group rounded-xl border border-border/60 bg-card p-5">
                <summary className="flex cursor-pointer items-center justify-between font-medium">
                  {f.q}
                  <span className="ml-4 text-muted-foreground transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary to-chart-5 px-8 py-16 text-center text-primary-foreground shadow-lift">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          <div className="relative">
            <h2 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
              Ready to run your business in one place?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
              Join thousands of teams using Nexus to ship faster, sell more, and sleep better.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/signup">
                <Button size="lg" variant="secondary" className="shadow-lift">
                  Start free <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="border-white/30 bg-white/10 text-primary-foreground hover:bg-white/20">
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/40">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid gap-10 md:grid-cols-5">
            <div className="md:col-span-2">
              <Logo />
              <p className="mt-3 max-w-xs text-sm text-muted-foreground">
                The all-in-one operating system for modern businesses. Built with calm, designed for scale.
              </p>
            </div>
            {[
              { h: "Product", l: ["Features", "Modules", "Pricing", "Changelog"] },
              { h: "Company", l: ["About", "Customers", "Careers", "Contact"] },
              { h: "Legal", l: ["Privacy", "Terms", "Security", "DPA"] },
            ].map((col) => (
              <div key={col.h}>
                <p className="text-sm font-semibold">{col.h}</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {col.l.map((x) => <li key={x}><a href="#" className="hover:text-foreground">{x}</a></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/40 pt-6 text-xs text-muted-foreground md:flex-row">
            <p>© {new Date().getFullYear()} Nexus ERP, Inc. All rights reserved.</p>
            <p>Made with care · v2.4.0</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
