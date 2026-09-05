"use strict";

/*
 * Smart Work Network
 * Worker Listing + Worker Detail
 *
 * Central API:
 * window.SWN.request()
 *
 * Supported:
 * - Search
 * - Service filter
 * - Location filter
 * - Availability filter
 * - Verification filter
 * - Pagination
 * - Worker detail
 * - Skills
 * - Availability
 * - Booking link
 */

(function () {

  const state = {
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
    loading: false
  };


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


  function getQueryParams() {

    return new URLSearchParams(
      window.location.search
    );
  }


  function getJobId() {

    return String(
      getQueryParams().get("jobId") || ""
    ).trim();
  }


  function getWorkerId() {

    return String(
      getQueryParams().get("id") || ""
    ).trim();
  }


  function apiRequest(
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


  function getElement(id) {

    return document.getElementById(id);
  }


  function getFilterValue(id) {

    const element = getElement(id);

    if (!element) {
      return "";
    }

    return String(
      element.value || ""
    ).trim();
  }


  function readFilters() {

    return {
      search:
        getFilterValue(
          "workerSearch"
        ),

      service:
        getFilterValue(
          "workerService"
        ),

      location:
        getFilterValue(
          "workerLocation"
        ),

      available:
        getFilterValue(
          "workerAvailability"
        ),

      verified:
        getFilterValue(
          "workerVerified"
        )
    };
  }


  function buildWorkersEndpoint() {

    const filters =
      readFilters();

    const params =
      new URLSearchParams();

    if (filters.search) {
      params.set(
        "search",
        filters.search
      );
    }

    if (filters.service) {
      params.set(
        "service",
        filters.service
      );
    }

    if (filters.location) {
      params.set(
        "location",
        filters.location
      );
    }

    if (filters.available) {
      params.set(
        "available",
        filters.available
      );
    }

    if (filters.verified) {
      params.set(
        "verified",
        filters.verified
      );
    }

    params.set(
      "page",
      String(state.page)
    );

    params.set(
      "limit",
      String(state.limit)
    );

    return `/workers?${params.toString()}`;
  }


  function extractWorkers(result) {

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


  function extractPagination(
    result,
    workerCount
  ) {

    if (
      result &&
      result.pagination
    ) {
      return {
        page:
          Number(
            result.pagination.page
          ) || 1,

        limit:
          Number(
            result.pagination.limit
          ) || state.limit,

        total:
          Number(
            result.pagination.total
          ) || 0,

        totalPages:
          Math.max(
            1,
            Number(
              result.pagination.totalPages
            ) || 1
          ),

        hasNextPage:
          result.pagination.hasNextPage === true,

        hasPreviousPage:
          result.pagination.hasPreviousPage === true
      };
    }

    const total =
      workerCount || 0;

    return {
      page: state.page,
      limit: state.limit,
      total,
      totalPages:
        Math.max(
          1,
          Math.ceil(
            total / state.limit
          )
        ),
      hasNextPage: false,
      hasPreviousPage:
        state.page > 1
    };
  }


  function normalizeSkills(
    skills
  ) {

    if (!Array.isArray(skills)) {
      return [];
    }

    const seen =
      new Set();

    return skills
      .map(
        skill =>
          String(
            skill ?? ""
          ).trim()
      )
      .filter(Boolean)
      .filter(skill => {

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


  function renderSkills(
    skills
  ) {

    const normalized =
      normalizeSkills(skills);

    if (!normalized.length) {
      return `
        <span class="worker-skill">
          Skills not specified
        </span>
      `;
    }

    return `
      <div class="worker-skills">
        ${normalized
          .map(
            skill => `
              <span class="worker-skill">
                ${escapeWorkerHtml(
                  skill
                )}
              </span>
            `
          )
          .join("")}
      </div>
    `;
  }


  function renderVerifiedBadge(
    verified
  ) {

    if (verified === true) {
      return `
        <span class="worker-badge verified">
          Verified
        </span>
      `;
    }

    return `
      <span class="worker-badge">
        Verification Pending
      </span>
    `;
  }


  function renderAvailabilityBadge(
    available
  ) {

    if (available === true) {
      return `
        <span class="worker-badge available">
          Available
        </span>
      `;
    }

    return `
      <span class="worker-badge unavailable">
        Currently Unavailable
      </span>
    `;
  }


  function makeProfileUrl(
    workerId
  ) {

    const params =
      new URLSearchParams();

    params.set(
      "id",
      String(workerId)
    );

    const jobId =
      getJobId();

    if (jobId) {
      params.set(
        "jobId",
        jobId
      );
    }

    return `worker-profile.html?${params.toString()}`;
  }


  function makeCheckoutUrl(
    workerId
  ) {

    const params =
      new URLSearchParams();

    params.set(
      "workerId",
      String(workerId)
    );

    const jobId =
      getJobId();

    if (jobId) {
      params.set(
        "jobId",
        jobId
      );
    }

    return `checkout.html?${params.toString()}`;
  }


  function renderBookingButton(
    worker
  ) {

    const workerId =
      worker?._id ||
      worker?.id;

    if (!workerId) {
      return "";
    }

    if (
      worker.isAvailable !== true
    ) {
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

    return `
      <a
        class="btn btn-primary"
        href="${escapeWorkerHtml(
          makeCheckoutUrl(
            workerId
          )
        )}"
      >
        Book Worker
      </a>
    `;
  }


  function renderWorkerCard(
    worker
  ) {

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

          ${renderVerifiedBadge(
            worker.verified
          )}

          ${renderAvailabilityBadge(
            worker.isAvailable
          )}

        </div>

        <h3>
          ${escapeWorkerHtml(
            name
          )}
        </h3>

        <p class="muted">
          ${escapeWorkerHtml(
            service
          )}
          •
          ${escapeWorkerHtml(
            location
          )}
        </p>

        <p>
          <strong>
            Experience:
          </strong>
          ${escapeWorkerHtml(
            experience
          )}
        </p>

        ${renderSkills(
          worker.skills
        )}

        <div class="worker-actions">

          <a
            class="btn"
            href="${escapeWorkerHtml(
              makeProfileUrl(
                workerId
              )
            )}"
          >
            View Profile
          </a>

          ${renderBookingButton(
            worker
          )}

        </div>

      </article>
    `;
  }


  function renderList(
    workers
  ) {

    const list =
      getElement(
        "workersList"
      );

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

    list.innerHTML =
      workers
        .map(
          renderWorkerCard
        )
        .filter(Boolean)
        .join("");
  }


  function renderSummary() {

    const title =
      getElement(
        "workersResultsTitle"
      );

    const summary =
      getElement(
        "workersResultsSummary"
      );

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
      (
        (state.page - 1) *
        state.limit
      ) + 1;

    const end =
      Math.min(
        state.page *
          state.limit,
        state.total
      );

    summary.textContent =
      `Showing ${start}-${end} of ${state.total}`;
  }


  function renderPagination() {

    const pagination =
      getElement(
        "workerPagination"
      );

    const previous =
      getElement(
        "workerPrevious"
      );

    const next =
      getElement(
        "workerNext"
      );

    const pageInfo =
      getElement(
        "workerPageInfo"
      );

    if (
      !pagination ||
      !previous ||
      !next ||
      !pageInfo
    ) {
      return;
    }

    pagination.hidden =
      state.total <= state.limit;

    pageInfo.textContent =
      `Page ${state.page} of ${state.totalPages}`;

    previous.disabled =
      state.page <= 1;

    next.disabled =
      state.page >=
      state.totalPages;
  }


  async function loadWorkers() {

    const list =
      getElement(
        "workersList"
      );

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
          buildWorkersEndpoint()
        );

      const workers =
        extractWorkers(result);

      const pagination =
        extractPagination(
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

      renderList(
        workers
      );

      renderSummary();

      renderPagination();

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

      const summary =
        getElement(
          "workersResultsSummary"
        );

      if (summary) {
        summary.textContent =
          "Unable to load workers.";
      }

    } finally {

      state.loading = false;
    }
  }


  function resetFilters() {

    const form =
      getElement(
        "workerSearchForm"
      );

    if (form) {
      form.reset();
    }

    state.page = 1;

    loadWorkers();
  }


  function submitSearch(
    event
  ) {

    event.preventDefault();

    state.page = 1;

    loadWorkers();
  }


  function previousPage() {

    if (
      state.page <= 1 ||
      state.loading
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
      state.page >=
      state.totalPages ||
      state.loading
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


  function renderWorkerDetail(
    worker
  ) {

    const detail =
      getElement(
        "workerDetail"
      );

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

          ${renderVerifiedBadge(
            worker.verified
          )}

          ${renderAvailabilityBadge(
            worker.isAvailable
          )}

        </div>

        <h1>
          ${escapeWorkerHtml(
            name
          )}
        </h1>

        <p class="lead">
          ${escapeWorkerHtml(
            service
          )}
        </p>

        <p>
          <strong>
            Location:
          </strong>
          ${escapeWorkerHtml(
            location
          )}
        </p>

        <p>
          <strong>
            Experience:
          </strong>
          ${escapeWorkerHtml(
            experience
          )}
        </p>

        <section>

          <h3>
            Skills
          </h3>

          ${renderSkills(
            worker.skills
          )}

        </section>

        <section>

          <h3>
            About
          </h3>

          <p>
            ${escapeWorkerHtml(
              bio
            )}
          </p>

        </section>

        <section>

          <h3>
            Contact
          </h3>

          <p>
            ${escapeWorkerHtml(
              phone
            )}
          </p>

        </section>

        <div class="worker-actions">

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
  }


  async function loadWorkerDetail() {

    const detail =
      getElement(
        "workerDetail"
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

      const result =
        await apiRequest(
          `/workers/${encodeURIComponent(
            workerId
          )}`
        );

      const worker =
        extractWorker(result);

      renderWorkerDetail(
        worker
      );

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


  function initializeWorkers() {

    const list =
      getElement(
        "workersList"
      );

    const detail =
      getElement(
        "workerDetail"
      );

    if (list) {

      const form =
        getElement(
          "workerSearchForm"
        );

      const reset =
        getElement(
          "resetWorkerFilters"
        );

      const previous =
        getElement(
          "workerPrevious"
        );

      const next =
        getElement(
          "workerNext"
        );

      if (form) {
        form.addEventListener(
          "submit",
          submitSearch
        );
      }

      if (reset) {
        reset.addEventListener(
          "click",
          resetFilters
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
      initializeWorkers
    );

  } else {

    initializeWorkers();
  }


  window.loadWorkers =
    loadWorkers;

  window.loadWorkerDetail =
    loadWorkerDetail;

})();
