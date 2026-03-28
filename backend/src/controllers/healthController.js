import { json } from "../utils/http.js";

export const healthController = async (req, res) => {
  json(res, 200, {
    status: "ok",
    timestamp: new Date().toISOString(),
  });
};
