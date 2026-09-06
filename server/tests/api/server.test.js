import test from "node:test";
import assert from "node:assert/strict";

import "../../tests/helpers/test-env.js";
import app from "../../server.js";

async function startTestServer() {
  const server =
    app.listen(
      0,
      "127.0.0.1"
    );

  await new Promise(
    (resolve, reject) => {
      server.once(
        "listening",
        resolve
      );

      server.once(
        "error",
        reject
      );
    }
  );

  const address =
    server.address();

  assert.ok(address);
  assert.equal(
    typeof address,
    "object"
  );

  return {
    server,
    baseUrl:
      `http://127.0.0.1:${address.port}`
  };
}

async function stopTestServer(
  server
) {
  await new Promise(
    (resolve, reject) => {
      server.close(
        (error) => {
          if (error) {
            return reject(error);
          }

          resolve();
        }
      );
    }
  );
}

test(
  "API root responds successfully",
  async () => {
    const {
      server,
      baseUrl
    } =
      await startTestServer();

    try {
      const response =
        await fetch(
          `${baseUrl}/`
        );

      assert.equal(
        response.status,
        200
      );

      const data =
        await response.json();

      assert.equal(
        data.success,
        true
      );

      assert.equal(
        data.message,
        "Smart Work Network API is running"
      );

      assert.equal(
        data.version,
        "2.0.0"
      );
    } finally {
      await stopTestServer(
        server
      );
    }
  }
);

test(
  "authentication status endpoint responds successfully",
  async () => {
    const {
      server,
      baseUrl
    } =
      await startTestServer();

    try {
      const response =
        await fetch(
          `${baseUrl}/api/auth/status`
        );

      assert.equal(
        response.status,
        200
      );

      const data =
        await response.json();

      assert.equal(
        data.success,
        true
      );

      assert.equal(
        data.message,
        "Auth route is working."
      );
    } finally {
      await stopTestServer(
        server
      );
    }
  }
);

test(
  "unknown API route returns JSON 404",
  async () => {
    const {
      server,
      baseUrl
    } =
      await startTestServer();

    try {
      const response =
        await fetch(
          `${baseUrl}/api/this-route-does-not-exist`
        );

      assert.equal(
        response.status,
        404
      );

      const data =
        await response.json();

      assert.equal(
        data.success,
        false
      );

      assert.equal(
        typeof data.message,
        "string"
      );

      assert.ok(
        data.message.length > 0
      );
    } finally {
      await stopTestServer(
        server
      );
    }
  }
);

test(
  "health endpoint correctly reports database state",
  async () => {
    const {
      server,
      baseUrl
    } =
      await startTestServer();

    try {
      const response =
        await fetch(
          `${baseUrl}/api/health`
        );

      assert.ok(
        response.status === 200 ||
        response.status === 503
      );

      const data =
        await response.json();

      assert.equal(
        typeof data.success,
        "boolean"
      );

      assert.ok(
        data.status === "healthy" ||
        data.status === "unhealthy"
      );

      assert.equal(
        data.application,
        "Smart Work Network API"
      );

      assert.ok(
        data.database
      );
    } finally {
      await stopTestServer(
        server
      );
    }
  }
);
