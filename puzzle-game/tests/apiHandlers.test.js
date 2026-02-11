import test from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import healthHandler from "../api/health.js";
import todayHandler from "../api/puzzle/today.js";
import submitHandler from "../api/puzzle/submit.js";
import progressIndexHandler from "../api/progress/index.js";
import progressSaveHandler from "../api/progress/save.js";
import truecallerStartHandler from "../api/auth/truecaller/start.js";
import { getSolutionForDate } from "../shared/dailyPuzzle.js";

function createMockReq({ method = "GET", query = {}, body = null, readable = false } = {}) {
  return {
    method,
    query,
    body,
    readable,
    on() {},
  };
}

function createMockRes() {
  const headers = {};

  return {
    statusCode: 200,
    body: "",
    headers,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = value;
    },
    end(payload) {
      this.body = payload ?? "";
    },
  };
}

async function invoke(handler, requestOptions) {
  const req = createMockReq(requestOptions);
  const res = createMockRes();
  await handler(req, res);
  const payload = res.body ? JSON.parse(res.body) : {};
  return { statusCode: res.statusCode, payload };
}

test("GET /api/puzzle/today returns puzzle payload", async () => {
  const result = await invoke(todayHandler, { method: "GET" });
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.ok, true);
  assert.ok(result.payload.puzzle);
  assert.equal(result.payload.puzzle.size, 4);
});

test("GET /api/health returns API reachable even without database url", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    const result = await invoke(healthHandler, { method: "GET" });
    assert.equal(result.statusCode, 200);
    assert.equal(result.payload.ok, true);
    assert.equal(result.payload.apiReachable, true);
    assert.equal(result.payload.databaseConfigured, false);
    assert.equal(result.payload.databaseConnected, false);
  } finally {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  }
});

test("POST /api/puzzle/submit validates and scores solved grid without DB", async () => {
  const puzzleDate = "2026-02-11";
  const answers = getSolutionForDate(puzzleDate);
  const result = await invoke(submitHandler, {
    method: "POST",
    body: {
      puzzleDate,
      answers,
      hintsUsed: 1,
      elapsedSeconds: 30,
    },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.ok, true);
  assert.equal(result.payload.solved, true);
  assert.equal(result.payload.score, 89);
  assert.equal(result.payload.persisted, false);
});

test("POST /api/puzzle/submit rejects invalid puzzleDate", async () => {
  const result = await invoke(submitHandler, {
    method: "POST",
    body: {
      puzzleDate: "not-a-date",
      answers: [],
    },
  });

  assert.equal(result.statusCode, 400);
  assert.equal(result.payload.ok, false);
});

test("GET /api/progress requires userId query", async () => {
  const result = await invoke(progressIndexHandler, {
    method: "GET",
    query: {},
  });

  assert.equal(result.statusCode, 400);
  assert.equal(result.payload.error, "userId is required");
});

test("GET /api/progress returns empty history when DB is not configured", async () => {
  const result = await invoke(progressIndexHandler, {
    method: "GET",
    query: { userId: "guest_test" },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.ok, true);
  assert.equal(result.payload.persisted, false);
  assert.deepEqual(result.payload.history, []);
});

test("POST /api/progress/save returns persisted false when DB is not configured", async () => {
  const result = await invoke(progressSaveHandler, {
    method: "POST",
    body: { userId: "guest_test", puzzleDate: "2026-02-11" },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.ok, true);
  assert.equal(result.payload.persisted, false);
});

test("POST /api/auth/truecaller/start returns authorizeUrl when client id exists", async () => {
  const previousClientId = process.env.TRUECALLER_CLIENT_ID;
  process.env.TRUECALLER_CLIENT_ID = "truecaller_test_client";

  try {
    const result = await invoke(truecallerStartHandler, {
      method: "POST",
      body: {
        redirectUri: "http://localhost:5173/auth/callback",
      },
    });

    assert.equal(result.statusCode, 200);
    assert.ok(result.payload.authorizeUrl);
    assert.ok(result.payload.authorizeUrl.includes("client_id=truecaller_test_client"));
  } finally {
    if (previousClientId === undefined) {
      delete process.env.TRUECALLER_CLIENT_ID;
    } else {
      process.env.TRUECALLER_CLIENT_ID = previousClientId;
    }
  }
});
