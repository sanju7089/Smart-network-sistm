function getData(result) {
  if (!result) return [];

  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result.data)) {
    return result.data;
  }

  return [];
}

function escapeDashboardHtml(value = "") {
  if (typeof window.escapeHtml === "function") {
    return window.escapeHtml(value);
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function fetchApiData(path) {
  const response = await apiFetch(path);

  let result = {};

  try {
    result = await response.json();
  } catch {
    result = {};
  }

  if (!response.ok || result.success === false) {
    throw new Error(
      result.message || `API request failed: ${path}`
    );
  }

  return result;
}

function showDashboardError(element, message) {
  element.innerHTML = `
    <div class="notice">
      ${escapeDashboardHtml(message)}
    </div>
  `;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function getJobStatus(job) {
  return String(job?.status || "open").toLowerCase();
}

function getBookingStatus(booking) {
  return String(booking?.status || "pending").toLowerCase();
}

function createStatCard(number, label) {
  return `
    <div class="card">
      <div class="stat">
        ${escapeDashboardHtml(String(number))}
      </div>
      <p>${escapeDashboardHtml(label)}</p>
    </div>
  `;
}

function createStatusCard(label, count) {
  return `
    <div class="card">
      <div class="stat">
        ${formatNumber(count)}
      </div>
      <p>${escapeDashboardHtml(label)}</p>
    </div>
  `;
}

async function loadCustomerDashboard(element, user) {
  const [jobsResult, bookingsResult] =
    await Promise.all([
      fetchApiData(
        `/jobs?customerId=${encodeURIComponent(user.id)}`
      ),
      fetchApiData("/bookings")
    ]);

  const jobs = getData(jobsResult);
  const bookings = getData(bookingsResult);

  const activeJobs = jobs.filter((job) =>
    ["open", "active"].includes(getJobStatus(job))
  );

  const closedJobs = jobs.filter((job) =>
    ["closed", "completed", "cancelled"].includes(
      getJobStatus(job)
    )
  );

  const activeBookings = bookings.filter((booking) =>
    !["completed", "cancelled", "rejected"].includes(
      getBookingStatus(booking)
    )
  );

  const completedBookings = bookings.filter(
    (booking) =>
      getBookingStatus(booking) === "completed"
  );

  element.innerHTML = `
    <div class="row between">
      <div>
        <h1>Customer Dashboard</h1>
        <p class="lead">
          Manage your work requests and bookings.
        </p>
      </div>

      <a
        class="btn btn-primary"
        href="find-help.html"
      >
        Post New Work
      </a>
    </div>

    <div class="grid2">

      ${createStatusCard(
        "My Work Requests",
        jobs.length
      )}

      ${createStatusCard(
        "Active Work",
        activeJobs.length
      )}

      ${createStatusCard(
        "Active Bookings",
        activeBookings.length
      )}

      ${createStatusCard(
        "Completed Bookings",
        completedBookings.length
      )}

    </div>

    <br>

    <div class="row">

      <a
        class="btn"
        href="bookings.html"
      >
        View My Bookings
      </a>

      <a
        class="btn"
        href="find-work.html"
      >
        View Work Requests
      </a>

    </div>

    ${
      closedJobs.length
        ? `
          <br>
          <div class="notice">
            ${closedJobs.length} closed/completed work request(s).
          </div>
        `
        : ""
    }
  `;
}

async function loadWorkerDashboard(element) {
  const [jobsResult, bookingsResult] =
    await Promise.all([
      fetchApiData("/jobs?status=open"),
      fetchApiData("/bookings")
    ]);

  const jobs = getData(jobsResult);

  const bookings = getData(bookingsResult);

  const pendingBookings = bookings.filter(
    (booking) =>
      getBookingStatus(booking) === "pending"
  );

  const activeBookings = bookings.filter((booking) =>
    ["accepted", "confirmed", "in_progress"].includes(
      getBookingStatus(booking)
    )
  );

  const completedBookings = bookings.filter(
    (booking) =>
      getBookingStatus(booking) === "completed"
  );

  element.innerHTML = `
    <div class="row between">

      <div>
        <h1>Worker Dashboard</h1>

        <p class="lead">
          Manage available work and your bookings.
        </p>
      </div>

      <a
        class="btn btn-primary"
        href="find-work.html"
      >
        Find Work
      </a>

    </div>

    <div class="grid2">

      ${createStatusCard(
        "Available Requests",
        jobs.length
      )}

      ${createStatusCard(
        "Pending Requests",
        pendingBookings.length
      )}

      ${createStatusCard(
        "Active Bookings",
        activeBookings.length
      )}

      ${createStatusCard(
        "Completed Work",
        completedBookings.length
      )}

    </div>

    <br>

    <div class="row">

      <a
        class="btn btn-primary"
        href="bookings.html"
      >
        Manage My Bookings
      </a>

      <a
        class="btn"
        href="find-work.html"
      >
        Explore Available Work
      </a>

    </div>

    <br>

    <div class="notice">
      Earnings will be shown here after the payment and worker payout system is connected securely.
    </div>
  `;
}

async function loadAdminDashboard(element) {
  const [
    usersResult,
    jobsResult,
    bookingsResult,
    paymentsResult
  ] = await Promise.all([
    fetchApiData("/users"),
    fetchApiData("/jobs"),
    fetchApiData("/bookings"),
    fetchApiData("/payments")
  ]);

  const users = getData(usersResult);
  const jobs = getData(jobsResult);
  const bookings = getData(bookingsResult);
  const payments = getData(paymentsResult);

  const paidRevenue = payments
    .filter(
      (payment) =>
        String(payment.status).toLowerCase() ===
        "paid"
    )
    .reduce(
      (total, payment) =>
        total + Number(payment.amount || 0),
      0
    );

  element.innerHTML = `
    <h1>Admin Control Center</h1>

    <div class="grid">

      ${createStatusCard("Users", users.length)}

      ${createStatusCard("Jobs", jobs.length)}

      ${createStatusCard(
        "Bookings",
        bookings.length
      )}

      <div class="card">
        <div class="stat">
          ₹${formatNumber(paidRevenue)}
        </div>

        <p>Paid Revenue</p>
      </div>

    </div>

    <br>

    <div class="notice">
      Live data loaded from the backend.
    </div>
  `;
}

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    const element = document.querySelector(
      "#dashboardContent"
    );

    if (!element) return;

    const fileName = location.pathname
      .split("/")
      .pop();

    let user = null;

    if (fileName === "customer-dashboard.html") {
      user = protect("customer");
    } else if (
      fileName === "worker-dashboard.html"
    ) {
      user = protect("worker");
    } else {
      user = protect("admin");
    }

    if (!user) return;

    element.innerHTML = `
      <div class="notice">
        Loading dashboard...
      </div>
    `;

    try {
      if (
        fileName ===
        "customer-dashboard.html"
      ) {
        await loadCustomerDashboard(
          element,
          user
        );
      } else if (
        fileName ===
        "worker-dashboard.html"
      ) {
        await loadWorkerDashboard(element);
      } else {
        await loadAdminDashboard(element);
      }
    } catch (error) {
      console.error(
        "DASHBOARD LOAD ERROR:",
        error
      );

      showDashboardError(
        element,
        error.message ||
          "Unable to load live dashboard data."
      );
    }
  }
);
