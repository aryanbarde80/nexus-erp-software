import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Send, Sparkles, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/nexus/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askAssistant } from "@/lib/assistant.functions";

export const Route = createFileRoute("/_authenticated/assistant")({
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What's my total revenue and unpaid invoice amount?",
  "Which products are below their low-stock threshold?",
  "Summarize this month's expenses by category.",
  "List high-priority tasks that aren't done yet.",
];

function AssistantPage() {
  const ask = useServerFn(askAssistant);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Hi! I'm Nexus AI. Ask me about your sales, inventory, expenses, tasks, or anything in your ERP.",
    },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const m = useMutation({
    mutationFn: (q: string) => ask({ data: { question: q } }),
    onSuccess: (data) => setMessages((p) => [...p, { role: "assistant", content: data.answer }]),
    onError: (e: any) => toast.error(e.message ?? "Failed to get a response"),
  });

  const submit = (q: string) => {
    if (!q.trim() || m.isPending) return;
    setMessages((p) => [...p, { role: "user", content: q.trim() }]);
    setInput("");
    m.mutate(q.trim());
  };

  return (
    <div>
      <PageHeader
        title="Nexus AI Assistant"
        subtitle="Ask questions about your live ERP data — powered by Lovable AI."
      />

      <Card className="border-border/60 shadow-soft">
        <CardContent className="flex h-[calc(100vh-280px)] min-h-[500px] flex-col p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
                }`}>
                  {msg.role === "user" ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-foreground"
                }`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {m.isPending && (
              <div className="flex gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">
                  <span className="inline-flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:120ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:240ms]" />
                  </span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {messages.length <= 1 && (
            <div className="border-t px-6 py-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3 w-3" /> Try asking
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <Button key={s} variant="outline" size="sm" className="h-7 text-xs" onClick={() => submit(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t p-4">
            <form
              onSubmit={(e) => { e.preventDefault(); submit(input); }}
              className="flex items-end gap-2"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(input); }
                }}
                placeholder="Ask about revenue, inventory, tasks, customers…"
                className="min-h-[44px] resize-none"
                rows={1}
              />
              <Button type="submit" disabled={m.isPending || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
