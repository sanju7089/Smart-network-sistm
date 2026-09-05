"use strict";

(function () {
const state = {
page: document.body?.dataset?.adminPage || "dashboard",
loading: false
};

const JOB_STATUSES = [
"open",
"assigned",
"in_progress",
"completed",
"cancelled"
];

const WORKER_ACTIONS = [
"verify",
"unverify",
"activate",
"deactivate",
"available",
"unavailable"
];

function escapeHtml(value) {
return String(value ?? "")
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, """)
.replace(/'/g, "'");
}

function money(paise) {
const value = Number(paise || 0) / 100;

if (!Number.isFinite(value)) {
  return "₹0.00";
}

return new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
}).format(value);

}

function rupeesToMoney(rupees) {
const value = Number(rupees);

if (!Number.isFinite(value)) {
  return "₹0.00";
}

return money(Math.round(value * 100));

}

function formatDate(value) {
if (!value) {
return "—";
}

const parsed = new Date(value);

if (Number.isNaN(parsed.getTime())) {
  return "—";
}

return parsed.toLocaleString("en-IN");

}

function formatStatus(value) {
const text = String(value || "—")
.replaceAll("_", " ")
.trim();

return `
  <span class="badge">
    ${escapeHtml(text)}
  </span>
`;

}

function getStatusElement() {
return document.getElementById("adminStatus");
}

function setStatus(message) {
const element = getStatusElement();

if (element) {
  element.textContent = String(message || "");
}

}

function showError(error) {
console.error("ADMIN ERROR:", error);

const message =
  error?.message ||
  "Something went wrong. Please try again.";

setStatus(message);

}

function getCardsElement() {
return document.getElementById("adminCards");
}

function getTableElement() {
return document.getElementById("adminTable");
}

function renderCards(items) {
const element = getCardsElement();

if (!element) {
  return;
}

element.innerHTML = items
  .map(
    (item) => `
      <article class="card">
        <h3>${escapeHtml(item.label)}</h3>
        <p>${escapeHtml(item.value)}</p>
      </article>
    `
  )
  .join("");

}

function renderTable(headers, rows) {
const element = getTableElement();

if (!element) {
  return;
}

if (!Array.isArray(rows) || rows.length === 0) {
  element.innerHTML =
    '<p class="muted">No records found.</p>';
  return;
}

element.innerHTML = `
  <div style="overflow-x:auto">
    <table>
      <thead>
        <tr>
          ${headers
            .map(
              (header) =>
                `<th>${escapeHtml(header)}</th>`
            )
            .join("")}
        </tr>
      </thead>

      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                ${row
                  .map(
                    (cell) =>
                      `<td>${cell ?? ""}</td>`
                  )
                  .join("")}
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  </div>
`;

}

async function request(endpoint, options = {}) {
if (
window.SWN &&
typeof window.SWN.request === "function"
) {
return window.SWN.request(
endpoint,
options
);
}

if (
  typeof window.apiFetch === "function"
) {
  return window.apiFetch(
    endpoint,
    options
  );
}

throw new Error(
  "Central API client is unavailable."
);

}

async function protectAdmin() {
if (typeof window.protect === "function") {
const result = await window.protect("admin");

  if (result === false) {
    return false;
  }
}

if (
  typeof window.getCurrentUser ===
  "function"
) {
  const user =
    window.getCurrentUser();

  if (
    user &&
    user.role &&
    user.role !== "admin"
  ) {
    window.location.href =
      "login.html";

    return false;
  }
}

return true;

}

async function loadDashboard() {
const response =
await request("/admin/dashboard");

const data =
  response?.data || {};

const payments =
  data.payments || {};

renderCards([
  {
    label: "Total Users",
    value: String(
      data.users?.total ?? 0
    )
  },
  {
    label: "Active Users",
    value: String(
      data.users?.active ?? 0
    )
  },
  {
    label: "Workers",
    value: String(
      data.workers?.total ?? 0
    )
  },
  {
    label: "Verified Workers",
    value: String(
      data.workers?.verified ?? 0
    )
  },
  {
    label: "Open Jobs",
    value: String(
      data.jobs?.open ?? 0
    )
  },
  {
    label: "Total Bookings",
    value: String(
      data.bookings?.total ?? 0
    )
  },
  {
    label: "Paid Payments",
    value: String(
      payments.paid ?? 0
    )
  },
  {
    label: "Net Revenue",
    value: money(
      payments.netRevenue ?? 0
    )
  }
]);

setStatus(
  "Admin dashboard loaded successfully."
);

}

async function loadUsers() {
const response =
await request(
"/admin/users?page=1&limit=100"
);

const users =
  Array.isArray(response?.data)
    ? response.data
    : [];

renderCards([
  {
    label: "Users Loaded",
    value: String(users.length)
  }
]);

renderTable(
  [
    "Name",
    "Email",
    "Phone",
    "Role",
    "Location",
    "Active",
    "Created"
  ],
  users.map((user) => [
    escapeHtml(
      user.name || "Unknown"
    ),
    escapeHtml(
      user.email || "—"
    ),
    escapeHtml(
      user.phone || "—"
    ),
    formatStatus(user.role),
    escapeHtml(
      user.location || "—"
    ),
    formatStatus(
      user.isActive
        ? "active"
        : "inactive"
    ),
    formatDate(user.createdAt)
  ])
);

setStatus(
  "User management loaded."
);

}

async function loadJobs() {
const response =
await request(
"/admin/jobs?page=1&limit=100"
);

const jobs =
  Array.isArray(response?.data)
    ? response.data
    : [];

renderCards([
  {
    label: "Jobs Loaded",
    value: String(jobs.length)
  },
  {
    label: "Open",
    value: String(
      jobs.filter(
        (job) =>
          job.status === "open"
      ).length
    )
  },
  {
    label: "Completed",
    value: String(
      jobs.filter(
        (job) =>
          job.status === "completed"
      ).length
    )
  }
]);

renderTable(
  [
    "Job",
    "Customer",
    "Location",
    "Budget",
    "Status",
    "Actions"
  ],
  jobs.map((job) => {
    const id =
      job._id || job.id || "";

    const actionButtons =
      JOB_STATUSES.map(
        (jobStatus) => `
          <button
            type="button"
            data-admin-job-status="${escapeHtml(
              id
            )}"
            data-status="${escapeHtml(
              jobStatus
            )}"
          >
            ${escapeHtml(
              jobStatus
                .replaceAll(
                  "_",
                  " "
                )
            )}
          </button>
        `
      ).join("");

    return [
      `
        <strong>
          ${escapeHtml(
            job.title || "Untitled job"
          )}
        </strong>
        <br>
        <small>
          ${escapeHtml(
            job.service || ""
          )}
        </small>
      `,

      escapeHtml(
        job.customerId?.name ||
          job.customer?.name ||
          "Unknown"
      ),

      escapeHtml(
        job.location || "—"
      ),

      job.budget == null
        ? "—"
        : rupeesToMoney(
            job.budget
          ),

      formatStatus(
        job.status
      ),

      `
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${actionButtons}

          <button
            type="button"
            data-admin-job-delete="${escapeHtml(
              id
            )}"
          >
            Delete
          </button>
        </div>
      `
    ];
  })
);

setStatus(
  "Job management loaded."
);

}

async function changeJobStatus(
id,
newStatus
) {
if (!JOB_STATUSES.includes(newStatus)) {
throw new Error(
"Invalid job status."
);
}

const response =
  await request(
    `/admin/jobs/${encodeURIComponent(
      id
    )}`,
    {
      method: "PATCH",
      body: {
        status: newStatus
      }
    }
  );

if (
  response?.success === false
) {
  throw new Error(
    response.message ||
      "Unable to update job."
  );
}

await loadJobs();

}

async function deleteJob(id) {
const confirmed =
window.confirm(
"Delete this job permanently?"
);

if (!confirmed) {
  return;
}

const response =
  await request(
    `/admin/jobs/${encodeURIComponent(
      id
    )}`,
    {
      method: "DELETE"
    }
  );

if (
  response?.success === false
) {
  throw new Error(
    response.message ||
      "Unable to delete job."
  );
}

await loadJobs();

}

async function loadWorkers() {
const response =
await request(
"/admin/workers?page=1&limit=100"
);

const workers =
  Array.isArray(response?.data)
    ? response.data
    : [];

const verified =
  workers.filter(
    (worker) =>
      worker.verified === true
  ).length;

const active =
  workers.filter(
    (worker) =>
      worker.isActive === true
  ).length;

renderCards([
  {
    label: "Workers Loaded",
    value: String(workers.length)
  },
  {
    label: "Verified",
    value: String(verified)
  },
  {
    label: "Active",
    value: String(active)
  }
]);

renderTable(
  [
    "Worker",
    "Service",
    "Location",
    "Verification",
    "Active",
    "Available",
    "Actions"
  ],
  workers.map((worker) => {
    const id =
      worker._id ||
      worker.id ||
      "";

    const buttons =
      WORKER_ACTIONS.map(
        (action) => `
          <button
            type="button"
            data-admin-worker="${escapeHtml(
              id
            )}"
            data-action="${escapeHtml(
              action
            )}"
          >
            ${escapeHtml(
              action
                .replaceAll(
                  "_",
                  " "
                )
            )}
          </button>
        `
      ).join("");

    return [
      `
        <strong>
          ${escapeHtml(
            worker.name ||
              "Unknown"
          )}
        </strong>
        <br>
        <small>
          ${escapeHtml(
            worker.phone || ""
          )}
        </small>
      `,

      escapeHtml(
        worker.service || "—"
      ),

      escapeHtml(
        worker.location || "—"
      ),

      formatStatus(
        worker.verified
          ? "verified"
          : "pending"
      ),

      formatStatus(
        worker.isActive
          ? "active"
          : "inactive"
      ),

      formatStatus(
        worker.isAvailable
          ? "available"
          : "unavailable"
      ),

      `
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${buttons}
        </div>
      `
    ];
  })
);

setStatus(
  "Worker verification and management loaded."
);

}

async function changeWorker(
id,
action
) {
if (
!WORKER_ACTIONS.includes(action)
) {
throw new Error(
"Invalid worker action."
);
}

const updates = {};

switch (action) {
  case "verify":
    updates.verified = true;
    break;

  case "unverify":
    updates.verified = false;
    break;

  case "activate":
    updates.isActive = true;
    break;

  case "deactivate":
    updates.isActive = false;
    break;

  case "available":
    updates.isAvailable = true;
    break;

  case "unavailable":
    updates.isAvailable = false;
    break;

  default:
    throw new Error(
      "Unsupported worker action."
    );
}

const response =
  await request(
    `/admin/workers/${encodeURIComponent(
      id
    )}`,
    {
      method: "PATCH",
      body: updates
    }
  );

if (
  response?.success === false
) {
  throw new Error(
    response.message ||
      "Unable to update worker."
  );
}

await loadWorkers();

}

async function loadVerification() {
await loadWorkers();

setStatus(
  "Worker verification loaded."
);

}

async function loadPayments() {
const response =
await request(
"/admin/payments?page=1&limit=100"
);

const payments =
  Array.isArray(response?.data)
    ? response.data
    : [];

renderCards([
  {
    label: "Payments Loaded",
    value: String(
      payments.length
    )
  },
  {
    label: "Paid",
    value: String(
      payments.filter(
        (payment) =>
          payment.status === "paid"
      ).length
    )
  },
  {
    label: "Refunded",
    value: String(
      payments.filter(
        (payment) =>
          payment.status === "refunded"
      ).length
    )
  }
]);

renderTable(
  [
    "Transaction",
    "User",
    "Amount",
    "Method",
    "Status",
    "Created",
    "Actions"
  ],
  payments.map((payment) => {
    const id =
      payment.id ||
      payment._id ||
      "";

    let actions = "";

    if (
      [
        "created",
        "pending",
        "processing"
      ].includes(
        payment.status
      )
    ) {
      actions += `
        <button
          type="button"
          data-admin-payment-cancel="${escapeHtml(
            id
          )}"
        >
          Cancel
        </button>
      `;
    }

    if (
      payment.status === "paid" &&
      payment.gatewayPaymentId
    ) {
      actions += `
        <button
          type="button"
          data-admin-payment-refund="${escapeHtml(
            id
          )}"
        >
          Refund
        </button>
      `;
    }

    return [
      escapeHtml(
        payment.transactionId ||
          payment.gatewayPaymentId ||
          "—"
      ),

      escapeHtml(
        payment.user?.name ||
          "Unknown"
      ),

      money(
        payment.amountPaise ??
          payment.amount ??
          0
      ),

      escapeHtml(
        payment.method || "—"
      ),

      formatStatus(
        payment.status
      ),

      formatDate(
        payment.createdAt
      ),

      `
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${actions || "—"}
        </div>
      `
    ];
  })
);

setStatus(
  "Payment management loaded."
);

}

async function cancelPayment(id) {
const confirmed =
window.confirm(
"Cancel this active payment?"
);

if (!confirmed) {
  return;
}

const response =
  await request(
    `/admin/payments/${encodeURIComponent(
      id
    )}/status`,
    {
      method: "PATCH",
      body: {
        status: "cancelled"
      }
    }
  );

if (
  response?.success === false
) {
  throw new Error(
    response.message ||
      "Unable to cancel payment."
  );
}

await loadPayments();

}

async function refundPayment(id) {
const confirmed =
window.confirm(
"Refund the full Razorpay payment? This action cannot be undone."
);

if (!confirmed) {
  return;
}

const response =
  await request(
    `/admin/payments/${encodeURIComponent(
      id
    )}/refund`,
    {
      method: "POST"
    }
  );

if (
  response?.success === false
) {
  throw new Error(
    response.message ||
      "Unable to refund payment."
  );
}

await loadPayments();

}

async function loadBookings() {
const response =
await request(
"/admin/bookings?page=1&limit=100"
);

const bookings =
  Array.isArray(response?.data)
    ? response.data
    : [];

renderCards([
  {
    label: "Bookings Loaded",
    value: String(
      bookings.length
    )
  }
]);

renderTable(
  [
    "Booking",
    "Customer",
    "Worker",
    "Status",
    "Created"
  ],
  bookings.map((booking) => [
    escapeHtml(
      booking._id ||
        booking.id ||
        "—"
    ),

    escapeHtml(
      booking.customerId?.name ||
        booking.customer?.name ||
        "Unknown"
    ),

    escapeHtml(
      booking.workerId?.name ||
        booking.worker?.name ||
        "Unknown"
    ),

    formatStatus(
      booking.status
    ),

    formatDate(
      booking.createdAt
    )
  ])
);

setStatus(
  "Booking management loaded."
);

}

async function loadReports() {
const response =
await request(
"/admin/reports"
);

const data =
  response?.data || {};

const cardsData = [];

Object.entries(data).forEach(
  ([key, value]) => {
    if (
      typeof value !==
        "object" &&
      typeof value !==
        "function"
    ) {
      cardsData.push({
        label: key
          .replaceAll(
            "_",
            " "
          ),
        value: String(
          value ?? "—"
        )
      });
    }
  }
);

renderCards(
  cardsData.length
    ? cardsData
    : [
        {
          label: "Reports",
          value:
            "No summary data available"
        }
      ]
);

setStatus(
  "Admin reports loaded."
);

}

function getPage() {
const bodyPage =
document.body?.dataset
?.adminPage;

if (bodyPage) {
  return bodyPage
    .trim()
    .toLowerCase();
}

const path =
  window.location.pathname
    .split("/")
    .pop()
    .toLowerCase();

if (
  path.includes("verification")
) {
  return "verification";
}

if (
  path.includes("jobs")
) {
  return "jobs";
}

if (
  path.includes("workers")
) {
  return "workers";
}

if (
  path.includes("payments")
) {
  return "payments";
}

if (
  path.includes("bookings")
) {
  return "bookings";
}

if (
  path.includes("reports")
) {
  return "reports";
}

if (
  path.includes("users")
) {
  return "users";
}

return "dashboard";

}

async function loadCurrentPage() {
state.page = getPage();

switch (state.page) {
  case "dashboard":
    await loadDashboard();
    break;

  case "users":
    await loadUsers();
    break;

  case "jobs":
    await loadJobs();
    break;

  case "workers":
    await loadWorkers();
    break;

  case "verification":
    await loadVerification();
    break;

  case "payments":
    await loadPayments();
    break;

  case "bookings":
    await loadBookings();
    break;

  case "reports":
    await loadReports();
    break;

  default:
    await loadDashboard();
    break;
}

}

function bindEvents() {
document.addEventListener(
"click",
async (event) => {
const jobStatusButton =
event.target.closest(
"[data-admin-job-status]"
);

    if (jobStatusButton) {
      event.preventDefault();

      const id =
        jobStatusButton.dataset
          .adminJobStatus;

      const newStatus =
        jobStatusButton.dataset
          .status;

      try {
        setStatus(
          "Updating job..."
        );

        await changeJobStatus(
          id,
          newStatus
        );
      } catch (error) {
        showError(error);
      }

      return;
    }

    const jobDeleteButton =
      event.target.closest(
        "[data-admin-job-delete]"
      );

    if (jobDeleteButton) {
      event.preventDefault();

      const id =
        jobDeleteButton.dataset
          .adminJobDelete;

      try {
        setStatus(
          "Deleting job..."
        );

        await deleteJob(id);
      } catch (error) {
        showError(error);
      }

      return;
    }

    const workerButton =
      event.target.closest(
        "[data-admin-worker]"
      );

    if (workerButton) {
      event.preventDefault();

      const id =
        workerButton.dataset
          .adminWorker;

      const action =
        workerButton.dataset
          .action;

      try {
        setStatus(
          "Updating worker..."
        );

        await changeWorker(
          id,
          action
        );
      } catch (error) {
        showError(error);
      }

      return;
    }

    const cancelPaymentButton =
      event.target.closest(
        "[data-admin-payment-cancel]"
      );

    if (cancelPaymentButton) {
      event.preventDefault();

      const id =
        cancelPaymentButton.dataset
          .adminPaymentCancel;

      try {
        setStatus(
          "Cancelling payment..."
        );

        await cancelPayment(id);
      } catch (error) {
        showError(error);
      }

      return;
    }

    const refundPaymentButton =
      event.target.closest(
        "[data-admin-payment-refund]"
      );

    if (refundPaymentButton) {
      event.preventDefault();

      const id =
        refundPaymentButton.dataset
          .adminPaymentRefund;

      try {
        setStatus(
          "Processing refund..."
        );

        await refundPayment(id);
      } catch (error) {
        showError(error);
      }
    }
  }
);

}

async function init() {
if (state.loading) {
return;
}

state.loading = true;

try {
  const allowed =
    await protectAdmin();

  if (!allowed) {
    return;
  }

  bindEvents();

  setStatus(
    "Loading admin panel..."
  );

  await loadCurrentPage();
} catch (error) {
  showError(error);
} finally {
  state.loading = false;
}

}

window.adminDashboard = {
state,
loadDashboard,
loadUsers,
loadJobs,
loadWorkers,
loadVerification,
loadPayments,
loadBookings,
loadReports,
refresh: loadCurrentPage
};

if (
document.readyState ===
"loading"
) {
document.addEventListener(
"DOMContentLoaded",
init,
{
once: true
}
);
} else {
init();
}
})();
