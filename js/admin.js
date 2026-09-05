"use strict";

(function () {
const state = {
page:
document.body?.dataset?.adminPage ||
"dashboard",
loading: false
};

function escapeHtml(value) {
return String(value ?? "")
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, """)
.replace(/'/g, "'");
}

function money(paise) {
const value =
Number(paise || 0) / 100;

return new Intl.NumberFormat(
  "en-IN",
  {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }
).format(value);

}

function date(value) {
if (!value) {
return "—";
}

const parsed = new Date(value);

if (
  Number.isNaN(
    parsed.getTime()
  )
) {
  return "—";
}

return parsed.toLocaleString(
  "en-IN"
);

}

function status(value) {
return "<span class="badge"> ${escapeHtml( String(value || "—") .replaceAll( "_", " " ) )} </span>";
}

function getStatusElement() {
return document.getElementById(
"adminStatus"
);
}

function setStatus(message) {
const element =
getStatusElement();

if (element) {
  element.textContent =
    message;
}

}

function cards(items) {
const element =
document.getElementById(
"adminCards"
);

if (!element) {
  return;
}

element.innerHTML = items
  .map(
    (item) => `
      <article class="card">
        <h3>
          ${escapeHtml(
            item.label
          )}
        </h3>
        <p>
          ${escapeHtml(
            item.value
          )}
        </p>
      </article>
    `
  )
  .join("");

}

function table(
headers,
rows
) {
const element =
document.getElementById(
"adminTable"
);

if (!element) {
  return;
}

if (!rows.length) {
  element.innerHTML =
    `<p class="muted">No records found.</p>`;
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
                `<th>${escapeHtml(
                  header
                )}</th>`
            )
            .join("")}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) =>
              `<tr>${row
                .map(
                  (cell) =>
                    `<td>${cell}</td>`
                )
                .join("")}</tr>`
          )
          .join("")}
      </tbody>
    </table>
  </div>
`;

}

async function request(
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
  "Central API client is unavailable."
);

}

async function protectAdmin() {
if (
typeof window.protect ===
"function"
) {
const result =
await window.protect(
"admin"
);

  if (result === false) {
    return false;
  }
}

const user =
  typeof window.getCurrentUser ===
  "function"
    ? window.getCurrentUser()
    : null;

if (
  user &&
  user.role &&
  user.role !== "admin"
) {
  window.location.href =
    "login.html";
  return false;
}

return true;

}

async function loadDashboard() {
const response =
await request(
"/admin/dashboard"
);

const data =
  response?.data || {};

cards([
  {
    label: "Total Users",
    value:
      data.users?.total ??
      0
  },
  {
    label: "Active Users",
    value:
      data.users?.active ??
      0
  },
  {
    label: "Workers",
    value:
      data.workers?.total ??
      0
  },
  {
    label: "Verified Workers",
    value:
      data.workers?.verified ??
      0
  },
  {
    label: "Open Jobs",
    value:
      data.jobs?.open ??
      0
  },
  {
    label: "Bookings",
    value:
      data.bookings?.total ??
      0
  },
  {
    label: "Paid Payments",
    value:
      data.payments?.paid ??
      0
  },
  {
    label: "Net Revenue",
    value:
      money(
        data.payments
          ?.netRevenue
      )
  }
]);

setStatus(
  "Admin dashboard loaded successfully."
);

}

async function loadJobs() {
const response =
await request(
"/admin/jobs?page=1&limit=100"
);

const jobs =
  response?.data || [];

cards([
  {
    label: "Jobs Loaded",
    value:
      String(jobs.length)
  }
]);

table(
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
      job._id || job.id;

    return [
      `<strong>${escapeHtml(
        job.title
      )}</strong><br>${escapeHtml(
        job.service || ""
      )}`,

      escapeHtml(
        job.customerId
          ?.name ||
          "Unknown"
      ),

      escapeHtml(
        job.location ||
          "—"
      ),

      job.budget ===
      null
        ? "—"
        : money(
            Math.round(
              Number(
                job.budget
              ) * 100
            )
          ),

      status(
        job.status
      ),

      `
        <button
          type="button"
          data-admin-job-status="${escapeHtml(
            id
          )}"
          data-status="open"
        >
          Open
        </button>

        <button
          type="button"
          data-admin-job-status="${escapeHtml(
            id
          )}"
          data-status="assigned"
        >
          Assign
        </button>

        <button
          type="button"
          data-admin-job-status="${escapeHtml(
            id
          )}"
          data-status="in_progress"
        >
          In progress
        </button>

        <button
          type="button"
          data-admin-job-status="${escapeHtml(
            id
          )}"
          data-status="completed"
        >
          Complete
        </button>

        <button
          type="button"
          data-admin-job-status="${escapeHtml(
            id
          )}"
          data-status="cancelled"
        >
          Cancel
        </button>

        <button
          type="button"
          data-admin-job-delete="${escapeHtml(
            id
          )}"
        >
          Delete
        </button>
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
const response =
await request(
"/admin/jobs/${encodeURIComponent( id )}",
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
if (
!window.confirm(
"Delete this job permanently?"
)
) {
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
  response?.data || [];

cards([
  {
    label: "Workers Loaded",
    value:
      String(workers.length)
  },
  {
    label: "Verified",
    value:
      String(
        workers.filter(
          (worker) =>
            worker.verified ===
            true
        ).length
      )
  }
]);

table(
  [
    "Worker",
    "Service",
    "Location",
    "Verification",
    "Active",
    "Available",
    "Actions"
  ],
  workers.map(
    (worker) => {
      const id =
        worker._id ||
        worker.id;

      return [
        `<strong>${escapeHtml(
          worker.name ||
            "Unknown"
        )}</strong><br>${escapeHtml(
          worker.phone ||
            ""
        )}`,

        escapeHtml(
          worker.service ||
            "—"
        ),

        escapeHtml(
          worker.location ||
            "—"
        ),

        status(
          worker.verified
            ? "verified"
            : "pending"
        ),

        status(
          worker.isActive
            ? "active"
            : "inactive"
        ),

        status(
          worker.isAvailable
            ? "available"
            : "unavailable"
        ),

        `
          <button
            type="button"
            data-admin-worker="${escapeHtml(
              id
            )}"
            data-action="verify"
          >
            Verify
          </button>

          <button
            type="button"
            data-admin-worker="${escapeHtml(
              id
            )}"
            data-action="unverify"
          >
            Unverify
          </button>

          <button
            type="button"
            data-admin-worker="${escapeHtml(
              id
            )}"
            data-action="activate"
          >
            Activate
          </button>

          <button
            type="button"
            data-admin-worker="${escapeHtml(
              id
            )}"
            data-action="deactivate"
          >
            Deactivate
          </button>

          <button
            type="button"
            data-admin-worker="${escapeHtml(
              id
            )}"
            data-action="available"
          >
            Available
          </button>

          <button
            type="button"
            data-admin-worker="${escapeHtml(
              id
            )}"
            data-action="unavailable"
          >
            Unavailable
          </button>
        `
      ];
    }
  )
);

setStatus(
  "Worker verification and management loaded."
);

}

async function changeWorker(
id,
action
) {
const updates = {};

if (
  action === "verify"
) {
  updates.verified =
    true;
}

if (
  action === "unverify"
) {
  updates.verified =
    false;
}

if (
  action === "activate"
) {
  updates.isActive =
    true;
}

if (
  action === "deactivate"
) {
  updates.isActive =
    false;
}

if (
  action === "available"
) {
  updates.isAvailable =
    true;
}

if (
  action === "unavailable"
) {
  updates.isAvailable =
    false;
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

async function loadPayments() {
const response =
await request(
"/admin/payments?page=1&limit=100"
);

const payments =
  response?.data || [];

cards([
  {
    label: "Payments Loaded",
    value:
      String(payments.length)
  },
  {
    label: "Paid",
    value:
      String(
        payments.filter(
          (payment) =>
            payment.status ===
            "paid"
        ).length
      )
  },
  {
    label: "Refunded",
    value:
      String(
        payments.filter(
          (payment) =>
            payment.status ===
            "refunded"
        ).length
      )
  }
]);

table(
  [
    "Transaction",
    "User",
    "Amount",
    "Status",
    "Created",
    "Actions"
  ],
  payments.map(
    (payment) => {
      const id =
        payment.id ||
        payment._id;

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

        status(
          payment.status
        ),

        date(
          payment.createdAt
        ),

        `
          ${
            [
              "created",
              "pending",
              "processing"
            ].includes(
              payment.status
            )
              ? `
                <button
                  type="button"
                  data-admin-payment-cancel="${escapeHtml(
                    id
                  )}"
                >
                  Cancel
                </button>
              `
              : ""
          }

          ${
            payment.status ===
            "paid"
              ? `
                <button
                  type="button"
                  data-admin-payment-refund="${escapeHtml(
                    id
                  )}"
                >
                  Refund
                </button>
              `
              : ""
          }
        `
      ];
    }
  )
);

setStatus(
  "Payment management loaded."
);

}

async function cancelPayment(
id
) {
if (
!window.confirm(
"Cancel this active payment?"
)
) {
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
        status:
          "cancelled"
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

async function refundPayment(
id
) {
if (
!window.confirm(
"Refund the full Razorpay payment? This action cannot be undone."
)
) {
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

async function loadUsers() {
const response =
await request(
"/admin/users?page=1&limit=100"
);

const users =
  response?.data || [];

cards([
  {
    label: "Users Loaded",
    value:
      String(users.length)
  }
]);

table(
  [
    "Name",
    "Email",
    "Role",
    "Phone",
    "Active",
    "Created"
  ],
  users.map(
    (user) => [
      escapeHtml(
        user.name ||
          "—"
      ),
      escapeHtml(
        user.email ||
          "—"
      ),
      status(
        user.role
      ),
      escapeHtml(
        user.phone ||
          "—"
      ),
      status(
        user.isActive
          ? "active"
          : "inactive"
      ),
      date(
        user.createdAt
      )
    ]
  )
);

setStatus(
  "Users loaded."
);

}

async function loadBookings() {
const response =
await request(
"/admin/bookings?page=1&limit=100"
);

const bookings =
  response?.data || [];

cards([
  {
    label: "Bookings Loaded",
    value:
      String(
        bookings.length
      )
  }
]);

table(
  [
    "Customer",
    "Worker",
    "Job",
    "Status",
    "Date"
  ],
  bookings.map(
    (booking) => [
      escapeHtml(
        booking.customer
          ?.name ||
          "—"
      ),
      escapeHtml(
        booking.worker
          ?.name ||
          booking.worker
            ?.user?.name ||
          "—"
      ),
      escapeHtml(
        booking.job
          ?.title ||
          "—"
      ),
      status(
        booking.status
      ),
      date(
        booking.date ||
          booking.createdAt
      )
    ]
  )
);

setStatus(
  "Bookings loaded."
);

}

async function loadReports() {
const response =
await request(
"/admin/reports?period=all"
);

const data =
  response?.data || {};

cards([
  {
    label: "Users",
    value:
      String(
        data.users ??
          data.totalUsers ??
          0
      )
  },
  {
    label: "Workers",
    value:
      String(
        data.workers ??
          data.totalWorkers ??
          0
      )
  },
  {
    label: "Jobs",
    value:
      String(
        data.jobs ??
          data.totalJobs ??
          0
      )
  },
  {
    label: "Bookings",
    value:
      String(
        data.bookings ??
          data.totalBookings ??
          0
      )
  },
  {
    label: "Gross Revenue",
    value:
      money(
        data.grossRevenue ??
          0
      )
  },
  {
    label: "Refunded",
    value:
      money(
        data.refundedAmount ??
          0
      )
  },
  {
    label: "Net Revenue",
    value:
      money(
        data.netRevenue ??
          0
      )
  }
]);

setStatus(
  "Admin report loaded."
);

}

async function run() {
try {
const allowed =
await protectAdmin();

  if (!allowed) {
    return;
  }

  state.loading = true;

  if (
    state.page ===
    "dashboard"
  ) {
    await loadDashboard();
  } else if (
    state.page ===
    "users"
  ) {
    await loadUsers();
  } else if (
    state.page ===
    "jobs"
  ) {
    await loadJobs();
  } else if (
    state.page ===
    "workers" ||
    state.page ===
    "verification"
  ) {
    await loadWorkers();
  } else if (
    state.page ===
    "bookings"
  ) {
    await loadBookings();
  } else if (
    state.page ===
    "payments"
  ) {
    await loadPayments();
  } else if (
    state.page ===
    "reports"
  ) {
    await loadReports();
  } else {
    await loadDashboard();
  }
} catch (error) {
  console.error(
    "ADMIN UI ERROR:",
    error
  );

  setStatus(
    error?.message ||
      "Unable to load admin data."
  );
} finally {
  state.loading = false;
}

}

document.addEventListener(
"click",
async (event) => {
const jobButton =
event.target.closest(
"[data-admin-job-status]"
);

  const deleteJobButton =
    event.target.closest(
      "[data-admin-job-delete]"
    );

  const workerButton =
    event.target.closest(
      "[data-admin-worker]"
    );

  const cancelPaymentButton =
    event.target.closest(
      "[data-admin-payment-cancel]"
    );

  const refundPaymentButton =
    event.target.closest(
      "[data-admin-payment-refund]"
    );

  try {
    if (jobButton) {
      await changeJobStatus(
        jobButton.dataset
          .adminJobStatus,
        jobButton.dataset
          .status
      );
      return;
    }

    if (
      deleteJobButton
    ) {
      await deleteJob(
        deleteJobButton.dataset
          .adminJobDelete
      );
      return;
    }

    if (workerButton) {
      await changeWorker(
        workerButton.dataset
          .adminWorker,
        workerButton.dataset
          .action
      );
      return;
    }

    if (
      cancelPaymentButton
    ) {
      await cancelPayment(
        cancelPaymentButton
          .dataset
          .adminPaymentCancel
      );
      return;
    }

    if (
      refundPaymentButton
    ) {
      await refundPayment(
        refundPaymentButton
          .dataset
          .adminPaymentRefund
      );
    }
  } catch (error) {
    console.error(
      "ADMIN ACTION ERROR:",
      error
    );

    setStatus(
      error?.message ||
        "Admin action failed."
    );
  }
}

);

window.adminDashboard = {
loadDashboard,
loadUsers,
loadJobs,
loadWorkers,
loadBookings,
loadPayments,
loadReports,
changeJobStatus,
deleteJob,
changeWorker,
cancelPayment,
refundPayment
};

if (
document.readyState ===
"loading"
) {
document.addEventListener(
"DOMContentLoaded",
run,
{
once: true
}
);
} else {
run();
}
})();
