import { badRequest, json, readJsonBody } from "../utils/http.js";
import { processChatMessage } from "../services/chatService.js";

const post = async (req, res) => {
  try {
    const body = await readJsonBody(req);

    if (!body.message || typeof body.message !== "string") {
      return badRequest(res, "Missing or invalid message field");
    }

    if (body.message.trim().length === 0) {
      return badRequest(res, "Message cannot be empty");
    }

    const result = await processChatMessage({
      datasetId: typeof body.datasetId === "string" ? body.datasetId : undefined,
      message: body.message.trim(),
      history: Array.isArray(body.history) ? body.history : [],
    });

    return json(res, 200, result);
  } catch (error) {
    console.error("Chat error:", error);
    return json(res, 500, {
      error: error instanceof Error ? error.message : "Chat request failed",
    });
  }
};

export const chatController = {
  post,
};
