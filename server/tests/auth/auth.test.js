import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

import "../helpers/test-env.js";

test("JWT secret is available", () => {
  assert.ok(process.env.JWT_SECRET);
  assert.ok(process.env.JWT_SECRET.length >= 32);
});

test("JWT token can be created", () => {
  const payload = {
    id: "000000000000000000000001",
    role: "customer"
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1h",
    issuer: "smart-work-network",
    audience: "smart-work-network-client"
  });

  assert.equal(typeof token, "string");
  assert.ok(token.length > 20);
});

test("valid JWT can be verified", () => {
  const payload = {
    id: "000000000000000000000001",
    role: "customer"
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1h",
    issuer: "smart-work-network",
    audience: "smart-work-network-client"
  });

  const decoded = jwt.verify(
    token,
    process.env.JWT_SECRET,
    {
      issuer: "smart-work-network",
      audience: "smart-work-network-client"
    }
  );

  assert.equal(decoded.id, payload.id);
  assert.equal(decoded.role, payload.role);
});

test("JWT with wrong secret is rejected", () => {
  const token = jwt.sign(
    {
      id: "000000000000000000000001",
      role: "customer"
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
      issuer: "smart-work-network",
      audience: "smart-work-network-client"
    }
  );

  assert.throws(() => {
    jwt.verify(
      token,
      "wrong-test-secret-that-must-not-work",
      {
        issuer: "smart-work-network",
        audience: "smart-work-network-client"
      }
    );
  });
});

test("JWT with wrong issuer is rejected", () => {
  const token = jwt.sign(
    {
      id: "000000000000000000000001",
      role: "customer"
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
      issuer: "wrong-issuer",
      audience: "smart-work-network-client"
    }
  );

  assert.throws(() => {
    jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        issuer: "smart-work-network",
        audience: "smart-work-network-client"
      }
    );
  });
});

test("JWT with wrong audience is rejected", () => {
  const token = jwt.sign(
    {
      id: "000000000000000000000001",
      role: "customer"
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
      issuer: "smart-work-network",
      audience: "wrong-audience"
    }
  );

  assert.throws(() => {
    jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        issuer: "smart-work-network",
        audience: "smart-work-network-client"
      }
    );
  });
});
