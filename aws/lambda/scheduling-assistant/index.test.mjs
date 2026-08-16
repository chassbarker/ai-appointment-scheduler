import test from "node:test";
import assert from "node:assert/strict";

import { handler } from "./index.mjs";

test("accepts a valid scheduling message", async () => {
  const response = await handler({
    requestContext: {
      http: {
        method: "POST",
      },
    },
    body: JSON.stringify({
      message: "Book a dental appointment tomorrow at 2 PM",
    }),
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    success: true,
    message: "Scheduling request received",
  });
});

test("rejects an empty scheduling message", async () => {
  const response = await handler({
    requestContext: {
      http: {
        method: "POST",
      },
    },
    body: JSON.stringify({
      message: "   ",
    }),
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), {
    error: "A scheduling message is required",
  });
});

test("rejects malformed JSON", async () => {
  const response = await handler({
    requestContext: {
      http: {
        method: "POST",
      },
    },
    body: "{invalid-json}",
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), {
    error: "Request body must contain valid JSON",
  });
});

test("rejects unsupported HTTP methods", async () => {
  const response = await handler({
    requestContext: {
      http: {
        method: "GET",
      },
    },
  });

  assert.equal(response.statusCode, 405);
  assert.deepEqual(JSON.parse(response.body), {
    error: "Method not allowed",
  });
});
