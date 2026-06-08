import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Copy, Check, ThumbsUp, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { draftTicketReply } from "@/lib/ml.functions";

type Ticket = {
  id: string;
  subject: string;
  description?: string | null;
  customer_id?: string | null;
  customers?: { name?: string | null } | null;
};

export function SmartReplyButton({ ticket }: { ticket: Ticket }) {
  const { user } = useAuth();
  const draft = useServerFn(draftTicketReply);
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<"empathetic" | "professional" | "concise">("empathetic");
  const [reply, setReply] = useState("");
  const [meta, setMeta] = useState<any>({});
  const [copied, setCopied] = useState(false);
  const [rated, setRated] = useState<"up" | "down" | null>(null);

  const m = useMutation({
    mutationFn: () => draft({ data: {
      subject: ticket.subject,
      description: ticket.description ?? "",
      customer: ticket.customers?.name ?? "",
      customer_id: ticket.customer_id ?? null,
      tone,
    } }),
    onSuccess: (data) => {
      setReply(data.reply);
      setMeta(data);
      if (data.learned_tone && !rated) setTone(data.learned_tone as any);
      setRated(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Draft failed"),
  });

  const copy = async () => {
    await navigator.clipboard.writeText(reply);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Reply copied");
  };

  const rate = async (rating: "up" | "down") => {
    if (!user || !reply) return;
    setRated(rating);
    const { error } = await supabase.from("smart_reply_feedback").insert({
      user_id: user.id,
      ticket_id: ticket.id,
      customer_id: ticket.customer_id ?? null,
      tone,
      rating,
      reply_text: reply,
    });
    if (error) { toast.error(error.message); setRated(null); return; }
    toast.success(rating === "up"
      ? `Saved — AI will favor "${tone}" tone for similar replies`
      : `Noted — AI will avoid this style next time`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o && !reply) m.mutate(); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI smart reply
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{ticket.subject}</span>
            {meta.sentiment && (
              <Badge variant={meta.sentiment === "frustrated" || meta.sentiment === "negative" ? "destructive" : "secondary"}>
                sentiment: {meta.sentiment}
              </Badge>
            )}
            {meta.suggested_priority && <Badge variant="outline">→ {meta.suggested_priority}</Badge>}
            {meta.learned_tone && (
              <Badge variant="outline" className="border-primary/40 text-primary">
                learned: {meta.learned_tone}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Tone</span>
            <Select value={tone} onValueChange={(v) => setTone(v as any)}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="empathetic">Empathetic</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="concise">Concise</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => m.mutate()} disabled={m.isPending}>
              <Sparkles className="mr-1 h-3 w-3" /> {m.isPending ? "Drafting…" : "Regenerate"}
            </Button>
          </div>
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={m.isPending ? "Drafting reply…" : "AI draft will appear here…"}
            rows={10}
            className="font-mono text-sm"
          />
          {reply && (
            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Was this draft helpful?</span>
              <div className="flex gap-1">
                <Button
                  size="sm" variant={rated === "up" ? "default" : "ghost"}
                  className="h-7 px-2" onClick={() => rate("up")} disabled={!!rated}
                >
                  <ThumbsUp className="mr-1 h-3.5 w-3.5" /> Good
                </Button>
                <Button
                  size="sm" variant={rated === "down" ? "destructive" : "ghost"}
                  className="h-7 px-2" onClick={() => rate("down")} disabled={!!rated}
                >
                  <ThumbsDown className="mr-1 h-3.5 w-3.5" /> Off
                </Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          <Button onClick={copy} disabled={!reply}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copied" : "Copy reply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
