"use strict";

/*
 * Smart Work Network
 * Worker Listing + Worker Profile
 *
 * Uses the central SWN API client.
 * No direct GitHub changes are made by this code.
 */

function escapeWorkerHtml(value = "") {
  if (
    typeof window.escapeHtml ===
    "function"
  ) {
    return window.escapeHtml(value);
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getWorkerQuery() {
  return new URLSearchParams(
    window.location.search
  );
}

function getWorkerServiceFilter() {
  return String(
    getWorkerQuery().get("service") || ""
  ).trim();
}

function getJobId() {
  return String(
    getWorkerQuery().get("jobId") || ""
  ).trim();
}

function getWorkerId() {
  return String(
    getWorkerQuery().get("id") || ""
  ).trim();
}

function workerProfileUrl(workerId) {
  const cleanWorkerId =
    String(workerId || "").trim();

  if (!cleanWorkerId) {
    return "worker-profile.html";
  }

  const params =
    new URLSearchParams();

  params.set(
    "id",
    cleanWorkerId
  );

  const jobId = getJobId();

  if (jobId) {
    params.set(
      "jobId",
      jobId
    );
  }

  return `worker-profile.html?${params.toString()}`;
}

function checkoutUrl(workerId) {
  const cleanWorkerId =
    String(workerId || "").trim();

  if (!cleanWorkerId) {
    return "workers.html";
  }

  const params =
    new URLSearchParams();

  params.set(
    "workerId",
    cleanWorkerId
  );

  const jobId = getJobId();

  if (jobId) {
    params.set(
      "jobId",
      jobId
    );
  }

  return `checkout.html?${params.toString()}`;
}

function normalizeWorkerSkills(
  skills
) {
  if (!Array.isArray(skills)) {
    return [];
  }

  const seen = new Set();

  return skills
    .map((skill) =>
      String(skill ?? "").trim()
    )
    .filter(Boolean)
    .filter((skill) => {
      const key =
        skill.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    })
    .slice(0, 50);
}

function renderWorkerSkills(
  skills
) {
  const normalized =
    normalizeWorkerSkills(skills);

  if (!normalized.length) {
    return `
      <span class="tag">
        Skills not specified
      </span>
    `;
  }

  return `
    <div
      class="worker-skills"
      style="
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin:10px 0;
      "
    >
      ${normalized
        .map(
          (skill) => `
            <span
              class="tag"
              style="
                display:inline-flex;
                align-items:center;
              "
            >
              ${escapeWorkerHtml(skill)}
            </span>
          `
        )
        .join("")}
    </div>
  `;
}

function renderAvailabilityBadge(
  isAvailable
) {
  if (isAvailable === true) {
    return `
      <span
        class="tag"
        style="
          background:#e8f7ed;
          color:#176b35;
        "
      >
        Available
      </span>
    `;
  }

  return `
    <span
      class="tag"
      style="
        background:#fff0f0;
        color:#a51d2d;
      "
    >
      Currently Unavailable
    </span>
  `;
}

function renderBookingButton(
  worker
) {
  const id =
    worker?._id ||
    worker?.id;

  if (!id) {
    return "";
  }

  const isAvailable =
    worker.isAvailable === true;

  if (!isAvailable) {
    return `
      <button
        type="button"
        class="btn"
        disabled
        aria-disabled="true"
        title="This worker is currently unavailable for new bookings."
        style="
          opacity:.6;
          cursor:not-allowed;
        "
      >
        Currently Unavailable
      </button>
    `;
  }

  return `
    <a
      class="btn btn-primary"
      href="${escapeWorkerHtml(
        checkoutUrl(id)
      )}"
    >
      Book This Worker
    </a>
  `;
}

function renderWorkerCard(
  worker
) {
  if (!worker) {
    return "";
  }

  const id =
    worker._id ||
    worker.id;

  if (!id) {
    return "";
  }

  const name =
    escapeWorkerHtml(
      worker.name ||
      "Worker"
    );

  const service =
    escapeWorkerHtml(
      worker.service ||
      "General Service"
    );

  const location =
    escapeWorkerHtml(
      worker.location ||
      "Location not specified"
    );

  const experience =
    escapeWorkerHtml(
      worker.experience ||
      "Experience not specified"
    );

  const verifiedBadge =
    worker.verified === true
      ? `
        <span
          class="tag"
          style="
            background:#e8f7ed;
            color:#176b35;
          "
        >
          Verified
        </span>
      `
      : `
        <span class="tag">
          Verification Pending
        </span>
      `;

  return `
    <div class="card">

      <div
        style="
          display:flex;
          flex-wrap:wrap;
          gap:6px;
          margin-bottom:10px;
        "
      >
        ${verifiedBadge}

        ${renderAvailabilityBadge(
          worker.isAvailable
        )}
      </div>

      <h3>
        ${name}
      </h3>

      <p class="muted">
        ${service} • ${location}
      </p>

      <p>
        <b>Experience:</b>
        ${experience}
      </p>

      ${renderWorkerSkills(
        worker.skills
      )}

      <div
        style="
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin-top:12px;
        "
      >

        <a
          class="btn"
          href="${escapeWorkerHtml(
            workerProfileUrl(id)
          )}"
        >
          View Profile
        </a>

        ${renderBookingButton(
          worker
        )}

      </div>

    </div>
  `;
}

async function apiRequest(
  endpoint,
  options = {}
) {
  if (
    window.SWN &&
    typeof window.SWN.request ===
      "function"
  ) {
    return window.SWN.request(
      endpoint,
      options
    );
  }

  if (
    typeof window.apiFetch ===
    "function"
  ) {
    return window.apiFetch(
      endpoint,
      options
    );
  }

  throw new Error(
    "Central API client is not available."
  );
}

function extractWorkers(
  result
) {
  if (
    result &&
    Array.isArray(result.data)
  ) {
    return result.data;
  }

  if (
    result &&
    result.data &&
    Array.isArray(
      result.data.workers
    )
  ) {
    return result.data.workers;
  }

  if (
    result &&
    Array.isArray(result.workers)
  ) {
    return result.workers;
  }

  return [];
}

function extractWorker(
  result
) {
  if (
    result &&
    result.data &&
    result.data._id
  ) {
    return result.data;
  }

  if (
    result &&
    result.data &&
    result.data.worker
  ) {
    return result.data.worker;
  }

  if (
    result &&
    result.worker
  ) {
    return result.worker;
  }

  if (
    result &&
    result.profile
  ) {
    return result.profile;
  }

  return null;
}

async function loadWorkers() {
  const list =
    document.querySelector(
      "#workersList"
    );

  if (!list) {
    return;
  }

  list.innerHTML = `
    <div class="notice">
      Loading workers...
    </div>
  `;

  try {
    const service =
      getWorkerServiceFilter();

    const params =
      new URLSearchParams();

    if (service) {
      params.set(
        "service",
        service
      );
    }

    /*
     * Backend defaults to active,
     * completed and available workers.
     * We intentionally do not force
     * another availability filter here.
     */
    const query =
      params.toString();

    const endpoint =
      `/workers${
        query
          ? `?${query}`
          : ""
      }`;

    const result =
      await apiRequest(
        endpoint
      );

    const workers =
      extractWorkers(result);

    if (!workers.length) {
      list.innerHTML = `
        <div class="notice">
          No active workers found
          for this service.
        </div>
      `;

      return;
    }

    const cards =
      workers
        .map(
          renderWorkerCard
        )
        .filter(Boolean)
        .join("");

    list.innerHTML =
      cards ||
      `
        <div class="notice">
          No valid worker
          profiles found.
        </div>
      `;

  } catch (error) {
    console.error(
      "LOAD WORKERS ERROR:",
      error
    );

    list.innerHTML = `
      <div class="notice">
        ${escapeWorkerHtml(
          error?.message ||
          "Unable to load workers."
        )}
      </div>
    `;
  }
}

async function loadWorkerDetail() {
  const detail =
    document.querySelector(
      "#workerDetail"
    );

  if (!detail) {
    return;
  }

  const workerId =
    getWorkerId();

  if (!workerId) {
    detail.innerHTML = `
      <div class="notice">
        Worker ID is missing.
      </div>
    `;

    return;
  }

  detail.innerHTML = `
    <div class="notice">
      Loading worker profile...
    </div>
  `;

  try {
    const endpoint =
      `/workers/${encodeURIComponent(
        workerId
      )}`;

    const result =
      await apiRequest(
        endpoint
      );

    const worker =
      extractWorker(result);

    if (!worker) {
      throw new Error(
        "Worker not found."
      );
    }

    const id =
      worker._id ||
      worker.id;

    if (!id) {
      throw new Error(
        "Worker profile is invalid."
      );
    }

    const name =
      escapeWorkerHtml(
        worker.name ||
        "Worker"
      );

    const service =
      escapeWorkerHtml(
        worker.service ||
        "General Service"
      );

    const location =
      escapeWorkerHtml(
        worker.location ||
        "Location not specified"
      );

    const experience =
      escapeWorkerHtml(
        worker.experience ||
        "Not specified"
      );

    const bio =
      escapeWorkerHtml(
        worker.bio ||
        "No additional information provided."
      );

    const phone =
      escapeWorkerHtml(
        worker.phone ||
        "Available after booking"
      );

    const verifiedBadge =
      worker.verified === true
        ? `
          <span
            class="tag"
            style="
              background:#e8f7ed;
              color:#176b35;
            "
          >
            Verified Worker
          </span>
        `
        : `
          <span class="tag">
            Verification Pending
          </span>
        `;

    detail.innerHTML = `
      <div class="card">

        <div
          style="
            display:flex;
            flex-wrap:wrap;
            gap:6px;
            margin-bottom:12px;
          "
        >

          ${verifiedBadge}

          ${renderAvailabilityBadge(
            worker.isAvailable
          )}

        </div>

        <h1>
          ${name}
        </h1>

        <p class="lead">
          ${service}
        </p>

        <p>
          <b>Location:</b>
          ${location}
        </p>

        <p>
          <b>Experience:</b>
          ${experience}
        </p>

        <div
          style="
            margin:16px 0;
          "
        >
          <strong>
            Skills
          </strong>

          ${renderWorkerSkills(
            worker.skills
          )}
        </div>

        <p>
          <b>About:</b>
          ${bio}
        </p>

        <p>
          <b>Contact:</b>
          ${phone}
        </p>

        <div
          style="
            display:flex;
            flex-wrap:wrap;
            gap:8px;
            margin-top:16px;
          "
        >

          <a
            class="btn"
            href="workers.html"
          >
            Back to Workers
          </a>

          ${renderBookingButton(
            worker
          )}

        </div>

      </div>
    `;

  } catch (error) {
    console.error(
      "LOAD WORKER DETAIL ERROR:",
      error
    );

    detail.innerHTML = `
      <div class="notice">
        ${escapeWorkerHtml(
          error?.message ||
          "Unable to load worker profile."
        )}
      </div>
    `;
  }
}

function initializeWorkersPage() {
  const hasWorkerList =
    document.querySelector(
      "#workersList"
    );

  const hasWorkerDetail =
    document.querySelector(
      "#workerDetail"
    );

  if (hasWorkerList) {
    loadWorkers();
  }

  if (hasWorkerDetail) {
    loadWorkerDetail();
  }
}

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeWorkersPage
  );
} else {
  initializeWorkersPage();
}

window.loadWorkers =
  loadWorkers;

window.loadWorkerDetail =
  loadWorkerDetail;
