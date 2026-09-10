import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Paperclip, Plus, Printer, QrCode } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { BarcodePlaceholder } from "@/components/common/BarcodePlaceholder";
import { QrPlaceholder } from "@/components/common/QrPlaceholder";
import { FileUploadDropzone } from "@/components/common/FileUploadDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApp } from "@/store/app-store";
import { api, officeName, type AttachmentInput, type RegisteredDocument } from "@/services/api";
import type { Priority } from "@/types";
import { createClientId } from "@/lib/client-id";

export const Route = createFileRoute("/_shell/documents/new")({
  head: () => ({
    meta: [
      { title: "Register a document — LGU DocTrack" },
      {
        name: "description",
        content: "Capture document details and print a QR and barcode routing slip.",
      },
      { property: "og:title", content: "Register a document — LGU DocTrack" },
      {
        property: "og:description",
        content: "Capture document details and print a QR and barcode routing slip.",
      },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { registerDocument, documentTypes, refresh } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [requestId, setRequestId] = useState(() => createClientId());
  const [created, setCreated] = useState<RegisteredDocument | null>(null);
  const [attachments, setAttachments] = useState<(AttachmentInput & { id: string })[]>([]);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [creatingType, setCreatingType] = useState(false);
  const [form, setForm] = useState({
    title: "",
    subject: "",
    typeId: documentTypes.find((type) => type.active !== false)?.id ?? "",
    priority: "routine" as Priority,
    remarks: "",
  });
  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));
  const activeDocumentTypes = useMemo(
    () => documentTypes.filter((type) => type.active !== false),
    [documentTypes],
  );
  useEffect(() => {
    const firstActiveDocumentType = activeDocumentTypes[0];
    if (!form.typeId && firstActiveDocumentType) {
      setForm((current) => ({ ...current, typeId: firstActiveDocumentType.id }));
    }
  }, [activeDocumentTypes, form.typeId]);
  const valid = form.title.trim().length > 3 && !!form.typeId;
  const createDocumentType = async () => {
    if (!newTypeName.trim() || creatingType) return;
    setCreatingType(true);
    try {
      const type = await api.createDocumentType({ name: newTypeName.trim() });
      await refresh();
      set("typeId", type.id);
      setNewTypeName("");
      setTypeDialogOpen(false);
      toast.success(`${type.name} is ready to use.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the document type.");
    } finally {
      setCreatingType(false);
    }
  };
  const chooseAttachments = async (files: File[]) => {
    const validFiles = files.filter((file) => file.size <= 10 * 1024 * 1024);
    if (validFiles.length !== files.length) {
      toast.error("Each file must be 10 MB or smaller.");
    }
    if (!validFiles.length) return;

    try {
      const nextAttachments = await Promise.all(
        validFiles.map(
          (file) =>
            new Promise<AttachmentInput & { id: string }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({
                  id: createClientId(),
                  fileName: file.name,
                  mimeType: file.type || "application/octet-stream",
                  size: file.size,
                  dataUrl: String(reader.result),
                });
              reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
              reader.readAsDataURL(file);
            }),
        ),
      );
      setAttachments((current) => [...current, ...nextAttachments]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read the selected files.");
    }
  };

  if (created) {
    return (
      <>
        <PageHeader
          title="Document registered"
          description="Print the QR and barcode routing slip and attach it to the physical document before dispatching."
          actions={
            <Button variant="outline" asChild>
              <Link to="/documents">Back to registry</Link>
            </Button>
          }
        />
        <Card className="mx-auto max-w-2xl">
          <CardHeader className="items-center text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircle2 className="size-6" aria-hidden />
            </span>
            <CardTitle className="mt-3">{created.trackingCode}</CardTitle>
            <CardDescription>{created.title}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-dashed border-border p-4">
              <div className="flex items-center gap-4">
                <QrPlaceholder value={created.qrCode} size={120} />
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-sm font-semibold">{created.qrCode}</p>
                  <p className="text-xs text-muted-foreground">
                    Current custody: {officeName(created.currentOfficeId)}
                  </p>
                </div>
              </div>
              <BarcodePlaceholder value={created.trackingCode} className="mt-3" />
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="text-xs font-medium text-muted-foreground">Public tracking token</p>
              {created.publicTrackingToken ? (
                <>
                  <p className="mt-1 break-all font-mono text-sm">{created.publicTrackingToken}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => void navigator.clipboard.writeText(created.publicTrackingToken!)}
                  >
                    Copy public token
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Give this token only to the requester. It cannot be recovered after leaving this page.
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  This registration was recovered after a retry. An administrator can issue a replacement public token if needed.
                </p>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                onClick={() =>
                  window.open(api.routingSlipUrl(created.id), "_blank", "noopener,noreferrer")
                }
              >
                <Printer className="size-4" /> Print routing slip
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate({ to: "/documents/$docId", params: { docId: created.id } })}
              >
                Open document
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setCreated(null);
                  setRequestId(createClientId());
                  setForm((current) => ({
                    ...current,
                    title: "",
                    subject: "",
                    remarks: "",
                  }));
                  setAttachments([]);
                  setStep(1);
                }}
              >
                Register another
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Create Tracking Slip"
        description="Describe the document, then generate its QR and barcode label."
        actions={
          <Button variant="outline" asChild>
            <Link to="/documents">
              <ArrowLeft className="size-4" /> Cancel
            </Link>
          </Button>
        }
      />

      <ol className="flex flex-wrap items-center gap-3 text-sm">
        {["Document details", "QR and barcode"].map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={
                "flex size-7 items-center justify-center rounded-full text-xs font-semibold " +
                (step > i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")
              }
            >
              {i + 1}
            </span>
            <span className={step > i ? "font-medium" : "text-muted-foreground"}>{label}</span>
            {i < 1 ? <Separator className="w-8" /> : null}
          </li>
        ))}
      </ol>

      <Card className="max-w-3xl">
        <CardContent className="space-y-5 p-6">
          {step === 1 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="title">Document title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject / purpose</Label>
                <Textarea
                  id="subject"
                  value={form.subject}
                  onChange={(e) => set("subject", e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Document type</Label>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto px-0"
                      onClick={() => setTypeDialogOpen(true)}
                    >
                      <Plus className="size-3.5" /> Add document type
                    </Button>
                  </div>
                  <Select value={form.typeId} onValueChange={(v) => set("typeId", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a document type" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeDocumentTypes.length ? (
                        activeDocumentTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))
                      ) : (
                        <p className="px-2 py-1.5 text-sm text-muted-foreground">
                          No document types yet. Add one to continue.
                        </p>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="routine">Routine</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="rush">Rush</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="upload-document">Upload Document</Label>
                <FileUploadDropzone
                  id="upload-document"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  files={attachments}
                  onFilesSelected={(files) => void chooseAttachments(files)}
                  onRemove={(id) =>
                    setAttachments((current) => current.filter((file) => file.id !== id))
                  }
                  onClear={() => setAttachments([])}
                />
                <p className="text-xs text-muted-foreground">
                  Attach scanned or digital copies for reference. This is not required.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks (optional)</Label>
                <Textarea
                  id="remarks"
                  rows={2}
                  value={form.remarks}
                  onChange={(e) => set("remarks", e.target.value)}
                />
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                <QrCode className="size-5 text-primary" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  A tracking code, QR reference, and Code 128 barcode will be generated on save.
                  Print the slip and attach it to the document.
                </p>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Title</dt>
                  <dd className="font-medium">{form.title || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Priority</dt>
                  <dd className="font-medium capitalize">{form.priority}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Uploaded documents</dt>
                  <dd className="font-medium">
                    {attachments.length ? (
                      <ul className="space-y-1">
                        {attachments.map((attachment) => (
                          <li key={attachment.id} className="flex items-center gap-2">
                            <Paperclip className="size-4 shrink-0 text-primary" aria-hidden />
                            <span className="truncate">{attachment.fileName}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "No files attached"
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          <Separator />
          <div className="flex flex-wrap justify-between gap-3">
            <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
            {step < 2 ? (
              <Button
                onClick={() => {
                  if (step === 1 && !valid) {
                    toast.error("Enter a title and document type.");
                    return;
                  }
                  setStep((s) => s + 1);
                }}
              >
                Continue
              </Button>
            ) : (
              <Button
                disabled={saving}
                onClick={async () => {
                  if (saving) return;
                  setSaving(true);
                  try {
                    const doc = await registerDocument({
                      ...form,
                      requestId,
                      attachments: attachments.map(({ id: _id, ...attachment }) => attachment),
                      remarks: form.remarks || undefined,
                    });
                    setCreated(doc);
                    toast.success(`${doc.trackingCode} registered.`);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Registration failed.");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Register & generate codes
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add document type</DialogTitle>
            <DialogDescription>
              This type is available only to your office. A short code is created automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-document-type">Document type name</Label>
            <Input
              id="new-document-type"
              value={newTypeName}
              onChange={(event) => setNewTypeName(event.target.value)}
              placeholder="Job Order Payroll"
              onKeyDown={(event) => {
                if (event.key === "Enter") void createDocumentType();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newTypeName.trim() || creatingType}
              onClick={() => void createDocumentType()}
            >
              Add type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
