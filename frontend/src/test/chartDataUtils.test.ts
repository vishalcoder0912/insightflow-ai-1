import { describe, expect, it } from "vitest";
import { normalizeLabelDatasetChart, normalizeRechartsRows, validateDataset } from "@/charts/chartDataUtils";

describe("chartDataUtils", () => {
  it("returns dataset invalid for empty datasets", () => {
    expect(validateDataset([])).toEqual({ error: "Dataset invalid or empty" });
  });

  it("aligns mismatched labels and dataset lengths", () => {
    const result = normalizeLabelDatasetChart({
      labels: ["USA", "India", "UK"],
      datasets: [{ data: [10, "20"] }],
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result).toEqual([
      { name: "USA", value: 10 },
      { name: "India", value: 20 },
    ]);
  });

  it("converts invalid numeric values to zero and skips empty output", () => {
    const result = normalizeRechartsRows(
      [
        { country: "USA", salary_usd: "100" },
        { country: "India", salary_usd: null },
        { country: "UK", salary_usd: "bad" },
      ],
      "country",
      "salary_usd",
      "bar",
    );

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result).toEqual([
      { country: "USA", salary_usd: 100 },
      { country: "India", salary_usd: 0 },
      { country: "UK", salary_usd: 0 },
    ]);
  });

  it("returns no data when pie values normalize to zero", () => {
    const result = normalizeRechartsRows(
      [{ name: "A", value: null }],
      "name",
      "value",
      "pie",
    );

    expect(result).toEqual({ error: "No data available for selected chart" });
  });
});
