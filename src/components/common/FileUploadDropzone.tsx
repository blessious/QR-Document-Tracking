import { useRef, useState } from "react";
import { FileText, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FileUploadItem {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
}

interface FileUploadDropzoneProps {
  id: string;
  files: FileUploadItem[];
  accept?: string;
  onFilesSelected: (files: File[]) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUploadDropzone({
  id,
  files,
  accept,
  onFilesSelected,
  onRemove,
  onClear,
}: FileUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const selectFiles = (fileList: FileList | File[]) => {
    const selectedFiles = Array.from(fileList);
    if (selectedFiles.length) onFilesSelected(selectedFiles);
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-lg border border-dashed p-5 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/20",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          selectFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          id={id}
          className="sr-only"
          type="file"
          accept={accept}
          multiple
          onChange={(event) => {
            if (event.target.files) selectFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Upload className="size-5" aria-hidden />
        </div>
        <p className="mt-3 text-sm font-medium">Drag and drop files here</p>
        <p className="mt-1 text-xs text-muted-foreground">or click to browse</p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" /> Browse files
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          PDF, Word, Excel, and image files. Up to 10 MB per file; no limit on the number of files.
        </p>
      </div>

      {files.length ? (
        <div className="rounded-lg border border-border bg-background">
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {files.length} {files.length === 1 ? "file" : "files"} selected
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              <Trash2 className="size-3.5" /> Clear all
            </Button>
          </div>
          <ul className="divide-y divide-border">
            {files.map((file) => (
              <li key={file.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <FileText className="size-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${file.fileName}`}
                  onClick={() => onRemove(file.id)}
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
