import { useDeferredValue, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Building2, MapPin, Pencil, Plus, Tags, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, type OfficeInput } from "@/services/api";
import { useApp } from "@/store/app-store";
import { PermissionGate } from "@/components/common/PermissionGate";
import { ListPagination, ListSearch, useListPagination } from "@/components/common/ListControls";
import type { Office } from "@/types";

export const Route = createFileRoute("/_shell/offices")({
  head: () => ({
    meta: [
      { title: "Offices — LGU DocTrack" },
      {
        name: "description",
        content: "Directory of city hall offices participating in document routing.",
      },
      { property: "og:title", content: "Offices — LGU DocTrack" },
      {
        property: "og:description",
        content: "Directory of city hall offices participating in document routing.",
      },
    ],
  }),
  component: OfficesPage,
});

const emptyOffice = (): OfficeInput => ({
  name: "",
  code: "",
  location: "",
  keywords: "",
  active: true,
});

function OfficesPage() {
  const { offices, refresh } = useApp();
  const [editing, setEditing] = useState<Office | null>(null);
  const [form, setForm] = useState<OfficeInput>(emptyOffice);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const filteredOffices = useMemo(() => {
    const query = deferredQ.trim().toLowerCase();
    return query
      ? offices.filter((office) =>
          `${office.name} ${office.code} ${office.location} ${office.keywords} ${office.active ? "active" : "inactive"}`
            .toLowerCase()
            .includes(query),
        )
      : offices;
  }, [deferredQ, offices]);
  const pagination = useListPagination(filteredOffices, q);
  const set = (key: keyof OfficeInput, value: string | boolean) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const openForm = (office?: Office) => {
    setEditing(office ?? null);
    setForm(
      office
        ? {
            name: office.name,
            code: office.code,
            location: office.location,
            keywords: office.keywords,
            active: office.active,
          }
        : emptyOffice(),
    );
    setDialogOpen(true);
  };

  const saveOffice = async () => {
    if (saving) return;
    const payload: OfficeInput = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      location: form.location.trim() || "Not specified",
      keywords: form.keywords.trim(),
      active: form.active,
    };
    if (payload.name.length < 2 || payload.code.length < 2) {
      toast.error("Enter an office name and a short code of at least two characters.");
      return;
    }
    setSaving(true);
    try {
      if (editing) await api.updateOffice(editing.id, payload);
      else await api.createOffice(payload);
      await refresh();
      setDialogOpen(false);
      toast.success(`Office ${editing ? "updated" : "created"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save office.");
    } finally {
      setSaving(false);
    }
  };

  const deleteOffice = async (office: Office) => {
    if (!window.confirm(`Delete ${office.name}? Offices with linked records cannot be deleted.`))
      return;
    try {
      await api.deleteOffice(office.id);
      await refresh();
      toast.success(`${office.name} deleted.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete office.");
    }
  };

  return (
    <PermissionGate roles={["admin"]}>
      <>
        <PageHeader
          title="Offices"
          description="Manage every office that can register, receive or release documents."
          actions={
            <Button onClick={() => openForm()}>
              <Plus className="size-4" /> Add office
            </Button>
          }
        />
        <div className="flex justify-end">
          <ListSearch
            value={q}
            onChange={setQ}
            placeholder="Search offices"
            ariaLabel="Search offices"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pagination.pageItems.map((office) => (
            <Card key={office.id}>
              <CardHeader className="flex-col gap-2 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="size-4 text-primary" aria-hidden />
                    <span className="truncate">{office.name}</span>
                  </CardTitle>
                  <CardDescription>{office.location}</CardDescription>
                </div>
                <Badge variant={office.active ? "secondary" : "outline"}>
                  {office.active ? office.code : "Inactive"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <MapPin className="size-4" aria-hidden /> {office.location}
                </p>
                {office.keywords ? (
                  <p className="flex items-start gap-2">
                    <Tags className="mt-0.5 size-4 shrink-0" aria-hidden />{" "}
                    <span className="break-words">{office.keywords}</span>
                  </p>
                ) : null}
                <p className="flex items-center gap-2">
                  <Users className="size-4" aria-hidden /> {office.staffCount} staff
                </p>
                <div className="flex justify-end gap-1 border-t pt-3">
                  <Button variant="outline" size="sm" onClick={() => openForm(office)}>
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void deleteOffice(office)}
                    aria-label={`Delete ${office.name}`}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {filteredOffices.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No offices found.</p>
        ) : null}
        <ListPagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          pageSize={pagination.pageSize}
          totalItems={filteredOffices.length}
          itemLabel="offices"
          onPageChange={pagination.setPage}
        />
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit office" : "Add office"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update its directory details or make it unavailable for new routing."
                  : "The office becomes available as a routing destination after it is saved."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="office-name">Office name</Label>
                <Input
                  id="office-name"
                  value={form.name}
                  onChange={(event) => set("name", event.target.value)}
                  placeholder="City Legal Office"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="office-code">Short code</Label>
                <Input
                  id="office-code"
                  value={form.code}
                  onChange={(event) => set("code", event.target.value)}
                  placeholder="CLO"
                  maxLength={32}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="office-location">Location</Label>
                <Input
                  id="office-location"
                  value={form.location}
                  onChange={(event) => set("location", event.target.value)}
                  placeholder="City Hall, 2nd floor"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="office-keywords">Search keywords</Label>
                <Input
                  id="office-keywords"
                  value={form.keywords}
                  onChange={(event) => set("keywords", event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Use commas to add words people can use to find this office.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                <div>
                  <Label htmlFor="office-active">Active for routing</Label>
                  <p className="text-xs text-muted-foreground">
                    Inactive offices stay in history but cannot receive new documents.
                  </p>
                </div>
                <Switch
                  id="office-active"
                  checked={form.active}
                  onCheckedChange={(active) => set("active", active)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void saveOffice()} disabled={saving}>
                {saving ? "Saving…" : "Save office"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </PermissionGate>
  );
}
