import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Megaphone, Pin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/announcements")({ component: Announcements });

function Announcements() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [pinned, setPinned] = useState(false);

  const add = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("announcements").insert({
      user_id: user.id, title, body: body || null, audience, pinned,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Announcement posted");
    setTitle(""); setBody(""); setAudience("all"); setPinned(false);
    qc.invalidateQueries({ queryKey: ["announcements"] });
  };

  const togglePin = async (id: string, p: boolean) => {
    await supabase.from("announcements").update({ pinned: !p }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["announcements"] });
  };

  return (
    <div>
      <PageHeader title="Announcements" subtitle="Share company-wide updates with your team." />
      <div className="mb-4 flex justify-end">
        <CreateDialog title="New announcement" triggerLabel="Post announcement" busy={busy} onSubmit={add}>
          <Field label="Title"><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Body"><Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Audience">
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  <SelectItem value="management">Management</SelectItem>
                  <SelectItem value="engineering">Engineering</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Pin to top">
              <div className="flex h-10 items-center"><Switch checked={pinned} onCheckedChange={setPinned} /></div>
            </Field>
          </div>
        </CreateDialog>
      </div>

      <div className="grid gap-4">
        {q.data?.length ? q.data.map((a: any) => (
          <Card key={a.id} className={`border-border/60 shadow-soft ${a.pinned ? "ring-1 ring-primary/40" : ""}`}>
            <CardContent className="p-5">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">{a.title}</h3>
                  {a.pinned && <Badge variant="default" className="gap-1"><Pin className="h-3 w-3" />Pinned</Badge>}
                  <Badge variant="secondary">{a.audience}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => togglePin(a.id, a.pinned)}>
                    <Pin className="h-3.5 w-3.5" />
                  </Button>
                  <RowDelete table="announcements" id={a.id} invalidateKeys={[["announcements"]]} />
                </div>
              </div>
              {a.body && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>}
              <p className="mt-3 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
            </CardContent>
          </Card>
        )) : (
          <Card className="border-border/60 shadow-soft">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">No announcements yet.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
