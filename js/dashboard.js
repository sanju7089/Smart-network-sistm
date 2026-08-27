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

async function fetchApiData(path) {
  const response = await apiFetch(path);

  if (!response.ok) {
    throw new Error(`API request failed: ${path}`);
  }

  return response.json();
}

function showDashboardError(element, message) {
  element.innerHTML = `
    <div class="notice">
      ${message}
    </div>
  `;
}

async function loadCustomerDashboard(element, user) {
  const [jobsResult, bookingsResult] =
    await Promise.all([
      fetchApiData("/jobs"),
      fetchApiData("/bookings")
    ]);

  const jobs = getData(jobsResult).filter((job) => {
    const customerId =
      job.customerId?._id ||
      job.customerId;

    return String(customerId) === String(user.id);
  });

  const bookings = getData(bookingsResult);

  element.innerHTML = `
    <h1>Customer Dashboard</h1>

    <div class="grid2">

      <div class="card">
        <div class="stat">${jobs.length}</div>
        <p>My work requests</p>
      </div>

      <div class="card">
        <div class="stat">${bookings.length}</div>
        <p>Bookings</p>
      </div>

    </div>

    <br>

    <a
      class="btn btn-primary"
      href="find-help.html"
    >
      Post New Work
    </a>
  `;
}

async function loadWorkerDashboard(element) {
  const [jobsResult, bookingsResult, paymentsResult] =
    await Promise.all([
      fetchApiData("/jobs"),
      fetchApiData("/bookings"),
      fetchApiData("/payments")
    ]);

  const jobs = getData(jobsResult);

  const availableJobs = jobs.filter((job) => {
    return (
      !job.status ||
      job.status === "open" ||
      job.status === "active"
    );
  });

  const bookings = getData(bookingsResult);

  const payments = getData(paymentsResult);

  const earnings = payments
    .filter((payment) => payment.status === "paid")
    .reduce((total, payment) => {
      return total + Number(payment.amount || 0);
    }, 0);

  element.innerHTML = `
    <h1>Worker Dashboard</h1>

    <div class="grid2">

      <div class="card">
        <div class="stat">
          ${availableJobs.length}
        </div>
        <p>Available requests</p>
      </div>

      <div class="card">
        <div class="stat">
          ₹${earnings.toLocaleString("en-IN")}
        </div>
        <p>Earnings</p>
      </div>

      <div class="card">
        <div class="stat">
          ${bookings.length}
        </div>
        <p>My bookings</p>
      </div>

    </div>

    <br>

    <a
      class="btn btn-primary"
      href="workers.html"
    >
      Explore Work
    </a>
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
    .filter((payment) => payment.status === "paid")
    .reduce((total, payment) => {
      return total + Number(payment.amount || 0);
    }, 0);

  element.innerHTML = `
    <h1>Admin Control Center</h1>

    <div class="grid">

      <div class="card">
        <div class="stat">${users.length}</div>
        <p>Users</p>
      </div>

      <div class="card">
        <div class="stat">${jobs.length}</div>
        <p>Jobs</p>
      </div>

      <div class="card">
        <div class="stat">${bookings.length}</div>
        <p>Bookings</p>
      </div>

      <div class="card">
        <div class="stat">
          ₹${paidRevenue.toLocaleString("en-IN")}
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
    const element =
      document.querySelector(
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
        "Unable to load live dashboard data. Please check your server connection."
      );
    }
  }
);
