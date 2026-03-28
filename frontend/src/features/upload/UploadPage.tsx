import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle, Loader, Upload } from "lucide-react";
import { useDataset } from "@/shared/data/DataContext";
import { datasetApi } from "@/shared/services/api";

export default function UploadPage() {
  const navigate = useNavigate();
  const { setDataset } = useDataset();
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a CSV file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const csv = await file.text();
      const dataset = await datasetApi.upload({
        fileName: file.name,
        csv,
      });

      setDataset(dataset);
      setSuccess(true);

      window.setTimeout(() => {
        navigate("/");
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      void handleFile(file);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="space-y-6">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative cursor-pointer rounded-lg border-2 border-dashed p-12 transition-colors ${
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleFile(file);
                }
              }}
            />

            <div className="space-y-3 text-center">
              {loading ? (
                <Loader className="mx-auto h-8 w-8 animate-spin text-primary" />
              ) : success ? (
                <CheckCircle className="mx-auto h-8 w-8 text-green-500" />
              ) : (
                <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
              )}

              <div>
                <p className="font-semibold text-foreground">
                  {loading ? "Uploading..." : success ? "Success!" : "Drop CSV here"}
                </p>
                <p className="text-sm text-muted-foreground">or click to select a file</p>
              </div>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </motion.div>
          )}

          <div className="space-y-2 rounded-lg bg-muted p-4 text-sm">
            <p className="text-muted-foreground">
              <strong>Supported:</strong> CSV files up to 10MB
            </p>
            <p className="text-muted-foreground">
              <strong>Format:</strong> Headers in first row
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
