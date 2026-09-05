"use strict";

(function () {
  const user =
    typeof window.protect === "function"
      ? window.protect("admin")
      : null;

  if (!user) {
    return;
  }

  const $ = (selector) =>
    document.querySelector(selector);

  function escape(value = "") {
    if (
      typeof window.escapeHtml ===
      "function"
    ) {
      return window.escapeHtml(
        String(value)
      );
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function money(paise, currency = "INR") {
    const amount =
      Number(paise || 0) / 100;

    if (!Number.isFinite(amount)) {
      return "₹0.00";
    }

    try {
      return amount.toLocaleString(
        "en-IN",
        {
          style: "currency",
          currency,
          maximumFractionDigits: 2
        }
      );
    } catch {
      return `₹${amount.toLocaleString(
        "en-IN",
        {
          maximumFractionDigits: 2
        }
      )}`;
    }
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

  function status(message, isError = false) {
    const element =
      $("#adminStatus");

    if (!element) {
      return;
    }

    element.textContent =
      message || "";

    element.dataset.error =
      isError ? "true" : "false";
  }

  async function api(path) {
    if (
      window.SWN &&
      typeof window.SWN.request ===
        "function"
    ) {
      return window.SWN.request(path);
    }

    if (
      window.SWN &&
      typeof window.SWN.api ===
        "function"
    ) {
      const response =
        await fetch(
          window.SWN.api(path),
          {
            headers:
              typeof window.SWN.authHeaders ===
              "function"
                ? window.SWN.authHeaders()
                : {}
          }
        );

      let body = null;

      try {
        body =
          await response.json();
      } catch {
        body = null;
      }

      if (!response.ok) {
        throw new Error(
          body?.message ||
            `Request failed (${response.status})`
        );
      }

      return body;
    }

    throw new Error(
      "Central API client is not available."
    );
  }

  function renderCards(items) {
    const target =
      $("#adminCards");

    if (!target) {
      return;
    }

    target.innerHTML = items
      .map(
        (item) => `
          <article class="card">
            <h3>
              ${escape(item.label)}
            </h3>

            <p
              style="
                font-size:2rem;
                margin:.4rem 0
              "
            >
              ${escape(item.value)}
            </p>

            <p class="muted">
              ${escape(item.sub || "")}
            </p>
          </article>
        `
      )
      .join("");
  }

  function renderTable(title, headers, rows) {
    const target =
      $("#adminTable");

    if (!target) {
      return;
    }

    target.innerHTML = `
      <div class="card">
        <h2>${escape(title)}</h2>

        <div style="overflow:auto">
          <table
            style="
              width:100%;
              border-collapse:collapse
            "
          >
            <thead>
              <tr>
                ${headers
                  .map(
                    (header) => `
                      <th
                        style="
                          text-align:left;
                          padding:.6rem;
                          white-space:nowrap
                        "
                      >
                        ${escape(header)}
                      </th>
                    `
                  )
                  .join("")}
              </tr>
            </thead>

            <tbody>
              ${
                rows.length
                  ? rows.join("")
                  : `
                    <tr>
                      <td
                        colspan="${headers.length}"
                        style="padding:.8rem"
                      >
                        No records found.
                      </td>
                    </tr>
                  `
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async function loadDashboard() {
    status(
      "Loading dashboard..."
    );

    const result =
      await api("/admin/dashboard");

    const data =
      result?.data || {};

    renderCards([
      {
        label: "Users",
        value:
          data.users?.total ?? 0,
        sub:
          `${data.users?.active ?? 0} active`
      },

      {
        label: "Workers",
        value:
          data.workers?.total ?? 0,
        sub:
          `${data.workers?.verified ?? 0} verified`
      },

      {
        label: "Jobs",
        value:
          data.jobs?.total ?? 0,
        sub:
          `${data.jobs?.open ?? 0} open`
      },

      {
        label: "Bookings",
        value:
          data.bookings?.total ?? 0,
        sub:
          `${data.bookings?.pending ?? 0} pending`
      },

      {
        label: "Paid Payments",
        value:
          data.payments?.paid ?? 0,
        sub:
          `${data.payments?.failed ?? 0} failed`
      },

      {
        label: "Net Revenue",
        value:
          money(
            data.payments?.netRevenue ??
              data.payments?.totalRevenue ??
              0
          ),
        sub:
          `${money(
            data.payments?.refundedAmount ||
              0
          )} refunded`
      }
    ]);

    status(
      "Admin dashboard connected successfully."
    );
  }

  async function loadUsers() {
    status("Loading users...");

    const result =
      await api(
        "/admin/users?page=1&limit=100"
      );

    const rows =
      Array.isArray(result?.data)
        ? result.data
        : [];

    renderCards([
      {
        label: "Users",
        value:
          result?.pagination?.total ??
          rows.length,
        sub: "total users"
      }
    ]);

    renderTable(
      "User Management",
      [
        "Name",
        "Email",
        "Role",
        "Phone",
        "Location",
        "Active",
        "Created"
      ],
      rows.map(
        (item) => `
          <tr>
            <td style="padding:.6rem">
              ${escape(item.name)}
            </td>

            <td style="padding:.6rem">
              ${escape(item.email)}
            </td>

            <td style="padding:.6rem">
              ${escape(item.role)}
            </td>

            <td style="padding:.6rem">
              ${escape(item.phone || "—")}
            </td>

            <td style="padding:.6rem">
              ${escape(item.location || "—")}
            </td>

            <td style="padding:.6rem">
              ${item.isActive ? "Yes" : "No"}
            </td>

            <td style="padding:.6rem">
              ${escape(date(item.createdAt))}
            </td>
          </tr>
        `
      )
    );

    status(
      `Users loaded: ${rows.length}`
    );
  }

  async function loadJobs() {
    status("Loading jobs...");

    const result =
      await api(
        "/admin/jobs?page=1&limit=100"
      );

    const rows =
      Array.isArray(result?.data)
        ? result.data
        : [];

    renderTable(
      "Job Management",
      [
        "Title",
        "Customer",
        "Location",
        "Budget",
        "Status",
        "Created"
      ],
      rows.map(
        (job) => `
          <tr>
            <td style="padding:.6rem">
              ${escape(job.title)}
            </td>

            <td style="padding:.6rem">
              ${escape(
                job.customerId?.name ||
                  job.customerId?.email ||
                  "—"
              )}
            </td>

            <td style="padding:.6rem">
              ${escape(
                job.location || "—"
              )}
            </td>

            <td style="padding:.6rem">
              ${
                job.budget == null
                  ? "—"
                  : escape(
                      `₹${Number(
                        job.budget
                      ).toLocaleString(
                        "en-IN"
                      )}`
                    )
              }
            </td>

            <td style="padding:.6rem">
              ${escape(job.status)}
            </td>

            <td style="padding:.6rem">
              ${escape(
                date(job.createdAt)
              )}
            </td>
          </tr>
        `
      )
    );

    status(
      `Jobs loaded: ${rows.length}`
    );
  }

  async function loadBookings() {
    status("Loading bookings...");

    const result =
      await api(
        "/admin/bookings?page=1&limit=100"
      );

    const rows =
      Array.isArray(result?.data)
        ? result.data
        : [];

    renderTable(
      "Booking Management",
      [
        "Work",
        "Customer",
        "Worker",
        "Date",
        "Status",
        "Created"
      ],
      rows.map(
        (booking) => `
          <tr>
            <td style="padding:.6rem">
              ${escape(
                booking.job?.title ||
                  "—"
              )}
            </td>

            <td style="padding:.6rem">
              ${escape(
                booking.customer?.name ||
                  booking.customer?.email ||
                  "—"
              )}
            </td>

            <td style="padding:.6rem">
              ${escape(
                booking.worker?.name ||
                  "—"
              )}
            </td>

            <td style="padding:.6rem">
              ${escape(
                date(booking.date)
              )}
            </td>

            <td style="padding:.6rem">
              ${escape(
                booking.status
              )}
            </td>

            <td style="padding:.6rem">
              ${escape(
                date(
                  booking.createdAt
                )
              )}
            </td>
          </tr>
        `
      )
    );

    status(
      `Bookings loaded: ${rows.length}`
    );
  }

  async function loadPayments() {
    status("Loading payments...");

    const result =
      await api(
        "/admin/payments?page=1&limit=100"
      );

    const rows =
      Array.isArray(result?.data)
        ? result.data
        : [];

    renderTable(
      "Payment Management",
      [
        "Date",
        "User",
        "Work",
        "Amount",
        "Status",
        "Transaction"
      ],
      rows.map(
        (payment) => `
          <tr>
            <td style="padding:.6rem">
              ${escape(
                date(payment.createdAt)
              )}
            </td>

            <td style="padding:.6rem">
              ${escape(
                payment.user?.name ||
                  payment.user?.email ||
                  "—"
              )}
            </td>

            <td style="padding:.6rem">
              ${escape(
                payment.booking?.job?.title ||
                  "—"
              )}
            </td>

            <td style="padding:.6rem">
              ${escape(
                money(
                  payment.amountPaise ??
                    payment.amount,
                  payment.currency ||
                    "INR"
                )
              )}
            </td>

            <td style="padding:.6rem">
              ${escape(
                payment.status
              )}
            </td>

            <td style="padding:.6rem">
              ${escape(
                payment.transactionId ||
                  payment.gatewayPaymentId ||
                  payment.razorpayPaymentId ||
                  "—"
              )}
            </td>
          </tr>
        `
      )
    );

    status(
      `Payments loaded: ${rows.length}`
    );
  }

  async function loadWorkers() {
    status("Loading workers...");

    const result =
      await api(
        "/admin/workers?page=1&limit=100"
      );

    const rows =
      Array.isArray(result?.data)
        ? result.data
        : [];

    renderTable(
      "Worker Management",
      [
        "Worker",
        "Email",
        "Service",
        "Location",
        "Verified",
        "Available",
        "Active"
      ],
      rows.map(
        (worker) => `
          <tr>
            <td style="padding:.6rem">
              ${escape(
                worker.name ||
                  worker.userId?.name ||
                  "—"
              )}
            </td>

            <td style="padding:.6rem">
              ${escape(
                worker.userId?.email ||
                  "—"
              )}
            </td>

            <td style="padding:.6rem">
              ${escape(
                worker.service || "—"
              )}
            </td>

            <td style="padding:.6rem">
              ${escape(
                worker.location || "—"
              )}
            </td>

            <td style="padding:.6rem">
              ${
                worker.verified
                  ? "Yes"
                  : "No"
              }
            </td>

            <td style="padding:.6rem">
              ${
                worker.isAvailable
                  ? "Yes"
                  : "No"
              }
            </td>

            <td style="padding:.6rem">
              ${
                worker.isActive
                  ? "Yes"
                  : "No"
              }
            </td>
          </tr>
        `
      )
    );

    status(
      `Workers loaded: ${rows.length}`
    );
  }

  async function loadReports() {
    status("Generating report...");

    const result =
      await api(
        "/admin/reports?period=all"
      );

    const data =
      result?.data || {};

    renderCards([
      {
        label: "Users",
        value: data.users ?? 0,
        sub: "registered in period"
      },

      {
        label: "Workers",
        value: data.workers ?? 0,
        sub: "worker profiles"
      },

      {
        label: "Jobs",
        value: data.jobs ?? 0,
        sub: "jobs created"
      },

      {
        label: "Bookings",
        value: data.bookings ?? 0,
        sub: "bookings created"
      },

      {
        label: "Paid Payments",
        value:
          data.payments?.paid ?? 0,
        sub: "successful payments"
      },

      {
        label: "Net Revenue",
        value:
          money(
            data.netRevenuePaise ?? 0
          ),
        sub:
          `${money(
            data.refundPaise ?? 0
          )} refunded`
      }
    ]);

    renderTable(
      "Report Summary",
      [
        "Metric",
        "Value"
      ],
      [
        `
          <tr>
            <td style="padding:.6rem">
              Paid payments
            </td>
            <td style="padding:.6rem">
              ${escape(
                data.payments?.paid ?? 0
              )}
            </td>
          </tr>
        `,

        `
          <tr>
            <td style="padding:.6rem">
              Refunded payments
            </td>
            <td style="padding:.6rem">
              ${escape(
                data.payments?.refunded ?? 0
              )}
            </td>
          </tr>
        `,

        `
          <tr>
            <td style="padding:.6rem">
              Failed payments
            </td>
            <td style="padding:.6rem">
              ${escape(
                data.payments?.failed ?? 0
              )}
            </td>
          </tr>
        `,

        `
          <tr>
            <td style="padding:.6rem">
              Gross revenue
            </td>
            <td style="padding:.6rem">
              ${escape(
                money(
                  data.revenuePaise ?? 0
                )
              )}
            </td>
          </tr>
        `,

        `
          <tr>
            <td style="padding:.6rem">
              Refund amount
            </td>
            <td style="padding:.6rem">
              ${escape(
                money(
                  data.refundPaise ?? 0
                )
              )}
            </td>
          </tr>
        `,

        `
          <tr>
            <td style="padding:.6rem">
              Net revenue
            </td>
            <td style="padding:.6rem">
              ${escape(
                money(
                  data.netRevenuePaise ?? 0
                )
              )}
            </td>
          </tr>
        `
      ]
    );

    status(
      "Reports generated successfully."
    );
  }

  function getPageType() {
    const body =
      document.body;

    return (
      body?.dataset?.adminPage ||
      "dashboard"
    );
  }

  async function loadPage() {
    try {
      const page =
        getPageType();

      if (page === "dashboard") {
        await loadDashboard();
        return;
      }

      if (page === "users") {
        await loadUsers();
        return;
      }

      if (page === "jobs") {
        await loadJobs();
        return;
      }

      if (page === "bookings") {
        await loadBookings();
        return;
      }

      if (page === "payments") {
        await loadPayments();
        return;
      }

      if (page === "verification") {
        await loadWorkers();
        return;
      }

      if (page === "reports") {
        await loadReports();
        return;
      }

      await loadDashboard();
    } catch (error) {
      console.error(
        "ADMIN PAGE ERROR:",
        error
      );

      status(
        error?.message ||
          "Unable to load admin data.",
        true
      );
    }
  }

  document.addEventListener(
    "DOMContentLoaded",
    loadPage
  );

  window.adminDashboard = {
    loadDashboard,
    loadUsers,
    loadJobs,
    loadBookings,
    loadPayments,
    loadWorkers,
    loadReports,
    loadPage
  };
})();
