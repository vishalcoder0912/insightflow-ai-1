import { useDataset } from "@/shared/data/DataContext";
import { Table, Database, Filter, ArrowUpDown, Download } from "lucide-react";
import { motion } from "framer-motion";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export default function ExplorerPage() {
  const { dataset } = useDataset();

  if (!dataset) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-background/50 backdrop-blur-sm">
        <div className="rounded-full bg-primary/10 p-4 mb-4 ring-1 ring-primary/20">
          <Database className="w-8 h-8 text-primary opacity-80" />
        </div>
        <h2 className="text-xl font-semibold text-foreground tracking-tight">No Dataset Available</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Upload a CSV or Excel file on the upload page to view and explore your data here.
        </p>
      </div>
    );
  }

  // Handle data fetching gracefully (only preview rows available client side)
  const rows = dataset.previewRows || [];
  const headers = dataset.headers || [];

  return (
    <div className="h-full flex flex-col p-6 space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Table className="w-6 h-6 text-primary" />
            Data Explorer
          </h1>
          <p className="text-sm text-muted-foreground mt-1 text-balance">
            View up to 100 sample rows from your uploaded dataset.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => window.open(`${API_BASE_URL}/api/export/csv`, "_blank")}
            className="bg-primary text-primary-foreground border border-primary rounded-md px-3 py-1.5 flex items-center gap-2 text-sm shadow-sm hover:opacity-90 transition-opacity"
            title="Download full dataset as CSV"
          >
            <Download className="w-4 h-4" />
            <span className="font-medium">Export CSV</span>
          </button>
          <div className="bg-card border border-border rounded-md px-3 py-1.5 flex items-center gap-2 text-sm shadow-sm">
            <span className="font-medium text-foreground">{dataset.totalRows.toLocaleString()}</span>
            <span className="text-muted-foreground">Total Rows</span>
          </div>
          <div className="bg-card border border-border rounded-md px-3 py-1.5 flex items-center gap-2 text-sm shadow-sm">
            <span className="font-medium text-foreground">{headers.length}</span>
            <span className="text-muted-foreground">Columns</span>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border bg-muted/30 flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-background border border-border rounded text-xs text-muted-foreground shadow-sm">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter (Coming Soon)</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                {headers.map((header, idx) => (
                  <th key={idx} className="px-4 py-3 font-medium border-b border-border whitespace-nowrap group cursor-pointer hover:bg-muted/80 transition-colors">
                    <div className="flex items-center gap-1">
                      {header}
                      <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row, rowIndex) => (
                <motion.tr 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: rowIndex * 0.01 }}
                  key={rowIndex} 
                  className="hover:bg-muted/30 transition-colors"
                >
                  {headers.map((_, colIndex) => (
                    <td key={colIndex} className="px-4 py-2.5 whitespace-nowrap text-foreground/90 max-w-[200px] truncate" title={String(row[colIndex])}>
                      {row[colIndex] ?? <span className="text-muted-foreground/50 italic">null</span>}
                    </td>
                  ))}
                </motion.tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={headers.length} className="px-4 py-8 text-center text-muted-foreground bg-muted/10">
                    No data to display
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          
          {rows.length > 0 && (
            <div className="p-3 border-t border-border bg-muted/30 text-xs text-center text-muted-foreground">
              Showing top {rows.length} rows preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
