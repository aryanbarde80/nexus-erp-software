import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/nexus/PageHeader";
import { CreateDialog } from "@/components/nexus/CreateDialog";
import { RowDelete } from "@/components/nexus/RowDelete";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MapPin, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calendar")({ component: CalendarPage });

function CalendarPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const meetingsQ = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meetings").select("*").order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");
  const [attendees, setAttendees] = useState("");

  const addMeeting = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("meetings").insert({
      user_id: user.id,
      title,
      description: desc || null,
      start_time: new Date(start).toISOString(),
      end_time: end ? new Date(end).toISOString() : null,
      location: location || null,
      attendees: attendees || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Meeting scheduled");
    setTitle(""); setDesc(""); setStart(""); setEnd(""); setLocation(""); setAttendees("");
    qc.invalidateQueries({ queryKey: ["meetings"] });
  };

  const days = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const startWeekday = first.getDay();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const cells: { date: Date | null }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null });
    for (let d = 1; d <= lastDay; d++) cells.push({ date: new Date(y, m, d) });
    return cells;
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    (meetingsQ.data ?? []).forEach((m) => {
      const k = new Date(m.start_time).toDateString();
      (map[k] = map[k] ?? []).push(m);
    });
    return map;
  }, [meetingsQ.data]);

  const upcoming = (meetingsQ.data ?? [])
    .filter((m) => new Date(m.start_time) >= new Date(Date.now() - 86400000))
    .slice(0, 8);

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Schedule meetings and track events." />
      <div className="mb-3 flex justify-end">
        <CreateDialog title="New meeting" triggerLabel="Schedule meeting" busy={busy} onSubmit={addMeeting}>
          <Field label="Title"><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start"><Input type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="End"><Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
          <Field label="Location"><Input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
          <Field label="Attendees (comma separated)"><Input value={attendees} onChange={(e) => setAttendees(e.target.value)} /></Field>
          <Field label="Description"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        </CreateDialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="border-border/60 shadow-soft">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{monthLabel}</h2>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</Button>
                <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((cell, i) => {
                const today = cell.date?.toDateString() === new Date().toDateString();
                const evts = cell.date ? eventsByDay[cell.date.toDateString()] ?? [] : [];
                return (
                  <div key={i} className={`min-h-24 rounded-md border p-1.5 text-left ${cell.date ? "bg-card" : "bg-muted/30"} ${today ? "border-primary" : "border-border/60"}`}>
                    {cell.date && (
                      <>
                        <div className={`text-xs font-medium ${today ? "text-primary" : "text-muted-foreground"}`}>{cell.date.getDate()}</div>
                        <div className="mt-1 space-y-1">
                          {evts.slice(0, 2).map((e: any) => (
                            <div key={e.id} className="truncate rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{e.title}</div>
                          ))}
                          {evts.length > 2 && <div className="text-[10px] text-muted-foreground">+{evts.length - 2} more</div>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-soft">
          <CardContent className="p-5">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Upcoming</h3>
            <div className="mt-3 space-y-3">
              {upcoming.length ? upcoming.map((m) => (
                <div key={m.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium">{m.title}</div>
                    <RowDelete table="meetings" id={m.id} invalidateKeys={[["meetings"]]} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(m.start_time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                  {m.location && <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {m.location}</div>}
                  {m.attendees && <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" /> {m.attendees}</div>}
                  {m.description && <div className="mt-2 text-xs">{m.description}</div>}
                </div>
              )) : <div className="text-sm text-muted-foreground">No upcoming meetings.</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
