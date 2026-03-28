import { saveDataset, readDataset, readDatasetById, clearDataset } from "../storage/datasetStore.js";
import { parseCsv, summarizeDataset } from "../utils/csv.js";

const previewLimit = 100;

export const storeDataset = async ({ csv, fileName }) => {
  try {
    const parsed = parseCsv(csv);
    const summary = summarizeDataset(parsed);

    const dataset = {
      id: "current",
      fileName,
      uploadedAt: new Date().toISOString(),
      headers: parsed.headers,
      rows: parsed.rows,
      totalRows: parsed.totalRows,
      previewRows: parsed.rows.slice(0, previewLimit),
      summary,
    };

    await saveDataset(dataset);

    return {
      id: dataset.id,
      fileName: dataset.fileName,
      uploadedAt: dataset.uploadedAt,
      headers: dataset.headers,
      totalRows: dataset.totalRows,
      previewRows: dataset.previewRows,
      summary: dataset.summary,
    };
  } catch (error) {
    console.error("Error storing dataset:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to store dataset");
  }
};

export const getCurrentDataset = async () => {
  try {
    const dataset = await readDataset();

    if (!dataset) {
      return null;
    }

    return {
      id: dataset.id,
      fileName: dataset.fileName,
      uploadedAt: dataset.uploadedAt,
      headers: dataset.headers,
      totalRows: dataset.totalRows,
      previewRows: dataset.previewRows,
      summary: dataset.summary,
    };
  } catch (error) {
    console.error("Error reading dataset:", error);
    return null;
  }
};

export const getDatasetForAnalysis = async () => {
  try {
    return await readDataset();
  } catch (error) {
    console.error("Error reading dataset for analysis:", error);
    return null;
  }
};

export const getDatasetForAnalysisById = async (datasetId) => {
  try {
    return await readDatasetById(datasetId);
  } catch (error) {
    console.error("Error reading dataset by id for analysis:", error);
    return null;
  }
};

export const removeCurrentDataset = async () => {
  try {
    await clearDataset();
  } catch (error) {
    console.error("Error clearing dataset:", error);
    throw new Error("Failed to remove dataset");
  }
};
