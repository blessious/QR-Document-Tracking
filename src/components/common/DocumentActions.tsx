import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/store/app-store";
import type { RoutingPurpose, TrackedDocument } from "@/types";
import { api, officeName } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function DispatchDialog({
  doc,
  open,
  onOpenChange,
  onSuccess,
  onError,
}: {
  doc: TrackedDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (destination: string) => void;
  onError?: (message: string) => void;
}) {
  const { offices, session, dispatchDocument, setStatus } = useApp();
  const [target, setTarget] = useState("");
  const [officePickerOpen, setOfficePickerOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [savedPurposes, setSavedPurposes] = useState<RoutingPurpose[]>([]);
  const [selectedPurpose, setSelectedPurpose] = useState("");
  const [purposeDialogOpen, setPurposeDialogOpen] = useState(false);
  const [newPurpose, setNewPurpose] = useState("");
  const [savingPurpose, setSavingPurpose] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTarget("");
    setOfficePickerOpen(false);
    setPurpose("");
    setSelectedPurpose("");
  }, [doc.id, doc.updatedAt, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void api
      .listRoutingPurposes()
      .then((purposes) => {
        if (!cancelled) setSavedPurposes(purposes);
      })
      .catch(() => {
        if (!cancelled) setSavedPurposes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const addPurpose = async () => {
    if (!newPurpose.trim() || savingPurpose) return;
    setSavingPurpose(true);
    try {
      const created = await api.createRoutingPurpose({ name: newPurpose.trim() });
      setSavedPurposes((current) =>
        [...current.filter((item) => item.id !== created.id), created].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setSelectedPurpose(created.id);
      setPurpose(created.name);
      setNewPurpose("");
      setPurposeDialogOpen(false);
      toast.success(`${created.name} is ready to use.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the purpose.");
    } finally {
      setSavingPurpose(false);
    }
  };

  const destinations = offices.filter(
    (office) => office.active && office.id !== doc.currentOfficeId,
  );
  const selectedOffice = destinations.find((office) => office.id === target);
  const canComplete =
    session?.role !== "receiving" &&
    session?.officeId === doc.currentOfficeId &&
    !["on_hold", "completed", "filed", "voided", "in_transit"].includes(doc.status);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) onOpenChange(value);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm dispatch</DialogTitle>
          <DialogDescription>
            {doc.trackingCode} · {doc.title}. Custody remains unchanged until you confirm.
          </DialogDescription>
        </DialogHeader>
        <Label htmlFor="dispatch-office">Destination office</Label>
        <Popover open={officePickerOpen} onOpenChange={setOfficePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              id="dispatch-office"
              variant="outline"
              role="combobox"
              aria-expanded={officePickerOpen}
              className="w-full justify-between font-normal"
            >
              <span className={cn("truncate", !selectedOffice && "text-muted-foreground")}>
                {selectedOffice?.name ?? "Select office"}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search destination offices..." />
              <CommandList>
                <CommandEmpty>No matching office.</CommandEmpty>
                <CommandGroup>
                  {destinations.map((office) => (
                    <CommandItem
                      key={office.id}
                      value={[office.name, office.code, office.location, office.keywords].join(" ")}
                      onSelect={() => {
                        setTarget(office.id);
                        setOfficePickerOpen(false);
                      }}
                    >
                      <Check
                        className={cn("size-4", target === office.id ? "opacity-100" : "opacity-0")}
                        aria-hidden
                      />
                      {office.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="dispatch-purpose">Purpose</Label>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0"
            onClick={() => setPurposeDialogOpen(true)}
          >
            <Plus className="size-3.5" /> Add purpose
          </Button>
        </div>
        {savedPurposes.length ? (
          <Select
            value={selectedPurpose}
            onValueChange={(id) => {
              const selected = savedPurposes.find((item) => item.id === id);
              setSelectedPurpose(id);
              setPurpose(selected?.name ?? "");
            }}
          >
            <SelectTrigger aria-label="Saved purpose">
              <SelectValue placeholder="Choose a saved purpose" />
            </SelectTrigger>
            <SelectContent>
              {savedPurposes.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Input
          id="dispatch-purpose"
          value={purpose}
          onChange={(e) => {
            setPurpose(e.target.value);
            setSelectedPurpose("");
          }}
          placeholder="Or type a purpose"
        />
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {canComplete ? (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await setStatus(doc.id, "completed");
                  toast.success(`${doc.trackingCode} marked completed.`);
                  onOpenChange(false);
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Could not complete document.";
                  onError?.(message);
                  toast.error(message);
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? "Saving…" : "Mark completed"}
            </Button>
          ) : null}
          <Button
            disabled={
              pending ||
              !target ||
              target === doc.currentOfficeId ||
              !offices.some((office) => office.active && office.id === target)
            }
            onClick={async () => {
              setPending(true);
              try {
                await dispatchDocument(doc.id, target, purpose || undefined, doc.updatedAt);
                toast.success(`Dispatched to ${officeName(target)}.`);
                onSuccess?.(target);
                onOpenChange(false);
              } catch (error) {
                const message = error instanceof Error ? error.message : "Dispatch failed.";
                onError?.(message);
                toast.error(message);
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Dispatching…" : "Confirm dispatch"}
          </Button>
        </DialogFooter>
        <Dialog open={purposeDialogOpen} onOpenChange={setPurposeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add purpose</DialogTitle>
              <DialogDescription>
                This purpose will be available only in your office's dispatch dropdown.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="new-routing-purpose">Purpose</Label>
              <Input
                id="new-routing-purpose"
                value={newPurpose}
                onChange={(event) => setNewPurpose(event.target.value)}
                placeholder="For review and approval"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void addPurpose();
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPurposeDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!newPurpose.trim() || savingPurpose}
                onClick={() => void addPurpose()}
              >
                Add purpose
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentActions({ doc }: { doc: TrackedDocument }) {
  const { session, receiveDocument, setStatus, voidDocument, fileDocument } = useApp();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [location, setLocation] = useState("");
  const owner = session && (session.role === "admin" || session.officeId === doc.currentOfficeId);
  const canProcess = owner && session?.role !== "receiving";
  const canComplete = session?.officeId === doc.currentOfficeId && session.role !== "receiving";
  const active = !["in_transit", "completed", "filed", "voided"].includes(doc.status);
  const receive = doc.status === "in_transit" && doc.nextOfficeId === session?.officeId;
  const run = async (action: () => Promise<void>, message: string) => {
    if (pending) return;
    setPending(true);
    try {
      await action();
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="min-w-0 space-y-3">
      {receive ? (
        <Button
          disabled={pending}
          onClick={() => void run(() => receiveDocument(doc.id), "Document received.")}
        >
          Receive document
        </Button>
      ) : null}
      {owner && active ? (
        <>
          <Label htmlFor="action-remarks">Remarks / return reason</Label>
          <Input id="action-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          {doc.status === "registered" ? (
            <Button
              variant="destructive"
              disabled={pending || !remarks.trim()}
              onClick={() => {
                if (window.confirm(`Void ${doc.trackingCode}? This cannot be undone.`))
                  void run(() => voidDocument(doc.id, remarks.trim()), "Document voided.");
              }}
            >
              Void document
            </Button>
          ) : null}
          <Button disabled={pending || doc.status === "on_hold"} onClick={() => setOpen(true)}>
            Dispatch
          </Button>
          {canProcess ? (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending || doc.status === "in_process"}
                onClick={() =>
                  void run(() => setStatus(doc.id, "in_process", remarks), "Processing resumed.")
                }
              >
                In process / resume
              </Button>
              <Button
                disabled={pending || !remarks.trim() || doc.status === "on_hold"}
                onClick={() =>
                  void run(() => setStatus(doc.id, "on_hold", remarks), "Placed on hold.")
                }
              >
                Hold
              </Button>
              <Button
                disabled={pending || !remarks.trim() || doc.currentOfficeId === doc.originOfficeId}
                onClick={() => {
                  if (
                    window.confirm(
                      `Return ${doc.trackingCode} to ${officeName(doc.originOfficeId)}?`,
                    )
                  )
                    void run(
                      () => setStatus(doc.id, "returned", remarks),
                      "Return dispatched; awaiting receipt at origin.",
                    );
                }}
              >
                Return to origin
              </Button>
              <Button
                disabled={pending || !canComplete || doc.status === "on_hold"}
                onClick={() => {
                  if (window.confirm(`Mark ${doc.trackingCode} completed?`))
                    void run(() => setStatus(doc.id, "completed", remarks), "Document completed.");
                }}
              >
                Mark completed
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
      {canProcess && doc.status === "completed" ? (
        <>
          <Label htmlFor="file-location">File location</Label>
          <Input
            id="file-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <Button
            disabled={pending || location.trim().length < 2}
            onClick={() =>
              void run(() => fileDocument(doc.id, location.trim()), "Document archived.")
            }
          >
            File to archives
          </Button>
        </>
      ) : null}
      {doc.status === "filed" ? <p>Archived at {doc.fileLocation}.</p> : null}
      <DispatchDialog
        key={`${doc.id}-${doc.updatedAt}`}
        doc={doc}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
