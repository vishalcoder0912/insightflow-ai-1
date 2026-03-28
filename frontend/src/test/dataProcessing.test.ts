import { describe, expect, it } from "vitest";
import { buildPredictionSeries, groupByYear, groupCounts, toDatasetRows } from "@/data-processing/datasetTransforms";
import { detectDatasetPatterns } from "@/ai-engine/patternEngine";
import { runLocalDatasetQuery } from "@/ai-engine/queryEngine";
import type { DatasetRecord } from "@/shared/types/dataset";

const dataset: DatasetRecord = {
  id: "dataset-1",
  fileName: "catalog.csv",
  uploadedAt: "2026-03-25T00:00:00.000Z",
  headers: ["release_year", "type", "country", "rating"],
  totalRows: 6,
  previewRows: [
    ["2020", "Movie", "India", "PG"],
    ["2020", "Movie", "India", "PG"],
    ["2021", "Series", "US", "PG-13"],
    ["2022", "Movie", "India", "PG"],
    ["2023", "Movie", "India", "PG"],
    ["2023", "Series", "US", "PG-13"],
  ],
  summary: {
    rowCount: 6,
    columnCount: 4,
    columns: [
      { name: "release_year", filled: 6, unique: 4, sampleValues: ["2020"], numeric: true, min: 2020, max: 2023, average: 2021.5, sum: 12129 },
      { name: "type", filled: 6, unique: 2, sampleValues: ["Movie"], numeric: false },
      { name: "country", filled: 6, unique: 2, sampleValues: ["India"], numeric: false },
      { name: "rating", filled: 6, unique: 2, sampleValues: ["PG"], numeric: false },
    ],
    kpis: [],
    insights: [],
    chartSuggestions: [],
  },
};

const patternDataset: DatasetRecord = {
  ...dataset,
  previewRows: [
    ["2020", "Movie", "India", "PG"],
    ["2021", "Movie", "India", "PG"],
    ["2021", "Movie", "India", "PG"],
    ["2022", "Movie", "India", "PG"],
    ["2022", "Movie", "India", "PG"],
    ["2022", "Movie", "India", "PG"],
    ["2023", "Movie", "India", "PG"],
    ["2023", "Movie", "India", "PG"],
    ["2023", "Movie", "India", "PG"],
    ["2023", "Series", "US", "PG-13"],
  ],
  totalRows: 10,
  summary: {
    ...dataset.summary,
    rowCount: 10,
    columns: [
      { name: "release_year", filled: 10, unique: 4, sampleValues: ["2020"], numeric: true, min: 2020, max: 2023, average: 2021.8, sum: 20218 },
      { name: "type", filled: 10, unique: 2, sampleValues: ["Movie"], numeric: false },
      { name: "country", filled: 10, unique: 2, sampleValues: ["India"], numeric: false },
      { name: "rating", filled: 10, unique: 2, sampleValues: ["PG"], numeric: false },
    ],
  },
};

describe("datasetTransforms", () => {
  it("groups rows by year without mutating structure", () => {
    const rows = toDatasetRows(dataset);
    expect(groupByYear(rows, "release_year")).toEqual([
      { year: 2020, value: 2 },
      { year: 2021, value: 1 },
      { year: 2022, value: 1 },
      { year: 2023, value: 2 },
    ]);
  });

  it("builds prediction chart output for future years", () => {
    const result = buildPredictionSeries(
      [
        { year: 2020, value: 2 },
        { year: 2021, value: 3 },
        { year: 2022, value: 4 },
      ],
      2,
    );

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.labels).toEqual(["2020", "2021", "2022", "2023", "2024"]);
    expect(result.datasets[0]?.data).toEqual([2, 3, 4, null, null]);
    expect(result.datasets[1]?.data.slice(0, 3)).toEqual([null, null, null]);
  });

  it("counts categories with pure reusable output", () => {
    const rows = toDatasetRows(dataset);
    expect(groupCounts(rows, "type")).toEqual([
      { label: "Movie", value: 4 },
      { label: "Series", value: 2 },
    ]);
  });
});

describe("ai engines", () => {
  it("detects dominance and trend patterns", () => {
    const result = detectDatasetPatterns(patternDataset, ["release_year", "type"]);
    expect(Array.isArray(result)).toBe(true);
    if (!Array.isArray(result)) return;
    expect(result.some((pattern) => pattern.type === "trend")).toBe(true);
    expect(result.some((pattern) => pattern.type === "dominance")).toBe(true);
  });

  it("builds a fallback chat response from the query engine", () => {
    const result = runLocalDatasetQuery("show type distribution", dataset);
    expect(result.chart).not.toBeNull();
    expect(result.meta?.derivedFrom).toBe("client_side_rule_engine");
    expect(result.dataset.headers).toEqual(dataset.headers);
  });
});
