import { methodNotAllowed } from "../utils/http.js";
import { chatController } from "../controllers/chatController.js";

export const chatRoute = async (req, res) => {
  if (req.method === "POST") {
    return chatController.post(req, res);
  }

  return methodNotAllowed(res, ["POST"]);
};
