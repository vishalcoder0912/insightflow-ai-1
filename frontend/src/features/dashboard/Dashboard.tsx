import { useMemo } from "react";
import DashboardView from "./analyst-dashboard/Dashboard.jsx";
import { useDataset } from "@/shared/data/DataContext";
import { buildDashboardData } from "./buildDashboardData";

export default function Dashboard() {
  const { dataset, loading } = useDataset();

  const dashboardData = useMemo(() => buildDashboardData(dataset), [dataset]);

  return (
    <DashboardView
      data={dashboardData}
      loading={loading}
      title={dataset?.fileName || "CSV Analytics Dashboard"}
      description={
        dataset
          ? `${dashboardData.length} records available for visualization`
          : "Upload a CSV file with category/value fields to begin analysis"
      }
    />
  );
}
