import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import { PermissionGate } from "@/components/common/PermissionGate";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { DocumentType } from "@/types";
import { ListPagination, ListSearch, useListPagination } from "@/components/common/ListControls";

export const Route = createFileRoute("/_shell/references")({
  head: () => ({
    meta: [
      { title: "Reference data — LGU DocTrack" },
      {
        name: "description",
        content: "Document types, priorities and other master lists.",
      },
      { property: "og:title", content: "Reference data — LGU DocTrack" },
      {
        property: "og:description",
        content: "Document types, priorities and tracking action master lists.",
      },
    ],
  }),
  component: ReferencesPage,
});

const PRIORITIES = [
  { name: "Routine", sla: "72 hours", color: "Neutral" },
  { name: "Urgent", sla: "24 hours", color: "Amber" },
  { name: "Rush", sla: "8 hours", color: "Red" },
];

const ACTIONS = [
  "Registered",
  "Dispatched",
  "Received",
  "Processed",
  "Held",
  "Returned",
  "Completed",
  "Filed",
  "Wrong office",
];

function ReferencesPage() {
  const { documentTypes, refresh } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<DocumentType | null>(null);
  const [form, setForm] = useState({ name: "", code: "", active: true });
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const filteredTypes = useMemo(() => {
    const query = deferredQ.trim().toLowerCase();
    return query
      ? documentTypes.filter((type) => `${type.code} ${type.name}`.toLowerCase().includes(query))
      : documentTypes;
  }, [deferredQ, documentTypes]);
  const pagination = useListPagination(filteredTypes, q);

  const openForm = (type?: DocumentType) => {
    setEditing(type ?? null);
    setForm({
      name: type?.name ?? "",
      code: type?.code ?? "",
      active: type?.active ?? true,
    });
    setDialogOpen(true);
  };

  const saveType = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        active: form.active,
        ...(form.code.trim() ? { code: form.code.trim().toUpperCase() } : {}),
      };
      if (editing) await api.updateDocumentType(editing.id, payload);
      else await api.createDocumentType(payload);
      await refresh();
      setDialogOpen(false);
      toast.success(`Document type ${editing ? "updated" : "created"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save document type.");
    } finally {
      setSaving(false);
    }
  };

  const deleteType = async (type: DocumentType) => {
    if (!window.confirm(`Delete ${type.name}? This cannot be undone.`)) return;
    try {
      await api.deleteDocumentType(type.id);
      await refresh();
      toast.success(`${type.name} deleted.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete document type.");
    }
  };

  return (
    <PermissionGate roles={["admin", "office_head", "staff"]}>
      <>
        <PageHeader
          title="Reference data"
          description="Manage the document types available to your office during registration."
          actions={
            <Button onClick={() => openForm()}>
              <Plus className="size-4" /> Add entry
            </Button>
          }
        />

        <Tabs defaultValue="types">
          <TabsList className="sm:w-full sm:justify-start">
            <TabsTrigger value="types">Document types</TabsTrigger>
            <TabsTrigger value="priorities">Priorities</TabsTrigger>
            <TabsTrigger value="actions">Tracking actions</TabsTrigger>
          </TabsList>

          <TabsContent value="types">
            <Card>
              <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Document types</CardTitle>
                  <CardDescription>Only your office can see or use these types.</CardDescription>
                </div>
                <ListSearch
                  value={q}
                  onChange={setQ}
                  placeholder="Search document types"
                  ariaLabel="Search document types"
                />
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.pageItems.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Badge variant="secondary">{t.code}</Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{t.name}</TableCell>
                        <TableCell>
                          <Badge variant={t.active === false ? "outline" : "secondary"}>
                            {t.active === false ? "Inactive" : "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${t.name}`}
                              onClick={() => openForm(t)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${t.name}`}
                              onClick={() => void deleteType(t)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredTypes.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    No document types found.
                  </p>
                ) : null}
                <ListPagination
                  page={pagination.page}
                  pageCount={pagination.pageCount}
                  pageSize={pagination.pageSize}
                  totalItems={filteredTypes.length}
                  itemLabel="document types"
                  onPageChange={pagination.setPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="priorities">
            <div className="grid gap-4 sm:grid-cols-3">
              {PRIORITIES.map((p) => (
                <Card key={p.name}>
                  <CardHeader>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <CardDescription>Target turnaround {p.sla}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Badge colour: {p.color}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="actions">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Custody actions</CardTitle>
                <CardDescription>
                  Fixed vocabulary recorded on every tracking event.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {ACTIONS.map((a) => (
                  <Badge key={a} variant="outline">
                    {a}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit document type" : "Add document type"}</DialogTitle>
              <DialogDescription>
                This type appears in your office's registration dropdown immediately after saving.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type-name">Name</Label>
                <Input
                  id="type-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Purchase Request"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type-code">Code (optional)</Label>
                <Input
                  id="type-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="Generated from the name"
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.active}
                  onCheckedChange={(active) => setForm({ ...form, active })}
                  id="type-active"
                />
                <Label htmlFor="type-active">Active for new documents</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button disabled={saving || !form.name.trim()} onClick={() => void saveType()}>
                {editing ? "Save changes" : "Create type"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </PermissionGate>
  );
}
