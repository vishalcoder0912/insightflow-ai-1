import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { FileSpreadsheet, CheckCircle2, AlertCircle, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useDataset } from "@/shared/data/DataContext";

type UploadStatus = "queued" | "uploading" | "success" | "error";

interface UploadItem {
  id: string;
  name: string;
  status: UploadStatus;
  error?: string;
}

function StatusBadge({ status, error }: { status: UploadStatus; error?: string }) {
  if (status === "uploading") {
    return (
      <span className="flex items-center gap-1 text-muted-foreground text-xs">
        <Loader2 className="w-3 h-3 animate-spin" />
        Uploading...
      </span>
    );
  }

  if (status === "success") {
    return (
      <span className="flex items-center gap-1 text-chart-emerald text-xs">
        <CheckCircle2 className="w-3 h-3" />
        Done
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="flex items-center gap-1 text-destructive text-xs" title={error}>
        <AlertCircle className="w-3 h-3" />
        Failed
      </span>
    );
  }

  return <span className="text-xs text-muted-foreground">Queued</span>;
}

export default function UploadPage() {
  const { parsed, fileName, uploadDataset, clearData, isLoading } = useDataset();
  const navigate = useNavigate();
  const [globalError, setGlobalError] = useState("");
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const isUploading = useMemo(
    () => uploads.some((upload) => upload.status === "uploading"),
    [uploads],
  );

  const successCount = useMemo(
    () => uploads.filter((upload) => upload.status === "success").length,
    [uploads],
  );

  const setStatus = (id: string, patch: Partial<UploadItem>) =>
    setUploads((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );

  const removeUpload = (id: string) =>
    setUploads((prev) => prev.filter((item) => item.id !== id));

  const clearAll = () => {
    setUploads([]);
    setGlobalError("");
    void clearData();
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const [file] = acceptedFiles;
      if (!file) return;

      setGlobalError("");

      const queued = {
        id: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        status: "queued" as const,
      };

      setUploads([queued]);

      try {
        setStatus(queued.id, { status: "uploading" });
        const csv = await file.text();
        await uploadDataset({ fileName: file.name, csv });
        setStatus(queued.id, { status: "success" });
        navigate("/");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to upload CSV file.";
        setStatus(queued.id, { status: "error", error: message });
        setGlobalError(message);
      }
    },
    [navigate, uploadDataset],
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    multiple: false,
    maxSize: 20 * 1024 * 1024,
  });

  useEffect(() => {
    if (!fileRejections.length) return;

    const messages = fileRejections.map(
      ({ file, errors }) => `${file.name}: ${errors.map((error) => error.message).join(", ")}`,
    );
    setGlobalError(messages.join(" | "));
  }, [fileRejections]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Upload Dataset</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload one CSV file to replace the current dataset and analyze it.
          </p>
        </div>
        <div className="flex gap-2">
          {uploads.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear all
            </Button>
          )}
          <Button asChild variant="secondary">
            <Link to="/">Analysis Data</Link>
          </Button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div
          {...getRootProps()}
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors dropzone-shell ${
            isDragActive
              ? "dropzone-active border-primary/60 bg-primary/5"
              : "border-border/60 hover:border-primary/40"
          }`}
        >
          <input {...getInputProps()} />

          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
            <FileSpreadsheet className="w-8 h-8 text-primary" />
          </div>

          <p className="text-sm text-foreground font-medium">
            {isLoading || isUploading
              ? "Uploading file..."
              : isDragActive
                ? "Drop your CSV file here"
                : "Drag and drop a CSV file, or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Max 20 MB per file | CSV only | One active dataset at a time
          </p>

          {(isLoading || isUploading) && (
            <div className="mt-5 h-1.5 w-full bg-border/60 rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-primary animate-progress" />
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence initial={false}>
        {uploads.length > 0 && (
          <motion.div
            key="upload-list"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>
                {successCount} of {uploads.length} file uploaded
              </span>
              {!isUploading && (
                <button onClick={clearAll} className="hover:text-foreground transition-colors">
                  Clear list
                </button>
              )}
            </div>

            {uploads.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  {item.status === "error" && item.error && (
                    <p className="text-xs text-destructive mt-0.5 truncate" title={item.error}>
                      {item.error}
                    </p>
                  )}
                </div>

                <StatusBadge status={item.status} error={item.error} />

                {item.status !== "uploading" && (
                  <button
                    onClick={() => removeUpload(item.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors ml-1"
                    aria-label={`Remove ${item.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {parsed && !isUploading && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">
                Preview - <span className="text-muted-foreground font-normal">{fileName}</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {parsed.headers.length} columns | {parsed.totalRows.toLocaleString()} rows
              </p>
            </div>

            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="overflow-auto max-h-[380px]">
                <table className="w-full data-grid">
                  <thead>
                    <tr className="bg-muted/50 sticky top-0">
                      {parsed.headers.map((header, index) => (
                        <th
                          key={index}
                          className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 50).map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="border-t border-border hover:bg-muted/30 transition-colors"
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="px-3 py-1.5 text-xs text-secondary-foreground whitespace-nowrap max-w-[200px] truncate"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Showing first {Math.min(parsed.rows.length, 50)} rows
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {globalError && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{globalError}</span>
            <button
              onClick={() => setGlobalError("")}
              className="ml-auto hover:opacity-70 transition-opacity"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
