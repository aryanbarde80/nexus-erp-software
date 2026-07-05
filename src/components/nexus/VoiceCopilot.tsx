import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Mic, Square, Loader2, Sparkles, Send, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { parseVoiceCommand, executeCommand } from "@/lib/copilot.functions";
import { askAssistant } from "@/lib/assistant.functions";

type Parsed = {
  transcript: string;
  intent: string;
  confidence: number;
  params: Record<string, any>;
  confirmation: string;
};

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(blob);
  });
}

function pickAudioMime(): { mime: string; format: string } {
  const MR: any = (typeof window !== "undefined") ? (window as any).MediaRecorder : null;
  if (MR && MR.isTypeSupported?.("audio/webm")) return { mime: "audio/webm", format: "webm" };
  if (MR && MR.isTypeSupported?.("audio/mp4")) return { mime: "audio/mp4", format: "m4a" };
  return { mime: "", format: "webm" };
}

export function VoiceCopilot() {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const navigate = useNavigate();

  const parseFn = useServerFn(parseVoiceCommand);
  const execFn = useServerFn(executeCommand);
  const askFn = useServerFn(askAssistant);

  const reset = () => { setParsed(null); setAnswer(null); setTextInput(""); };

  const startRec = async () => {
    reset();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { mime, format } = pickAudioMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        setBusy(true);
        try {
          const dataUrl = await blobToDataUrl(blob);
          const p = await parseFn({ data: { audio: dataUrl, audio_format: format } });
          setParsed(p as Parsed);
        } catch (e: any) {
          toast.error(e.message ?? "Voice parse failed");
        } finally { setBusy(false); }
      };
      recRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e: any) {
      toast.error("Microphone permission required");
    }
  };

  const stopRec = () => {
    recRef.current?.stop();
    setRecording(false);
  };

  const sendText = async () => {
    if (!textInput.trim()) return;
    setBusy(true); reset();
    try {
      const p = await parseFn({ data: { text: textInput } });
      setParsed(p as Parsed);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      if (parsed.intent === "navigate" && parsed.params?.route) {
        navigate({ to: parsed.params.route as any });
        toast.success(`Navigated to ${parsed.params.route}`);
        setOpen(false); reset();
      } else if (parsed.intent === "query") {
        const q = parsed.params?.question ?? parsed.transcript;
        const res: any = await askFn({ data: { question: q } });
        setAnswer(res.answer ?? "No response.");
      } else if (parsed.intent === "unknown") {
        toast.error("Couldn't understand — try again");
      } else {
        const res: any = await execFn({
          data: { intent: parsed.intent, params: parsed.params, transcript: parsed.transcript },
        });
        toast.success(res.message ?? "Done");
        setOpen(false); reset();
      }
    } catch (e: any) {
      toast.error(e.message ?? "Execution failed");
    } finally { setBusy(false); }
  };

  return (
    <>
      <Button
        variant="outline" size="icon"
        className="relative h-9 w-9"
        onClick={() => setOpen(true)}
        aria-label="Voice copilot"
      >
        <Mic className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { reset(); if (recording) stopRec(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Voice Copilot
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3 rounded-lg border border-dashed border-border/60 bg-muted/20 p-6">
              {recording ? (
                <Button size="lg" variant="destructive" onClick={stopRec}>
                  <Square className="mr-2 h-4 w-4" /> Stop
                </Button>
              ) : (
                <Button size="lg" onClick={startRec} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mic className="mr-2 h-4 w-4" />}
                  {busy ? "Thinking…" : "Hold to talk"}
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Textarea
                placeholder='Or type: "add expense $42 for Uber today"'
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="min-h-[60px] text-sm"
              />
              <Button variant="outline" size="icon" disabled={!textInput.trim() || busy} onClick={sendText}>
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {parsed && (
              <div className="space-y-2 rounded-lg border border-border/60 p-3 text-sm">
                {parsed.transcript && (
                  <div className="text-muted-foreground italic">"{parsed.transcript}"</div>
                )}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{parsed.intent}</Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {(Number(parsed.confidence) * 100).toFixed(0)}% confidence
                  </Badge>
                </div>
                <p>{parsed.confirmation}</p>
                {Object.keys(parsed.params ?? {}).length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Details</summary>
                    <pre className="mt-1 overflow-auto rounded bg-muted p-2">
                      {JSON.stringify(parsed.params, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {answer && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm whitespace-pre-wrap">
                {answer}
              </div>
            )}
          </div>

          {parsed && !answer && (
            <DialogFooter>
              <Button variant="ghost" onClick={() => reset()} disabled={busy}>
                <X className="mr-2 h-4 w-4" /> Discard
              </Button>
              <Button onClick={confirm} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Confirm & run
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
