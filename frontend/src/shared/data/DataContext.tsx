import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { datasetApi } from "@/shared/services/api";
import type { DatasetRecord } from "@/shared/types/dataset";

interface DataContextType {
  dataset: DatasetRecord | null;
  loading: boolean;
  error: string | null;
  setDataset: (dataset: DatasetRecord) => void;
  clearDataset: () => Promise<void>;
  refreshDataset: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<DatasetRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshDataset = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await datasetApi.getCurrent();
      setDataset(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dataset");
      setDataset(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshDataset();
  }, []);

  const clearDataset = async () => {
    try {
      await datasetApi.clear();
      setDataset(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear dataset");
    }
  };

  return (
    <DataContext.Provider
      value={{
        dataset,
        loading,
        error,
        setDataset,
        clearDataset,
        refreshDataset,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useDataset() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useDataset must be used within DataProvider");
  }

  return context;
}
