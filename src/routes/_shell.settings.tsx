import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  api,
  type GeneralSettings,
  type NotificationSettings,
  type ScannerSettings,
  type SlaSettings,
  type SystemSettings,
} from "@/services/api";
import { PermissionGate } from "@/components/common/PermissionGate";

export const Route = createFileRoute("/_shell/settings")({
  head: () => ({
    meta: [
      { title: "Settings — LGU DocTrack" },
      {
        name: "description",
        content: "System identity, SLA defaults, notification and scanner preferences.",
      },
      { property: "og:title", content: "Settings — LGU DocTrack" },
      {
        property: "og:description",
        content: "System identity, SLA defaults and scanner preferences.",
      },
    ],
  }),
  component: SettingsPage,
});

const defaultSettings: SystemSettings = {
  general: {
    lguName: "City Government of San Lorenzo",
    address: "City Hall Compound, Rizal Street, San Lorenzo",
  },
  sla: { routineHours: 72, urgentHours: 24, rushHours: 8 },
  notifications: {
    overdueAlerts: true,
    wrongOfficeScans: true,
    dailyDigest: false,
  },
  scanner: {
    blockWrongOfficeReceipts: true,
    requireRemarksOnHold: true,
    vibrateOnSuccessfulScan: true,
  },
};

function mergeSavedSettings(saved: Awaited<ReturnType<typeof api.getSettings>>): SystemSettings {
  return {
    general: { ...defaultSettings.general, ...(saved.general ?? {}) },
    sla: { ...defaultSettings.sla, ...(saved.sla ?? {}) },
    notifications: { ...defaultSettings.notifications, ...(saved.notifications ?? {}) },
    scanner: { ...defaultSettings.scanner, ...(saved.scanner ?? {}) },
  };
}

function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getSettings()
      .then((saved) => {
        if (!cancelled) setSettings(mergeSavedSettings(saved));
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Could not load settings.";
          toast.error(message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSettings(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setGeneralField = (key: keyof GeneralSettings, value: string) =>
    setSettings((current) => ({
      ...current,
      general: { ...current.general, [key]: value },
    }));
  const setSlaField = (key: keyof SlaSettings, value: string) =>
    setSettings((current) => ({
      ...current,
      sla: { ...current.sla, [key]: Number(value) || 1 },
    }));
  const setNotificationField = (key: keyof NotificationSettings, value: boolean) =>
    setSettings((current) => ({
      ...current,
      notifications: { ...current.notifications, [key]: value },
    }));
  const setScannerField = (key: keyof ScannerSettings, value: boolean) =>
    setSettings((current) => ({
      ...current,
      scanner: { ...current.scanner, [key]: value },
    }));

  const saveSettings = async () => {
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(settings).map(([key, value]) => api.updateSettings(key, value)),
      );
      toast.success("Settings saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save settings.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PermissionGate roles={["admin"]}>
      <>
        <PageHeader
          title="Settings"
          description="Configuration for the whole tracking system."
          actions={
            <Button onClick={saveSettings} disabled={loadingSettings || saving}>
              <Save className="size-4" /> {saving ? "Saving..." : "Save changes"}
            </Button>
          }
        />

        <Tabs defaultValue="general">
          <TabsList className="sm:w-full sm:justify-start">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="sla">Service levels</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="scanner">Scanner</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Institution identity</CardTitle>
                <CardDescription>
                  Appears on printed routing slips and reports. Tracking IDs are generated as office
                  code–current year–sequence.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid max-w-2xl gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lgu">LGU name</Label>
                  <Input
                    id="lgu"
                    value={settings.general.lguName}
                    onChange={(e) => setGeneralField("lguName", e.target.value)}
                    disabled={loadingSettings || saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addr">Address</Label>
                  <Textarea
                    id="addr"
                    rows={2}
                    value={settings.general.address}
                    onChange={(e) => setGeneralField("address", e.target.value)}
                    disabled={loadingSettings || saving}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sla">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Service levels</CardTitle>
                <CardDescription>
                  Total target completion time for newly registered documents by priority.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid max-w-2xl gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="r1">Routine (hours)</Label>
                  <Input
                    id="r1"
                    type="number"
                    min={1}
                    max={720}
                    value={settings.sla.routineHours}
                    onChange={(e) => setSlaField("routineHours", e.target.value)}
                    disabled={loadingSettings || saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r2">Urgent (hours)</Label>
                  <Input
                    id="r2"
                    type="number"
                    min={1}
                    max={720}
                    value={settings.sla.urgentHours}
                    onChange={(e) => setSlaField("urgentHours", e.target.value)}
                    disabled={loadingSettings || saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r3">Rush (hours)</Label>
                  <Input
                    id="r3"
                    type="number"
                    min={1}
                    max={720}
                    value={settings.sla.rushHours}
                    onChange={(e) => setSlaField("rushHours", e.target.value)}
                    disabled={loadingSettings || saving}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Alerting</CardTitle>
                <CardDescription>Who gets told when a document stalls.</CardDescription>
              </CardHeader>
              <CardContent className="max-w-2xl space-y-4">
                {(
                  [
                    [
                      "Overdue alerts",
                      "Notify the office head when a document exceeds its SLA.",
                      "overdueAlerts",
                    ],
                    [
                      "Wrong office scans",
                      "Alert Records Management when a document is scanned off-route.",
                      "wrongOfficeScans",
                    ],
                    [
                      "Daily digest",
                      "Send each office a morning summary of pending documents.",
                      "dailyDigest",
                    ],
                  ] as const
                ).map(([title, desc, key]) => (
                  <div
                    key={title}
                    className="flex flex-col items-start gap-3 rounded-lg border border-border p-4 sm:flex-row sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{title}</p>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={settings.notifications[key]}
                      onCheckedChange={(checked) => setNotificationField(key, checked)}
                      aria-label={title}
                      disabled={loadingSettings || saving}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scanner">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Scanner behaviour</CardTitle>
                <CardDescription>Applies to the mobile receiving experience.</CardDescription>
              </CardHeader>
              <CardContent className="max-w-2xl space-y-4">
                {(
                  [
                    [
                      "Block wrong-office receipts",
                      "Prevent receiving a document routed to another office.",
                      "blockWrongOfficeReceipts",
                    ],
                    [
                      "Require remarks on hold",
                      "Force a reason when placing a document on hold.",
                      "requireRemarksOnHold",
                    ],
                    [
                      "Vibrate on successful scan",
                      "Haptic confirmation on supported devices.",
                      "vibrateOnSuccessfulScan",
                    ],
                  ] as const
                ).map(([title, desc, key]) => (
                  <div
                    key={title}
                    className="flex flex-col items-start gap-3 rounded-lg border border-border p-4 sm:flex-row sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{title}</p>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={settings.scanner[key]}
                      onCheckedChange={(checked) => setScannerField(key, checked)}
                      aria-label={title}
                      disabled={loadingSettings || saving}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </>
    </PermissionGate>
  );
}
