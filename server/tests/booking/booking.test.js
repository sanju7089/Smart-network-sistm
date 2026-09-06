import test from "node:test";
import assert from "node:assert/strict";

import "../../tests/helpers/test-env.js";

const BOOKING_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled"
];

const CUSTOMER_TRANSITIONS = {
  pending: ["cancelled"],
  accepted: ["confirmed", "cancelled"],
  confirmed: ["cancelled"]
};

const WORKER_TRANSITIONS = {
  pending: ["accepted", "rejected", "cancelled"],
  accepted: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed"]
};

function getAllowedNextStatuses(role, currentStatus) {
  if (!BOOKING_STATUSES.includes(currentStatus)) {
    return [];
  }

  if (role === "admin") {
    return [...BOOKING_STATUSES];
  }

  if (role === "customer") {
    return CUSTOMER_TRANSITIONS[currentStatus] || [];
  }

  if (role === "worker") {
    return WORKER_TRANSITIONS[currentStatus] || [];
  }

  return [];
}

test("booking status list contains all supported states", () => {
  assert.deepEqual(
    BOOKING_STATUSES,
    [
      "pending",
      "accepted",
      "rejected",
      "confirmed",
      "in_progress",
      "completed",
      "cancelled"
    ]
  );
});

test("customer can cancel a pending booking", () => {
  assert.deepEqual(
    getAllowedNextStatuses("customer", "pending"),
    ["cancelled"]
  );
});

test("customer can confirm an accepted booking", () => {
  assert.deepEqual(
    getAllowedNextStatuses("customer", "accepted"),
    ["confirmed", "cancelled"]
  );
});

test("customer cannot move a booking directly to completed", () => {
  const allowed = getAllowedNextStatuses(
    "customer",
    "accepted"
  );

  assert.equal(
    allowed.includes("completed"),
    false
  );
});

test("worker can accept a pending booking", () => {
  const allowed = getAllowedNextStatuses(
    "worker",
    "pending"
  );

  assert.equal(
    allowed.includes("accepted"),
    true
  );
});

test("worker can reject a pending booking", () => {
  const allowed = getAllowedNextStatuses(
    "worker",
    "pending"
  );

  assert.equal(
    allowed.includes("rejected"),
    true
  );
});

test("worker can move confirmed booking to in_progress", () => {
  assert.deepEqual(
    getAllowedNextStatuses(
      "worker",
      "confirmed"
    ),
    ["in_progress", "cancelled"]
  );
});

test("worker can complete an in-progress booking", () => {
  assert.deepEqual(
    getAllowedNextStatuses(
      "worker",
      "in_progress"
    ),
    ["completed"]
  );
});

test("worker cannot complete a pending booking", () => {
  const allowed = getAllowedNextStatuses(
    "worker",
    "pending"
  );

  assert.equal(
    allowed.includes("completed"),
    false
  );
});

test("unknown role cannot change booking status", () => {
  assert.deepEqual(
    getAllowedNextStatuses(
      "unknown",
      "pending"
    ),
    []
  );
});

test("unknown booking status cannot transition", () => {
  assert.deepEqual(
    getAllowedNextStatuses(
      "worker",
      "unknown"
    ),
    []
  );
});

test("admin can manage supported booking statuses", () => {
  assert.deepEqual(
    getAllowedNextStatuses(
      "admin",
      "pending"
    ),
    BOOKING_STATUSES
  );
});

test("cancelled booking has no normal customer transitions", () => {
  assert.deepEqual(
    getAllowedNextStatuses(
      "customer",
      "cancelled"
    ),
    []
  );
});

test("completed booking has no normal worker transitions", () => {
  assert.deepEqual(
    getAllowedNextStatuses(
      "worker",
      "completed"
    ),
    []
  );
});
