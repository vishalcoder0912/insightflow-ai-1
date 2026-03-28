import { useMemo } from "react";
import DashboardView from "@/features/dashboard/analyst-dashboard/Dashboard.jsx";
import { buildDashboardData } from "@/features/dashboard/buildDashboardData";
import { useDataset } from "@/shared/data/DataContext";

export default function DashboardPage() {
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
