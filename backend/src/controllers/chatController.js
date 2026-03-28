import { badRequest, json, readJsonBody } from "../utils/http.js";
import { getDatasetForAnalysis } from "../services/datasetService.js";
import { generateDatasetAnswer } from "../services/geminiService.js";

export const chatController = async (req, res) => {
  try {
    const dataset = await getDatasetForAnalysis();

    if (!dataset) {
      return badRequest(res, "Upload a dataset before starting chat");
    }

    const body = await readJsonBody(req);

    if (!body.message || typeof body.message !== "string") {
      return badRequest(res, "Missing or invalid message field");
    }

    if (body.message.trim().length === 0) {
      return badRequest(res, "Message cannot be empty");
    }

    const result = await generateDatasetAnswer({
      dataset,
      question: body.message,
    });

    json(res, 200, {
      ...result,
      dataset: {
        fileName: dataset.fileName,
        totalRows: dataset.totalRows,
        headers: dataset.headers,
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    json(res, 500, {
      error: error instanceof Error ? error.message : "Chat request failed",
    });
  }
};
