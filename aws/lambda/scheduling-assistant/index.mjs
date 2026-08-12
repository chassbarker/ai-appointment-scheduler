function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event = {}) {
  const method =
    event.requestContext?.http?.method ??
    event.httpMethod ??
    "UNKNOWN";

  if (method !== "POST") {
    return createResponse(405, {
      error: "Method not allowed",
    });
  }

  let requestBody;

  try {
    requestBody =
      typeof event.body === "string"
        ? JSON.parse(event.body)
        : event.body;
  } catch {
    return createResponse(400, {
      error: "Request body must contain valid JSON",
    });
  }

  const message = requestBody?.message;

  if (typeof message !== "string" || message.trim() === "") {
    return createResponse(400, {
      error: "A scheduling message is required",
    });
  }

  return createResponse(200, {
    success: true,
    message: "Scheduling request received",
  });
}
