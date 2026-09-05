(() => {
  "use strict";

  const user = protect("admin");

  if (!user) {
    return;
  }

  const $ = (selector) =>
    document.querySelector(selector);

  const esc = (value) => {
    if (
      typeof window.escapeHtml ===
      "function"
    ) {
      return window.escapeHtml(
        value ?? ""
      );
    }

    return String(value ?? "");
  };

  const money = (value) => {
    const amount =
      Number(value || 0) / 100;

    return `₹${amount.toLocaleString(
      "en-IN",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    )}`;
  };

  const date = (value) => {
    if (!value) {
      return "—";
    }

    const parsed = new Date(value);

    if (
      Number.isNaN(parsed.getTime())
    ) {
      return "—";
    }

    return parsed.toLocaleString(
      "en-IN"
    );
  };

  function setStatus(
    message,
    error = false
  ) {
    const element =
      $("#adminStatus");

    if (!element) {
      return;
    }

    element.textContent =
      message || "";

    element.dataset.error =
      error ? "true" : "false";
  }

  async function api(
    path,
    options = {}
  ) {
    const response = await fetch(
      SWN.api(path),
      {
        ...options,

        headers:
          SWN.authHeaders(
            options.headers || {}
          )
      }
    );

    let body = null;

    try {
      body =
        await response.json();
    } catch {
      body = null;
    }

    if (
      !response.ok ||
      body?.success === false
    ) {
      throw new Error(
        body?.message ||
          `Request failed (${response.status})`
      );
    }

    return body;
  }

  function renderCards(items) {
    const target =
      $("#adminCards");

    if (!target) {
      return;
    }

    target.innerHTML =
      items
        .map(
          (item) => `
            <article class="card">
              <h3>${esc(
                item.label
              )}</h3>

              <p
                style="
                  font-size:2rem;
                  margin:.4rem 0
                "
              >
                ${esc(
                  item.value
                )}
              </p>

              <p class="muted">
                ${esc(
                  item.sub || ""
                )}
              </p>
            </article>
          `
        )
        .join("");
  }

  async function loadDashboard() {
    setStatus(
      "Loading dashboard…"
    );

    const result =
      await api(
        "/admin/dashboard"
      );

    const data =
      result.data;

    renderCards([
      {
        label: "Users",
        value: data.users.total,
        sub: `${data.users.active} active`
      },

      {
        label: "Workers",
        value:
          data.workers.total,
        sub: `${data.workers.verified} verified`
      },

      {
        label: "Jobs",
        value: data.jobs.total,
        sub: `${data.jobs.open} open`
      },

      {
        label: "Bookings",
        value:
          data.bookings.total,
        sub: `${data.bookings.pending} pending`
      },

      {
        label: "Paid Payments",
        value:
          data.payments.paid,
        sub: "successful payments"
      },

      {
        label: "Revenue",
        value:
          money(
            data.payments
              .totalRevenue
          ),
        sub:
          "gross paid amount"
      }
    ]);

    setStatus(
      "Dashboard connected successfully."
    );
  }

  async function loadUsers() {
    setStatus(
      "Loading users…"
    );

    const result =
      await api(
        "/users?limit=100"
      );

    const rows =
      Array.isArray(
        result.data
      )
        ? result.data
        : [];

    const target =
      $("#adminTable");

    if (!target) {
      return;
    }

    target.innerHTML = `
      <div class="card">
        <h2>Users</h2>

        <div style="overflow:auto">
          <table
            style="
              width:100%;
              border-collapse:collapse
            "
          >
            <thead>
              <tr>
                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Name
                </th>

                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Email
                </th>

                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Role
                </th>

                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Phone
                </th>

                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Active
                </th>
              </tr>
            </thead>

            <tbody>
              ${
                rows
                  .map(
                    (user) => `
                      <tr>
                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${esc(
                            user.name
                          )}
                        </td>

                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${esc(
                            user.email
                          )}
                        </td>

                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${esc(
                            user.role
                          )}
                        </td>

                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${esc(
                            user.phone ||
                              "—"
                          )}
                        </td>

                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${
                            user.isActive
                              ? "Yes"
                              : "No"
                          }
                        </td>
                      </tr>
                    `
                  )
                  .join("") ||
                `
                  <tr>
                    <td
                      colspan="5"
                      style="
                        padding:.8rem
                      "
                    >
                      No users found.
                    </td>
                  </tr>
                `
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    setStatus(
      `Users loaded: ${rows.length}`
    );
  }

  async function loadPayments() {
    setStatus(
      "Loading payments…"
    );

    const result =
      await api(
        "/payments/admin/all?limit=100"
      );

    const rows =
      Array.isArray(
        result.data
      )
        ? result.data
        : [];

    const target =
      $("#adminTable");

    if (!target) {
      return;
    }

    target.innerHTML = `
      <div class="card">
        <h2>Payments</h2>

        <div style="overflow:auto">
          <table
            style="
              width:100%;
              border-collapse:collapse
            "
          >
            <thead>
              <tr>
                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Date
                </th>

                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  User
                </th>

                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Amount
                </th>

                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Status
                </th>

                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Transaction
                </th>
              </tr>
            </thead>

            <tbody>
              ${
                rows
                  .map(
                    (payment) => `
                      <tr>
                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${date(
                            payment.createdAt
                          )}
                        </td>

                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${esc(
                            payment.userId
                              ?.name ||
                              payment.userId
                                ?.email ||
                              "—"
                          )}
                        </td>

                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${money(
                            payment.amount
                          )}
                        </td>

                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${esc(
                            payment.status
                          )}
                        </td>

                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${esc(
                            payment.transactionId ||
                              payment.gatewayPaymentId ||
                              "—"
                          )}
                        </td>
                      </tr>
                    `
                  )
                  .join("") ||
                `
                  <tr>
                    <td
                      colspan="5"
                      style="
                        padding:.8rem
                      "
                    >
                      No payments found.
                    </td>
                  </tr>
                `
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    setStatus(
      `Payments loaded: ${rows.length}`
    );
  }

  async function loadJobs() {
    setStatus(
      "Loading jobs…"
    );

    const result =
      await api(
        "/admin/jobs?limit=100"
      );

    const rows =
      Array.isArray(
        result.data
      )
        ? result.data
        : [];

    const target =
      $("#adminTable");

    if (!target) {
      return;
    }

    target.innerHTML = `
      <div class="card">
        <h2>Jobs</h2>

        <div style="overflow:auto">
          <table
            style="
              width:100%;
              border-collapse:collapse
            "
          >
            <thead>
              <tr>
                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Title
                </th>

                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Customer
                </th>

                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Location
                </th>

                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Budget
                </th>

                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Status
                </th>

                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Created
                </th>
              </tr>
            </thead>

            <tbody>
              ${
                rows
                  .map(
                    (job) => `
                      <tr>
                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${esc(
                            job.title
                          )}
                        </td>

                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${esc(
                            job.customerId
                              ?.name ||
                              job.customerId
                                ?.email ||
                              "—"
                          )}
                        </td>

                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${esc(
                            job.location ||
                              "—"
                          )}
                        </td>

                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${
                            job.budget ==
                            null
                              ? "—"
                              : `₹${Number(
                                  job.budget
                                ).toLocaleString(
                                  "en-IN"
                                )}`
                          }
                        </td>

                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${esc(
                            job.status
                          )}
                        </td>

                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${date(
                            job.createdAt
                          )}
                        </td>
                      </tr>
                    `
                  )
                  .join("") ||
                `
                  <tr>
                    <td
                      colspan="6"
                      style="
                        padding:.8rem
                      "
                    >
                      No jobs found.
                    </td>
                  </tr>
                `
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    setStatus(
      `Jobs loaded: ${rows.length}`
    );
  }

  async function loadVerification() {
    setStatus(
      "Loading worker verification…"
    );

    const result =
      await api(
        "/admin/workers?limit=100"
      );

    const rows =
      Array.isArray(
        result.data
      )
        ? result.data
        : [];

    const target =
      $("#adminTable");

    if (!target) {
      return;
    }

    target.innerHTML = `
      <div class="card">
        <h2>
          Worker Verification
        </h2>

        <div style="overflow:auto">
          <table
            style="
              width:100%;
              border-collapse:collapse
            "
          >
            <thead>
              <tr>
                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Worker
                </th>

                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Service
                </th>

                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Location
                </th>

                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Verified
                </th>

                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Active
                </th>

                <th
                  style="
                    text-align:left;
                    padding:.6rem
                  "
                >
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              ${
                rows
                  .map(
                    (worker) => `
                      <tr>
                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${esc(
                            worker.name
                          )}
                        </td>

                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${esc(
                            worker.service
                          )}
                        </td>

                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${esc(
                            worker.location ||
                              "—"
                          )}
                        </td>

                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${
                            worker.verified
                              ? "Yes"
                              : "No"
                          }
                        </td>

                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          ${
                            worker.isActive
                              ? "Yes"
                              : "No"
                          }
                        </td>

                        <td
                          style="
                            padding:.6rem
                          "
                        >
                          <button
                            class="btn btn-primary verify-worker"
                            data-id="${esc(
                              worker._id
                            )}"
                            data-value="${
                              worker.verified
                                ? "false"
                                : "true"
                            }"
                          >
                            ${
                              worker.verified
                                ? "Unverify"
                                : "Verify"
                            }
                          </button>
                        </td>
                      </tr>
                    `
                  )
                  .join("") ||
                `
                  <tr>
                    <td
                      colspan="6"
                      style="
                        padding:.8rem
                      "
                    >
                      No workers found.
                    </td>
                  </tr>
                `
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    target
      .querySelectorAll(
        ".verify-worker"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          async () => {
            button.disabled =
              true;

            try {
              await api(
                `/workers/${encodeURIComponent(
                  button.dataset.id
                )}`,
                {
                  method: "PATCH",

                  headers: {
                    "Content-Type":
                      "application/json"
                  },

                  body: JSON.stringify({
                    verified:
                      button.dataset
                        .value ===
                      "true"
                  })
                }
              );

              await loadVerification();
            } catch (error) {
              setStatus(
                error.message,
                true
              );

              button.disabled =
                false;
            }
          }
        );
      });

    setStatus(
      `Workers loaded: ${rows.length}`
    );
  }

  async function loadReports() {
    setStatus(
      "Loading reports…"
    );

    const [
      dashboard,
      payments,
      support,
      earnings
    ] = await Promise.all([
      api(
        "/admin/dashboard"
      ),

      api(
        "/payments/admin/all?limit=100"
      ),

      api(
        "/support/admin/all?limit=100"
      ),

      api(
        "/earnings/admin/summary"
      )
    ]);

    const data =
      dashboard.data;

    const paymentRows =
      Array.isArray(
        payments.data
      )
        ? payments.data
        : [];

    const supportRows =
      Array.isArray(
        support.data
      )
        ? support.data
        : [];

    const earningsData =
      earnings.data || {};

    const target =
      $("#adminTable");

    if (!target) {
      return;
    }

    target.innerHTML = `
      <div class="grid grid-3">

        <article class="card">
          <h3>Total Users</h3>
          <p>
            ${esc(
              data.users.total
            )}
          </p>
        </article>

        <article class="card">
          <h3>Total Workers</h3>
          <p>
            ${esc(
              data.workers.total
            )}
          </p>
        </article>

        <article class="card">
          <h3>Verified Workers</h3>
          <p>
            ${esc(
              data.workers.verified
            )}
          </p>
        </article>

        <article class="card">
          <h3>Total Jobs</h3>
          <p>
            ${esc(
              data.jobs.total
            )}
          </p>
        </article>

        <article class="card">
          <h3>Total Bookings</h3>
          <p>
            ${esc(
              data.bookings.total
            )}
          </p>
        </article>

        <article class="card">
          <h3>Paid Payments</h3>
          <p>
            ${esc(
              data.payments.paid
            )}
          </p>
        </article>

        <article class="card">
          <h3>Revenue</h3>
          <p>
            ${money(
              data.payments
                .totalRevenue
            )}
          </p>
        </article>

        <article class="card">
          <h3>Support Tickets</h3>
          <p>
            ${esc(
              supportRows.length
            )}
          </p>
        </article>

        <article class="card">
          <h3>Payment Records</h3>
          <p>
            ${esc(
              paymentRows.length
            )}
          </p>
        </article>

      </div>

      <div
        class="card"
        style="margin-top:1rem"
      >
        <h2>
          Earnings Summary
        </h2>

        <pre
          style="
            white-space:pre-wrap
          "
        >${esc(
          JSON.stringify(
            earningsData,
            null,
            2
          )
        )}</pre>
      </div>
    `;

    setStatus(
      "Reports connected successfully."
    );
  }

  async function boot() {
    try {
      const page =
        document.body.dataset
          .adminPage ||
        "dashboard";

      if (
        page ===
        "dashboard"
      ) {
        await loadDashboard();
      }

      if (
        page === "users"
      ) {
        await loadUsers();
      }

      if (
        page === "payments"
      ) {
        await loadPayments();
      }

      if (
        page === "jobs"
      ) {
        await loadJobs();
      }

      if (
        page ===
        "verification"
      ) {
        await loadVerification();
      }

      if (
        page === "reports"
      ) {
        await loadReports();
      }
    } catch (error) {
      console.error(error);

      setStatus(
        error.message ||
          "Unable to load admin data.",
        true
      );
    }
  }

  document.addEventListener(
    "DOMContentLoaded",
    boot
  );
})();
