import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Cpu, Copy, Trash2, RefreshCw, Wifi, WifiOff, Sparkles, Send, KeyRound, Plus, Zap } from "lucide-react";
import { PageHeader } from "@/components/nexus/PageHeader";
import { CreateDialog } from "@/components/nexus/CreateDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  listDevices, createDevice, deleteDevice, rotateDeviceKey, getTelemetry,
  sendCommand, listRules, createRule, toggleRule, deleteRule, aiAnalyzeDevice,
} from "@/lib/iot.functions";

export const Route = createFileRoute("/_authenticated/iot")({ component: IoTPage });

function arduinoSnippet(deviceKey: string, host: string) {
  return `// ESP32 → Nexus IoT — paste into Arduino IDE
#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASS = "YOUR_PASS";
const char* DEVICE_KEY = "${deviceKey}";
const char* INGEST_URL = "${host}/api/public/iot/ingest";

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println(" wifi ok");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) { delay(2000); return; }
  float temperature = 20.0 + (random(0, 1500) / 100.0);
  float humidity    = 40.0 + (random(0, 3000) / 100.0);

  HTTPClient http;
  http.begin(INGEST_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  String body = String("{\\"metrics\\":[")
    + "{\\"metric\\":\\"temperature\\",\\"value\\":" + temperature + ",\\"unit\\":\\"C\\"},"
    + "{\\"metric\\":\\"humidity\\",\\"value\\":" + humidity + ",\\"unit\\":\\"%\\"}"
    + "],\\"firmware\\":\\"esp32-demo-1.0\\"}";

  int code = http.POST(body);
  Serial.printf("POST %d — %s\\n", code, http.getString().c_str());
  http.end();
  delay(10000); // every 10s
}`;
}

function IoTPage() {
  const qc = useQueryClient();
  const list = useServerFn(listDevices);
  const create = useServerFn(createDevice);
  const del = useServerFn(deleteDevice);
  const rotate = useServerFn(rotateDeviceKey);
  const telem = useServerFn(getTelemetry);
  const cmd = useServerFn(sendCommand);
  const rulesFn = useServerFn(listRules);
  const createRuleFn = useServerFn(createRule);
  const toggleRuleFn = useServerFn(toggleRule);
  const deleteRuleFn = useServerFn(deleteRule);
  const analyze = useServerFn(aiAnalyzeDevice);

  const devicesQ = useQuery({ queryKey: ["iot-devices"], queryFn: () => list({}), refetchInterval: 8000 });
  const rulesQ = useQuery({ queryKey: ["iot-rules"], queryFn: () => rulesFn({}) });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => devicesQ.data?.find((d: any) => d.id === selectedId) ?? devicesQ.data?.[0], [devicesQ.data, selectedId]);

  const telemetryQ = useQuery({
    queryKey: ["iot-telem", selected?.id],
    queryFn: () => telem({ data: { deviceId: selected!.id, limit: 200 } }),
    enabled: !!selected?.id,
    refetchInterval: 5000,
  });

  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(""); const [kind, setKind] = useState("esp32"); const [location, setLocation] = useState("");
  const addDevice = async () => {
    setBusy(true);
    try {
      await create({ data: { name, kind, location } });
      toast.success("Device added");
      setName(""); setLocation("");
      qc.invalidateQueries({ queryKey: ["iot-devices"] });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const host = typeof window !== "undefined" ? window.location.origin : "";

  // command form
  const [cmdName, setCmdName] = useState("led_on");
  const [cmdArgs, setCmdArgs] = useState("{}");
  const runCmd = async () => {
    if (!selected) return;
    try {
      const args = cmdArgs.trim() ? JSON.parse(cmdArgs) : {};
      await cmd({ data: { deviceId: selected.id, command: cmdName, args } });
      toast.success("Command queued — device will pick it up on next ping");
    } catch (e: any) { toast.error(e.message); }
  };

  // rule form
  const [ruleName, setRuleName] = useState("");
  const [ruleMetric, setRuleMetric] = useState("temperature");
  const [ruleOp, setRuleOp] = useState(">");
  const [ruleThreshold, setRuleThreshold] = useState("30");
  const [ruleAction, setRuleAction] = useState("alert");
  const addRule = async () => {
    try {
      await createRuleFn({ data: {
        name: ruleName, metric: ruleMetric, operator: ruleOp,
        threshold: Number(ruleThreshold), action: ruleAction,
        device_id: selected?.id ?? null,
      }});
      toast.success("Rule saved");
      setRuleName("");
      qc.invalidateQueries({ queryKey: ["iot-rules"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const [insight, setInsight] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const runAnalyze = async () => {
    if (!selected) return;
    setAnalyzing(true);
    try { setInsight(await analyze({ data: { deviceId: selected.id } })); }
    catch (e: any) { toast.error(e.message); } finally { setAnalyzing(false); }
  };

  // chart data grouped by metric (latest 60 for readability)
  const chartMetrics = useMemo(() => {
    const rows = (telemetryQ.data ?? []).slice().reverse();
    const metrics = Array.from(new Set(rows.map((r: any) => r.metric)));
    return metrics.map((m) => ({
      metric: m,
      data: rows.filter((r: any) => r.metric === m).slice(-60).map((r: any) => ({
        t: new Date(r.recorded_at).toLocaleTimeString(),
        v: Number(r.value),
      })),
    }));
  }, [telemetryQ.data]);

  return (
    <div>
      <PageHeader
        title="IoT & Edge"
        subtitle="Connect ESP32 / Raspberry Pi / any HTTP device. Stream telemetry, run edge rules, send commands."
        actions={
          <CreateDialog title="Register device" triggerLabel="New device" busy={busy} onSubmit={addDevice}>
            <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Warehouse temp sensor" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Kind</Label>
                <Select value={kind} onValueChange={setKind}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="esp32">ESP32</SelectItem>
                    <SelectItem value="esp8266">ESP8266</SelectItem>
                    <SelectItem value="raspberry_pi">Raspberry Pi</SelectItem>
                    <SelectItem value="arduino">Arduino</SelectItem>
                    <SelectItem value="generic">Generic HTTP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Warehouse A" /></div>
            </div>
          </CreateDialog>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Devices</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {devicesQ.data?.length ? devicesQ.data.map((d: any) => (
              <button key={d.id} onClick={() => setSelectedId(d.id)}
                className={`w-full rounded-lg border p-3 text-left transition ${selected?.id === d.id ? "border-primary bg-accent/50" : "border-border/50 hover:bg-muted/50"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Cpu className="h-4 w-4" /><span className="font-medium text-sm">{d.name}</span></div>
                  {d.live ? <Badge className="gap-1 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20"><Wifi className="h-3 w-3" />live</Badge>
                    : <Badge variant="secondary" className="gap-1"><WifiOff className="h-3 w-3" />idle</Badge>}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{d.kind} · {d.location || "—"}</div>
                {d.last_seen && <div className="text-[10px] text-muted-foreground">seen {new Date(d.last_seen).toLocaleString()}</div>}
              </button>
            )) : <div className="p-6 text-center text-sm text-muted-foreground">No devices. Register your ESP32 →</div>}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!selected ? (
            <Card className="border-border/60"><CardContent className="p-10 text-center text-sm text-muted-foreground">Select or add a device to begin.</CardContent></Card>
          ) : (
            <Tabs defaultValue="live">
              <TabsList>
                <TabsTrigger value="live">Live telemetry</TabsTrigger>
                <TabsTrigger value="commands">Commands</TabsTrigger>
                <TabsTrigger value="rules">Edge rules</TabsTrigger>
                <TabsTrigger value="connect">Connect</TabsTrigger>
                <TabsTrigger value="ai">AI insight</TabsTrigger>
              </TabsList>

              <TabsContent value="live" className="space-y-4">
                {chartMetrics.length ? chartMetrics.map((c) => (
                  <Card key={c.metric} className="border-border/60">
                    <CardHeader className="pb-2"><CardTitle className="text-sm capitalize">{c.metric}</CardTitle></CardHeader>
                    <CardContent className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={c.data}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis dataKey="t" hide />
                          <YAxis width={40} />
                          <Tooltip />
                          <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )) : <Card className="border-border/60"><CardContent className="p-10 text-center text-sm text-muted-foreground">No telemetry yet — flash the sample sketch below and wait for the first POST.</CardContent></Card>}
              </TabsContent>

              <TabsContent value="commands" className="space-y-4">
                <Card className="border-border/60">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Send remote command</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-[1fr_2fr_auto] gap-2">
                      <Input placeholder="command (e.g. led_on)" value={cmdName} onChange={(e) => setCmdName(e.target.value)} />
                      <Input placeholder='args JSON, e.g. {"pin":2}' value={cmdArgs} onChange={(e) => setCmdArgs(e.target.value)} />
                      <Button onClick={runCmd}><Send className="mr-1.5 h-4 w-4" />Queue</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Device fetches queued commands on its next ingest ping and can ACK via <code className="rounded bg-muted px-1">/api/public/iot/ack</code>.</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="rules" className="space-y-4">
                <Card className="border-border/60">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">New edge rule (this device or all)</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <Input placeholder="Rule name" value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
                    <div className="grid grid-cols-4 gap-2">
                      <Input placeholder="metric" value={ruleMetric} onChange={(e) => setRuleMetric(e.target.value)} />
                      <Select value={ruleOp} onValueChange={setRuleOp}><SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{[">", ">=", "<", "<=", "==", "!="].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="number" value={ruleThreshold} onChange={(e) => setRuleThreshold(e.target.value)} />
                      <Select value={ruleAction} onValueChange={setRuleAction}><SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alert">Alert (reminder)</SelectItem>
                          <SelectItem value="log">Log activity</SelectItem>
                          <SelectItem value="command">Queue command</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={addRule} disabled={!ruleName}><Plus className="mr-1.5 h-4 w-4" />Save rule</Button>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Rule</TableHead><TableHead>Condition</TableHead><TableHead>Action</TableHead>
                        <TableHead>Fired</TableHead><TableHead /></TableRow></TableHeader>
                      <TableBody>
                        {rulesQ.data?.length ? rulesQ.data.map((r: any) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.name}</TableCell>
                            <TableCell><code className="rounded bg-muted px-1 text-xs">{r.metric} {r.operator} {r.threshold}</code></TableCell>
                            <TableCell><Badge variant="outline" className="gap-1"><Zap className="h-3 w-3" />{r.action}</Badge></TableCell>
                            <TableCell className="text-muted-foreground">{r.trigger_count}×</TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button size="sm" variant="ghost" onClick={async () => { await toggleRuleFn({ data: { id: r.id, enabled: !r.enabled } }); qc.invalidateQueries({ queryKey: ["iot-rules"] }); }}>
                                {r.enabled ? "Disable" : "Enable"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={async () => { await deleteRuleFn({ data: { id: r.id } }); qc.invalidateQueries({ queryKey: ["iot-rules"] }); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )) : <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No rules yet.</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="connect" className="space-y-4">
                <Card className="border-border/60">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><KeyRound className="h-4 w-4" />Device credentials</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label>Device key (send as <code>x-device-key</code> header)</Label>
                      <div className="flex gap-2">
                        <Input readOnly value={selected.device_key} className="font-mono text-xs" />
                        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(selected.device_key); toast.success("Copied"); }}><Copy className="h-4 w-4" /></Button>
                        <Button variant="outline" size="sm" onClick={async () => { await rotate({ data: { id: selected.id } }); toast.success("Rotated"); qc.invalidateQueries({ queryKey: ["iot-devices"] }); }}><RefreshCw className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Ingest endpoint</Label>
                      <Input readOnly value={`${host}/api/public/iot/ingest`} className="font-mono text-xs" />
                    </div>
                    <Button variant="destructive" size="sm" onClick={async () => { await del({ data: { id: selected.id } }); setSelectedId(null); qc.invalidateQueries({ queryKey: ["iot-devices"] }); }}>
                      <Trash2 className="mr-1.5 h-4 w-4" />Delete device
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardHeader className="pb-2 flex-row items-center justify-between">
                    <CardTitle className="text-sm">Arduino / ESP32 starter sketch</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(arduinoSnippet(selected.device_key, host)); toast.success("Sketch copied"); }}><Copy className="mr-1.5 h-4 w-4" />Copy</Button>
                  </CardHeader>
                  <CardContent>
                    <Textarea readOnly rows={16} value={arduinoSnippet(selected.device_key, host)} className="font-mono text-[11px]" />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ai" className="space-y-4">
                <Card className="border-border/60">
                  <CardHeader className="pb-2 flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" />AI edge analysis</CardTitle>
                    <Button size="sm" onClick={runAnalyze} disabled={analyzing}>{analyzing ? "Analyzing…" : "Run analysis"}</Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!insight ? <p className="text-sm text-muted-foreground">Analyzes recent telemetry (z-score + LLM) to spot anomalies and suggest edge rules.</p> : (
                      <>
                        <p className="text-sm">{insight.insight}</p>
                        {insight.anomalies?.length > 0 && (
                          <div>
                            <div className="text-xs font-medium mb-1">Anomalies</div>
                            {insight.anomalies.map((a: any, i: number) => <Badge key={i} variant="destructive" className="mr-1 mb-1">{a.metric}: {a.reason}</Badge>)}
                          </div>
                        )}
                        {insight.suggested_rules?.length > 0 && (
                          <div>
                            <div className="text-xs font-medium mb-1">Suggested rules</div>
                            {insight.suggested_rules.map((r: any, i: number) => (
                              <div key={i} className="flex items-center justify-between rounded border p-2 text-xs mb-1">
                                <span><b>{r.name}</b> · {r.metric} {r.operator} {r.threshold} → {r.action}</span>
                                <Button size="sm" variant="outline" onClick={async () => {
                                  await createRuleFn({ data: { ...r, threshold: Number(r.threshold), device_id: selected.id } });
                                  toast.success("Rule added");
                                  qc.invalidateQueries({ queryKey: ["iot-rules"] });
                                }}>Add</Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
