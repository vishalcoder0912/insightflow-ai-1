import { badRequest, json, readJsonBody } from "../utils/http.js";
import {
  getCurrentDataset,
  removeCurrentDataset,
  storeDataset,
} from "../services/datasetService.js";

export const upload = async (req, res) => {
  try {
    const body = await readJsonBody(req);

    if (!body.fileName || typeof body.fileName !== "string") {
      return badRequest(res, "Missing or invalid fileName");
    }

    if (!body.csv || typeof body.csv !== "string") {
      return badRequest(res, "Missing or invalid csv data");
    }

    if (body.csv.trim().length === 0) {
      return badRequest(res, "CSV data cannot be empty");
    }

    const dataset = await storeDataset({
      csv: body.csv,
      fileName: body.fileName,
    });

    json(res, 200, dataset);
  } catch (error) {
    console.error("Upload error:", error);
    json(res, 400, {
      error: error instanceof Error ? error.message : "Failed to upload dataset",
    });
  }
};

export const getCurrent = async (req, res) => {
  try {
    const dataset = await getCurrentDataset();
    json(res, 200, dataset);
  } catch (error) {
    console.error("Get dataset error:", error);
    json(res, 500, {
      error: error instanceof Error ? error.message : "Failed to get dataset",
    });
  }
};

export const deleteDataset = async (req, res) => {
  try {
    await removeCurrentDataset();
    json(res, 200, { success: true });
  } catch (error) {
    console.error("Delete dataset error:", error);
    json(res, 500, {
      error: error instanceof Error ? error.message : "Failed to delete dataset",
    });
  }
};

export const datasetController = {
  upload,
  getCurrent,
  delete: deleteDataset,
};
