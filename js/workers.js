"use strict";

/*
==================================================
SMART WORK NETWORK
WORKERS SYSTEM — FINAL FRONTEND
==================================================

Supports:
- Worker listing
- Search
- Service filter
- Location filter
- Availability filter
- Verification filter
- Pagination
- Worker profile
- Booking navigation
- API error handling
- Central API client
- URL-safe worker IDs
==================================================
*/

(function () {
  const state = {
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
    loading: false
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    if (typeof window.escapeHtml === "function") {
      return window.escapeHtml(value);
    }

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function getWorkerId() {
    return String(getParams().get("id") || "").trim();
  }

  function getJobId() {
    return String(getParams().get("jobId") || "").trim();
  }

  async function apiRequest(endpoint, options = {}) {
    if (
      window.SWN &&
      typeof window.SWN.request === "function"
    ) {
      return window.SWN.request(endpoint, options);
    }

    if (typeof window.apiFetch === "function") {
      return window.apiFetch(endpoint, options);
    }

    throw new Error("API client is not available.");
  }

  function value(id) {
    const element = $(id);
    return element
      ? String(element.value || "").trim()
      : "";
  }

  function getFilters() {
    return {
      search: value("workerSearch"),
      service: value("workerService"),
      location: value("workerLocation"),
      available: value("workerAvailability"),
      verified: value("workerVerified")
    };
  }

  function buildEndpoint() {
    const filters = getFilters();
    const params = new URLSearchParams();

    if (filters.search) {
      params.set("search", filters.search);
    }

    if (filters.service) {
      params.set("service", filters.service);
    }

    if (filters.location) {
      params.set("location", filters.location);
    }

    if (filters.available) {
      params.set("available", filters.available);
    }

    if (filters.verified) {
      params.set("verified", filters.verified);
    }

    params.set("page", String(state.page));
    params.set("limit", String(state.limit));

    return `/workers?${params.toString()}`;
  }

  function getWorkersFromResponse(result) {
    if (result && Array.isArray(result.data)) {
      return result.data;
    }

    if (
      result &&
      result.data &&
      Array.isArray(result.data.workers)
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

  function getPagination(result, count) {
    const pagination =
      result && result.pagination
        ? result.pagination
        : null;

    if (pagination) {
      return {
        page:
          Number(pagination.page) || 1,

        limit:
          Number(pagination.limit) || state.limit,

        total:
          Number(pagination.total) || 0,

        totalPages:
          Math.max(
            1,
            Number(pagination.totalPages) || 1
          ),

        hasNextPage:
          pagination.hasNextPage === true,

        hasPreviousPage:
          pagination.hasPreviousPage === true
      };
    }

    return {
      page: state.page,
      limit: state.limit,
      total: count,
      totalPages:
        Math.max(
          1,
          Math.ceil(count / state.limit)
        ),
      hasNextPage: false,
      hasPreviousPage: state.page > 1
    };
  }

  function normalizeSkills(skills) {
    if (!Array.isArray(skills)) {
      return [];
    }

    const seen = new Set();

    return skills
      .map(skill =>
        String(skill ?? "").trim()
      )
      .filter(Boolean)
      .filter(skill => {
        const key = skill.toLowerCase();

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      })
      .slice(0, 30);
  }

  function renderSkills(skills) {
    const list = normalizeSkills(skills);

    if (!list.length) {
      return `
        <span class="worker-skill">
          Skills not specified
        </span>
      `;
    }

    return `
      <div class="worker-skills">
        ${list.map(skill => `
          <span class="worker-skill">
            ${escapeHtml(skill)}
          </span>
        `).join("")}
      </div>
    `;
  }

  function verifiedBadge(verified) {
    return verified === true
      ? `
        <span class="worker-badge verified">
          Verified
        </span>
      `
      : `
        <span class="worker-badge">
          Verification Pending
        </span>
      `;
  }

  function availabilityBadge(available) {
    return available === true
      ? `
        <span class="worker-badge available">
          Available
        </span>
      `
      : `
        <span class="worker-badge unavailable">
          Currently Unavailable
        </span>
      `;
  }

  function profileUrl(workerId) {
    const params = new URLSearchParams();

    params.set(
      "id",
      String(workerId)
    );

    const jobId = getJobId();

    if (jobId) {
      params.set("jobId", jobId);
    }

    return `worker-profile.html?${params.toString()}`;
  }

  function bookingUrl(workerId) {
    const params = new URLSearchParams();

    params.set(
      "workerId",
      String(workerId)
    );

    const jobId = getJobId();

    if (jobId) {
      params.set("jobId", jobId);
    }

    return `checkout.html?${params.toString()}`;
  }

  function bookingButton(worker) {
    const workerId =
      worker?._id ||
      worker?.id;

    if (!workerId) {
      return "";
    }

    if (worker.isAvailable !== true) {
      return `
        <button
          type="button"
          class="btn"
          disabled
          aria-disabled="true"
        >
          Currently Unavailable
        </button>
      `;
    }

    const jobId = getJobId();

    if (!jobId) {
      return `
        <a
          class="btn btn-primary"
          href="${escapeHtml(
            profileUrl(workerId)
          )}"
        >
          View Profile
        </a>
      `;
    }

    return `
      <a
        class="btn btn-primary"
        href="${escapeHtml(
          bookingUrl(workerId)
        )}"
      >
        Book Worker
      </a>
    `;
  }

  function workerCard(worker) {
    if (!worker) {
      return "";
    }

    const workerId =
      worker._id ||
      worker.id;

    if (!workerId) {
      return "";
    }

    const name =
      worker.name ||
      "Worker";

    const service =
      worker.service ||
      "General Service";

    const location =
      worker.location ||
      "Location not specified";

    const experience =
      worker.experience ||
      "Not specified";

    return `
      <article class="card worker-card">

        <div class="worker-card-badges">
          ${verifiedBadge(worker.verified)}
          ${availabilityBadge(worker.isAvailable)}
        </div>

        <h3>
          ${escapeHtml(name)}
        </h3>

        <p class="muted">
          ${escapeHtml(service)}
          •
          ${escapeHtml(location)}
        </p>

        <p>
          <strong>Experience:</strong>
          ${escapeHtml(experience)}
        </p>

        ${renderSkills(worker.skills)}

        <div class="worker-actions">

          <a
            class="btn"
            href="${escapeHtml(
              profileUrl(workerId)
            )}"
          >
            View Profile
          </a>

          ${bookingButton(worker)}

        </div>

      </article>
    `;
  }

  function renderWorkers(workers) {
    const list = $("workersList");

    if (!list) {
      return;
    }

    if (!workers.length) {
      list.innerHTML = `
        <div class="notice">
          No workers found matching
          your search and filters.
        </div>
      `;
      return;
    }

    list.innerHTML = workers
      .map(workerCard)
      .filter(Boolean)
      .join("");
  }

  function renderSummary() {
    const title =
      $("workersResultsTitle");

    const summary =
      $("workersResultsSummary");

    if (title) {
      title.textContent =
        state.total === 1
          ? "1 Worker Found"
          : `${state.total} Workers Found`;
    }

    if (!summary) {
      return;
    }

    if (!state.total) {
      summary.textContent =
        "Try another search or filter.";
      return;
    }

    const start =
      ((state.page - 1) * state.limit) + 1;

    const end =
      Math.min(
        state.page * state.limit,
        state.total
      );

    summary.textContent =
      `Showing ${start}-${end} of ${state.total}`;
  }

  function renderPagination() {
    const pagination =
      $("workerPagination");

    const previous =
      $("workerPrevious");

    const next =
      $("workerNext");

    const pageInfo =
      $("workerPageInfo");

    if (
      !pagination ||
      !previous ||
      !next ||
      !pageInfo
    ) {
      return;
    }

    pagination.hidden =
      state.totalPages <= 1;

    pageInfo.textContent =
      `Page ${state.page} of ${state.totalPages}`;

    previous.disabled =
      state.page <= 1;

    next.disabled =
      state.page >= state.totalPages;
  }

  async function loadWorkers() {
    const list = $("workersList");

    if (!list || state.loading) {
      return;
    }

    state.loading = true;

    list.innerHTML = `
      <div class="notice">
        Loading workers...
      </div>
    `;

    try {
      const result =
        await apiRequest(
          buildEndpoint()
        );

      const workers =
        getWorkersFromResponse(result);

      const pagination =
        getPagination(
          result,
          workers.length
        );

      state.page =
        pagination.page;

      state.limit =
        pagination.limit;

      state.total =
        pagination.total;

      state.totalPages =
        pagination.totalPages;

      renderWorkers(workers);
      renderSummary();
      renderPagination();

    } catch (error) {
      console.error(
        "WORKERS LOAD ERROR:",
        error
      );

      list.innerHTML = `
        <div class="notice">
          ${escapeHtml(
            error?.message ||
            "Unable to load workers."
          )}
        </div>
      `;

      const summary =
        $("workersResultsSummary");

      if (summary) {
        summary.textContent =
          "Unable to load workers.";
      }

    } finally {
      state.loading = false;
    }
  }

  function searchWorkers(event) {
    if (event) {
      event.preventDefault();
    }

    state.page = 1;
    loadWorkers();
  }

  function resetWorkers() {
    const form =
      $("workerSearchForm");

    if (form) {
      form.reset();
    }

    state.page = 1;
    loadWorkers();
  }

  function previousPage() {
    if (
      state.loading ||
      state.page <= 1
    ) {
      return;
    }

    state.page -= 1;

    loadWorkers();

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function nextPage() {
    if (
      state.loading ||
      state.page >= state.totalPages
    ) {
      return;
    }

    state.page += 1;

    loadWorkers();

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function getWorkerFromResponse(result) {
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

    return null;
  }

  function renderWorkerDetail(worker) {
    const detail =
      $("workerDetail");

    if (!detail) {
      return;
    }

    if (!worker) {
      detail.innerHTML = `
        <div class="notice">
          Worker not found.
        </div>
      `;
      return;
    }

    const workerId =
      worker._id ||
      worker.id;

    if (!workerId) {
      detail.innerHTML = `
        <div class="notice">
          Invalid worker profile.
        </div>
      `;
      return;
    }

    const name =
      worker.name ||
      "Worker";

    const service =
      worker.service ||
      "General Service";

    const location =
      worker.location ||
      "Location not specified";

    const phone =
      worker.phone ||
      "Available after booking";

    const experience =
      worker.experience ||
      "Not specified";

    const bio =
      worker.bio ||
      "No additional information provided.";

    detail.innerHTML = `
      <div class="card">

        <div class="worker-card-badges">
          ${verifiedBadge(worker.verified)}
          ${availabilityBadge(worker.isAvailable)}
        </div>

        <h1>
          ${escapeHtml(name)}
        </h1>

        <p class="lead">
          ${escapeHtml(service)}
        </p>

        <p>
          <strong>Location:</strong>
          ${escapeHtml(location)}
        </p>

        <p>
          <strong>Experience:</strong>
          ${escapeHtml(experience)}
        </p>

        <section>
          <h3>Skills</h3>
          ${renderSkills(worker.skills)}
        </section>

        <section>
          <h3>About</h3>
          <p>
            ${escapeHtml(bio)}
          </p>
        </section>

        <section>
          <h3>Contact</h3>
          <p>
            ${escapeHtml(phone)}
          </p>
        </section>

        <div class="worker-actions">

          <a
            class="btn"
            href="workers.html"
          >
            Back to Workers
          </a>

          ${bookingButton(worker)}

        </div>

      </div>
    `;
  }

  async function loadWorkerDetail() {
    const detail =
      $("workerDetail");

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
      const result =
        await apiRequest(
          `/workers/${encodeURIComponent(workerId)}`
        );

      const worker =
        getWorkerFromResponse(result);

      renderWorkerDetail(worker);

    } catch (error) {
      console.error(
        "WORKER DETAIL ERROR:",
        error
      );

      detail.innerHTML = `
        <div class="notice">
          ${escapeHtml(
            error?.message ||
            "Unable to load worker profile."
          )}
        </div>
      `;
    }
  }

  function initialize() {
    const list =
      $("workersList");

    const detail =
      $("workerDetail");

    if (list) {
      const form =
        $("workerSearchForm");

      const reset =
        $("resetWorkerFilters");

      const previous =
        $("workerPrevious");

      const next =
        $("workerNext");

      if (form) {
        form.addEventListener(
          "submit",
          searchWorkers
        );
      }

      if (reset) {
        reset.addEventListener(
          "click",
          resetWorkers
        );
      }

      if (previous) {
        previous.addEventListener(
          "click",
          previousPage
        );
      }

      if (next) {
        next.addEventListener(
          "click",
          nextPage
        );
      }

      loadWorkers();
    }

    if (detail) {
      loadWorkerDetail();
    }
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }

  window.loadWorkers =
    loadWorkers;

  window.loadWorkerDetail =
    loadWorkerDetail;

})();
