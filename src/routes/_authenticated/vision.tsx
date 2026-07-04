import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Upload, Receipt, Package, HardDrive, StickyNote, Contact, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/nexus/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  scanReceipt, saveScannedExpense,
  identifyProduct, inspectAsset,
  whiteboardToTasks, createTasksFromScan,
  scanBusinessCard, saveScannedLead,
} from "@/lib/vision.functions";

export const Route = createFileRoute("/_authenticated/vision")({ component: VisionPage });

const MAX_MB = 6;

async function fileToDataUrl(file: File): Promise<string> {
  if (file.size > MAX_MB * 1024 * 1024) throw new Error(`Image too large (max ${MAX_MB}MB)`);
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
}

function ImageDrop({ image, onImage, hint }: { image: string | null; onImage: (s: string | null) => void; hint: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const handleFile = async (f?: File | null) => {
    if (!f) return;
    try { onImage(await fileToDataUrl(f)); }
    catch (e: any) { toast.error(e.message); }
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]); }}
      className={`relative flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 transition ${
        drag ? "border-primary bg-primary/5" : "border-border/60 bg-muted/20"
      }`}
    >
      {image ? (
        <>
          <img src={image} alt="preview" className="max-h-64 rounded-lg object-contain" />
          <Button size="sm" variant="ghost" onClick={() => onImage(null)}>Remove</Button>
        </>
      ) : (
        <>
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-sm font-medium">Drop an image or</div>
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            Choose file
          </Button>
          <p className="text-xs text-muted-foreground">{hint} · JPG/PNG · max {MAX_MB}MB</p>
        </>
      )}
      <input
        ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

// ---------- Receipt ----------
function ReceiptTab() {
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const scan = useServerFn(scanReceipt);
  const save = useServerFn(saveScannedExpense);

  const run = async () => {
    if (!image) return;
    setBusy(true); setResult(null);
    try { setResult(await scan({ data: { image } })); }
    catch (e: any) { toast.error(e.message ?? "Scan failed"); }
    finally { setBusy(false); }
  };
  const persist = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await save({ data: {
        vendor: result.vendor, amount: Number(result.total) || 0,
        category: result.category, date: result.date,
        description: result.description,
      }});
      toast.success("Expense created");
      setResult(null); setImage(null);
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Upload receipt</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <ImageDrop image={image} onImage={setImage} hint="Snap a receipt or invoice" />
          <Button className="w-full" disabled={!image || busy} onClick={run}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Extract data
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Extracted</CardTitle>
          {result?.confidence != null && (
            <Badge variant="outline">confidence {(Number(result.confidence) * 100).toFixed(0)}%</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {!result && <p className="text-sm text-muted-foreground">Fields appear here after scanning.</p>}
          {result && (
            <div className="space-y-2 text-sm">
              <Field label="Vendor" value={result.vendor} onChange={(v) => setResult({ ...result, vendor: v })} />
              <Field label="Total" value={String(result.total ?? "")} onChange={(v) => setResult({ ...result, total: Number(v) })} />
              <Field label="Date" value={result.date} onChange={(v) => setResult({ ...result, date: v })} />
              <Field label="Category" value={result.category} onChange={(v) => setResult({ ...result, category: v })} />
              <Field label="Description" value={result.description} onChange={(v) => setResult({ ...result, description: v })} />
              {result.warnings?.length > 0 && (
                <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-600">
                  {result.warnings.join(" · ")}
                </div>
              )}
              {result.line_items?.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Line items ({result.line_items.length})</summary>
                  <ul className="mt-1 space-y-1">
                    {result.line_items.map((li: any, i: number) => (
                      <li key={i} className="flex justify-between border-b border-border/40 py-1">
                        <span>{li.qty ? `${li.qty}× ` : ""}{li.name}</span>
                        <span className="font-mono">{li.price}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <Button className="w-full" disabled={saving} onClick={persist}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save as expense
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: any; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-3 items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input className="col-span-2 h-8 text-sm" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// ---------- Product ----------
function ProductTab() {
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<any>(null);
  const identify = useServerFn(identifyProduct);
  const run = async () => {
    if (!image) return; setBusy(true); setR(null);
    try { setR(await identify({ data: { image } })); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Product photo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <ImageDrop image={image} onImage={setImage} hint="Photograph a product" />
          <Button className="w-full" disabled={!image || busy} onClick={run}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Identify + match inventory
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Identification</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!r && <p className="text-muted-foreground">Product details appear here.</p>}
          {r && (
            <>
              <div className="text-lg font-semibold">{r.name ?? "Unknown"}</div>
              <div className="text-muted-foreground">{r.brand} · {r.category}</div>
              <p>{r.description}</p>
              {r.attributes?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {r.attributes.map((a: string, i: number) => <Badge key={i} variant="secondary">{a}</Badge>)}
                </div>
              )}
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Inventory matches</div>
                {r.matches?.length ? (
                  <ul className="space-y-1">
                    {r.matches.map((m: any) => (
                      <li key={m.id} className="flex justify-between rounded border border-border/40 px-2 py-1">
                        <span>{m.name} <span className="text-muted-foreground">· {m.sku}</span></span>
                        <span className="font-mono text-xs">stock {m.stock}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-xs text-muted-foreground">No matches in inventory.</p>}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Asset ----------
function AssetTab() {
  const [image, setImage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<any>(null);
  const inspect = useServerFn(inspectAsset);
  const run = async () => {
    if (!image) return; setBusy(true); setR(null);
    try { setR(await inspect({ data: { image, asset_name: name || null } })); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const color = (c: string) =>
    c === "excellent" || c === "good" ? "text-emerald-500"
    : c === "fair" ? "text-amber-500"
    : "text-red-500";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Asset inspection</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Asset name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <ImageDrop image={image} onImage={setImage} hint="Photograph equipment / property" />
          <Button className="w-full" disabled={!image || busy} onClick={run}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Inspect condition
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Report</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!r && <p className="text-muted-foreground">Condition report appears here.</p>}
          {r && (
            <>
              <div className="flex items-center justify-between">
                <div className={`text-xl font-semibold capitalize ${color(r.condition)}`}>{r.condition}</div>
                <Badge variant={r.urgency === "high" ? "destructive" : "outline"}>urgency {r.urgency}</Badge>
              </div>
              <Progress value={Number(r.score) || 0} />
              <div className="text-xs text-muted-foreground">Score {r.score}/100</div>
              {r.observations?.length > 0 && (
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {r.observations.map((o: string, i: number) => <li key={i}>{o}</li>)}
                </ul>
              )}
              {r.damage?.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Damage findings</div>
                  <ul className="space-y-1">
                    {r.damage.map((d: any, i: number) => (
                      <li key={i} className="rounded border border-border/40 px-2 py-1">
                        <span className="font-medium">{d.area}</span>
                        <Badge className="mx-2" variant="secondary">{d.severity}</Badge>
                        <span className="text-muted-foreground">{d.note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {r.recommended_action && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="text-xs font-medium text-primary">Recommended action</div>
                  <div>{r.recommended_action}</div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Whiteboard ----------
function WhiteboardTab() {
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const extract = useServerFn(whiteboardToTasks);
  const bulk = useServerFn(createTasksFromScan);

  const run = async () => {
    if (!image) return; setBusy(true); setR(null);
    try { setR(await extract({ data: { image } })); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const commit = async () => {
    if (!r?.tasks?.length) return;
    setSaving(true);
    try {
      const res = await bulk({ data: { tasks: r.tasks.map((t: any) => ({
        title: t.title, priority: t.priority ?? "medium", due_hint: t.due_hint ?? null,
      })) }});
      toast.success(`${res.created} tasks created`);
      setR(null); setImage(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Meeting notes / whiteboard</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <ImageDrop image={image} onImage={setImage} hint="Snap a whiteboard or notes" />
          <Button className="w-full" disabled={!image || busy} onClick={run}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Extract action items
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Tasks</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!r && <p className="text-muted-foreground">Action items appear here.</p>}
          {r && (
            <>
              {r.summary && <p className="text-muted-foreground italic">{r.summary}</p>}
              <ul className="space-y-1">
                {(r.tasks ?? []).map((t: any, i: number) => (
                  <li key={i} className="flex items-center justify-between rounded border border-border/40 px-2 py-1">
                    <span>{t.title}</span>
                    <div className="flex gap-1">
                      <Badge variant="outline">{t.priority ?? "medium"}</Badge>
                      {t.due_hint && <Badge variant="secondary">{t.due_hint}</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
              <Button className="w-full" disabled={saving || !r.tasks?.length} onClick={commit}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Create {r.tasks?.length ?? 0} task(s)
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Business card ----------
function CardTab() {
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const scan = useServerFn(scanBusinessCard);
  const save = useServerFn(saveScannedLead);

  const run = async () => {
    if (!image) return; setBusy(true); setR(null);
    try { setR(await scan({ data: { image } })); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const persist = async () => {
    if (!r?.name) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      await save({ data: { name: r.name, company: r.company, email: r.email, phone: r.phone, notes: r.notes }});
      toast.success("Lead added to CRM");
      setR(null); setImage(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Business card</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <ImageDrop image={image} onImage={setImage} hint="Snap a business card" />
          <Button className="w-full" disabled={!image || busy} onClick={run}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Extract contact
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Lead details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!r && <p className="text-muted-foreground">Contact info appears here.</p>}
          {r && (
            <>
              <Field label="Name" value={r.name} onChange={(v) => setR({ ...r, name: v })} />
              <Field label="Company" value={r.company} onChange={(v) => setR({ ...r, company: v })} />
              <Field label="Title" value={r.title} onChange={(v) => setR({ ...r, title: v })} />
              <Field label="Email" value={r.email} onChange={(v) => setR({ ...r, email: v })} />
              <Field label="Phone" value={r.phone} onChange={(v) => setR({ ...r, phone: v })} />
              <Field label="Website" value={r.website} onChange={(v) => setR({ ...r, website: v })} />
              <Button className="w-full" disabled={saving} onClick={persist}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save as lead
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VisionPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vision Intelligence"
        subtitle="Deep-learning computer vision powered by Gemini. Snap it, structure it, ship it."
      />
      <Tabs defaultValue="receipt">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="receipt"><Receipt className="mr-2 h-4 w-4" />Receipt → Expense</TabsTrigger>
          <TabsTrigger value="product"><Package className="mr-2 h-4 w-4" />Product ID</TabsTrigger>
          <TabsTrigger value="asset"><HardDrive className="mr-2 h-4 w-4" />Asset Inspection</TabsTrigger>
          <TabsTrigger value="board"><StickyNote className="mr-2 h-4 w-4" />Whiteboard → Tasks</TabsTrigger>
          <TabsTrigger value="card"><Contact className="mr-2 h-4 w-4" />Business Card → Lead</TabsTrigger>
        </TabsList>
        <TabsContent value="receipt" className="mt-4"><ReceiptTab /></TabsContent>
        <TabsContent value="product" className="mt-4"><ProductTab /></TabsContent>
        <TabsContent value="asset" className="mt-4"><AssetTab /></TabsContent>
        <TabsContent value="board" className="mt-4"><WhiteboardTab /></TabsContent>
        <TabsContent value="card" className="mt-4"><CardTab /></TabsContent>
      </Tabs>
    </div>
  );
}
