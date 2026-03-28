import { methodNotAllowed, notFound } from "../utils/http.js";
import { healthController } from "../controllers/healthController.js";
import { datasetController } from "../controllers/datasetController.js";
import { chatController } from "../controllers/chatController.js";

const routes = {
  "/health": {
    GET: healthController,
  },
  "/api/datasets": {
    POST: datasetController.upload,
  },
  "/api/datasets/current": {
    GET: datasetController.getCurrent,
    DELETE: datasetController.delete,
  },
  "/api/chat": {
    POST: chatController,
  },
};

export const handleRoute = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const routeHandlers = routes[url.pathname];

  if (!routeHandlers) {
    return notFound(res);
  }

  const handler = routeHandlers[req.method];

  if (!handler) {
    return methodNotAllowed(res, Object.keys(routeHandlers));
  }

  return handler(req, res);
};
