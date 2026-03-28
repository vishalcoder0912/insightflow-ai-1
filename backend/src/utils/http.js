export const json = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
};

export const sendEmpty = (res, statusCode) => {
  res.writeHead(statusCode);
  res.end();
};

export const notFound = (res) => {
  json(res, 404, { error: "Not Found" });
};

export const methodNotAllowed = (res, allowedMethods) => {
  res.writeHead(405, {
    "Content-Type": "application/json; charset=utf-8",
    Allow: allowedMethods.join(", "),
  });
  res.end(JSON.stringify({ error: "Method Not Allowed" }));
};

export const badRequest = (res, message) => {
  json(res, 400, { error: message || "Bad Request" });
};

export const readJsonBody = async (req) => {
  const chunks = [];

  try {
    for await (const chunk of req) {
      chunks.push(chunk);
    }

    if (chunks.length === 0) {
      return {};
    }

    const raw = Buffer.concat(chunks).toString("utf8");
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON in request body");
  }
};

export const requireMethod = (req, allowedMethods) => {
  if (!allowedMethods.includes(req.method)) {
    return { valid: false, allowedMethods };
  }

  return { valid: true };
};

export const requireContentType = (req, expectedType) => {
  const contentType = req.headers["content-type"];
  if (!contentType || !contentType.includes(expectedType)) {
    return { valid: false, message: `Expected Content-Type: ${expectedType}` };
  }

  return { valid: true };
};
