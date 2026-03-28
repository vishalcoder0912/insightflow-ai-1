import {
  createDataset,
  getDataset as getDatasetRecord,
  deleteDataset,
  getCurrentDataset as getCurrentDatasetRecord,
} from "../models/datasetModel.js";
import { connectToDatabase } from "./database.js";

export const saveDataset = async (dataset) => {
  try {
    await connectToDatabase();

    const existing = await getCurrentDatasetRecord();
    if (existing?.id) {
      await deleteDataset(existing.id);
    }

    return await createDataset(dataset);
  } catch (error) {
    console.error("Error saving dataset:", error);
    throw new Error("Failed to save dataset to database");
  }
};

export const readDataset = async () => {
  try {
    await connectToDatabase();

    const record = await getCurrentDatasetRecord();
    if (!record) {
      return null;
    }

    return {
      id: String(record.id),
      fileName: record.fileName,
      uploadedAt: record.uploadedAt,
      headers: record.headers,
      rows: record.rows,
      totalRows: record.totalRows,
      previewRows: record.previewRows,
      summary: record.summary,
    };
  } catch (error) {
    console.error("Error reading dataset:", error);
    throw new Error("Failed to read dataset from database");
  }
};

export const readDatasetById = async (datasetId) => {
  try {
    await connectToDatabase();

    const record = await getDatasetRecord(datasetId);
    if (!record) {
      return null;
    }

    return {
      id: String(record.id),
      fileName: record.fileName,
      uploadedAt: record.uploadedAt,
      headers: record.headers,
      rows: record.rows,
      totalRows: record.totalRows,
      previewRows: record.previewRows,
      summary: record.summary,
      records: record.records,
    };
  } catch (error) {
    console.error("Error reading dataset by id:", error);
    throw new Error("Failed to read dataset from database");
  }
};

export const clearDataset = async () => {
  try {
    await connectToDatabase();

    const existing = await getCurrentDatasetRecord();
    if (existing?.id) {
      await deleteDataset(existing.id);
    }
  } catch (error) {
    console.error("Error clearing dataset:", error);
    throw new Error("Failed to clear dataset from database");
  }
};
