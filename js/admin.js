"use strict";

(function () {
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

  const state = {
    page: "dashboard",
    loading: false
  };

  function escapeHtml(value) {
    const text = String(value ?? "");

    return Array.from(text)
      .map(function (char) {
        const code = char.charCodeAt(0);

        if (code === 38) return String.fromCharCode(38) + "amp;";
        if (code === 60) return String.fromCharCode(38) + "lt;";
        if (code === 62) return String.fromCharCode(38) + "gt;";
        if (code === 34) return String.fromCharCode(38) + "quot;";
        if (code === 39) return String.fromCharCode(38) + "#039;";

        return char;
      })
      .join("");
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

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString("en-IN");
  }

  function formatStatus(value) {
    const text = String(value || "—")
      .split("_")
      .join(" ")
      .trim();

    return (
      "<span class=\"badge\">" +
      escapeHtml(text) +
      "</span>"
    );
  }

  function getElement(id) {
    return document.getElementById(id);
  }

  function setStatus(message) {
    const element = getElement("adminStatus");

    if (element) {
      element.textContent = String(message || "");
    }
  }

  function showError(error) {
    console.error("ADMIN ERROR:", error);

    setStatus(
      error && error.message
        ? error.message
        : "Something went wrong. Please try again."
    );
  }

  function renderCards(items) {
    const element = getElement("adminCards");

    if (!element) {
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      element.innerHTML = "";
      return;
    }

    element.innerHTML = items
      .map(function (item) {
        return (
          "<article class=\"card\">" +
          "<h3>" +
          escapeHtml(item.label) +
          "</h3>" +
          "<p>" +
          escapeHtml(item.value) +
          "</p>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderTable(headers, rows) {
    const element = getElement("adminTable");

    if (!element) {
      return;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      element.innerHTML =
        "<p class=\"muted\">No records found.</p>";
      return;
    }

    const headerHtml = headers
      .map(function (header) {
        return (
          "<th>" +
          escapeHtml(header) +
          "</th>"
        );
      })
      .join("");

    const bodyHtml = rows
      .map(function (row) {
        return (
          "<tr>" +
          row
            .map(function (cell) {
              return "<td>" + (cell ?? "") + "</td>";
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");

    element.innerHTML =
      "<div style=\"overflow-x:auto\">" +
      "<table>" +
      "<thead><tr>" +
      headerHtml +
      "</tr></thead>" +
      "<tbody>" +
      bodyHtml +
      "</tbody>" +
      "</table>" +
      "</div>";
  }

  async function request(endpoint, options) {
    const config = {
      ...(options || {})
    };

    /*
     * ROOT-CAUSE FIX:
     * SWN.raw() passes fetch() the body as-is.
     * Admin mutation calls use objects, so convert
     * plain objects to JSON before sending.
     */
    if (
      config.body !== undefined &&
      config.body !== null &&
      typeof config.body === "object" &&
      !(
        typeof FormData !== "undefined" &&
        config.body instanceof FormData
      ) &&
      !(
        typeof Blob !== "undefined" &&
        config.body instanceof Blob
      ) &&
      !(
        typeof URLSearchParams !== "undefined" &&
        config.body instanceof URLSearchParams
      )
    ) {
      config.body = JSON.stringify(config.body);
    }

    if (
      window.SWN &&
      typeof window.SWN.request === "function"
    ) {
      return window.SWN.request(
        endpoint,
        config
      );
    }

    if (
      typeof window.apiFetch === "function"
    ) {
      return window.apiFetch(
        endpoint,
        config
      );
    }

    throw new Error(
      "Central API client is unavailable."
    );
  }

  async function protectAdmin() {
    if (typeof window.protect === "function") {
      const result = await window.protect("admin");

      if (!result) {
        return false;
      }
    }

    if (
      typeof window.getCurrentUser ===
      "function"
    ) {
      const user = window.getCurrentUser();

      if (
        !user ||
        user.role !== "admin"
      ) {
        window.location.href = "login.html";
        return false;
      }
    }

    return true;
  }

  async function loadDashboard() {
    const response =
      await request("/admin/dashboard");

    const data = response?.data || {};
    const payments = data.payments || {};

    renderCards([
      {
        label: "Total Users",
        value: String(data.users?.total ?? 0)
      },
      {
        label: "Active Users",
        value: String(data.users?.active ?? 0)
      },
      {
        label: "Workers",
        value: String(data.workers?.total ?? 0)
      },
      {
        label: "Verified Workers",
        value: String(data.workers?.verified ?? 0)
      },
      {
        label: "Open Jobs",
        value: String(data.jobs?.open ?? 0)
      },
      {
        label: "Total Bookings",
        value: String(data.bookings?.total ?? 0)
      },
      {
        label: "Paid Payments",
        value: String(payments.paid ?? 0)
      },
      {
        label: "Net Revenue",
        value: money(payments.netRevenue ?? 0)
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
      users.map(function (user) {
        return [
          escapeHtml(user.name || "Unknown"),
          escapeHtml(user.email || "—"),
          escapeHtml(user.phone || "—"),
          formatStatus(user.role),
          escapeHtml(user.location || "—"),
          formatStatus(
            user.isActive
              ? "active"
              : "inactive"
          ),
          formatDate(user.createdAt)
        ];
      })
    );

    setStatus("User management loaded.");
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
          jobs.filter(function (job) {
            return job.status === "open";
          }).length
        )
      },
      {
        label: "Completed",
        value: String(
          jobs.filter(function (job) {
            return job.status === "completed";
          }).length
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
      jobs.map(function (job) {
        const id =
          job._id ||
          job.id ||
          "";

        const actionButtons =
          JOB_STATUSES
            .map(function (jobStatus) {
              return (
                "<button " +
                "type=\"button\" " +
                "data-admin-job-status=\"" +
                escapeHtml(id) +
                "\" " +
                "data-status=\"" +
                escapeHtml(jobStatus) +
                "\">" +
                escapeHtml(
                  jobStatus
                    .split("_")
                    .join(" ")
                ) +
                "</button>"
              );
            })
            .join("");

        return [
          "<strong>" +
            escapeHtml(
              job.title ||
              "Untitled job"
            ) +
            "</strong><br><small>" +
            escapeHtml(
              job.service || ""
            ) +
            "</small>",

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

          formatStatus(job.status),

          "<div style=\"display:flex;gap:6px;flex-wrap:wrap\">" +
            actionButtons +
            "<button " +
            "type=\"button\" " +
            "data-admin-job-delete=\"" +
            escapeHtml(id) +
            "\">Delete</button>" +
            "</div>"
        ];
      })
    );

    setStatus("Job management loaded.");
  }

  async function changeJobStatus(id, status) {
    if (!JOB_STATUSES.includes(status)) {
      throw new Error(
        "Invalid job status."
      );
    }

    const response =
      await request(
        "/admin/jobs/" +
          encodeURIComponent(id),
        {
          method: "PATCH",
          body: {
            status: status
          }
        }
      );

    if (response?.success === false) {
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
        "/admin/jobs/" +
          encodeURIComponent(id),
        {
          method: "DELETE"
        }
      );

    if (response?.success === false) {
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

    renderCards([
      {
        label: "Workers Loaded",
        value: String(workers.length)
      },
      {
        label: "Verified",
        value: String(
          workers.filter(function (worker) {
            return worker.verified === true;
          }).length
        )
      },
      {
        label: "Active",
        value: String(
          workers.filter(function (worker) {
            return worker.isActive === true;
          }).length
        )
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
      workers.map(function (worker) {
        const id =
          worker._id ||
          worker.id ||
          "";

        const buttons =
          WORKER_ACTIONS
            .map(function (action) {
              return (
                "<button " +
                "type=\"button\" " +
                "data-admin-worker=\"" +
                escapeHtml(id) +
                "\" " +
                "data-action=\"" +
                escapeHtml(action) +
                "\">" +
                escapeHtml(
                  action
                    .split("_")
                    .join(" ")
                ) +
                "</button>"
              );
            })
            .join("");

        return [
          "<strong>" +
            escapeHtml(
              worker.name ||
              "Unknown"
            ) +
            "</strong><br><small>" +
            escapeHtml(
              worker.phone || ""
            ) +
            "</small>",

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

          "<div style=\"display:flex;gap:6px;flex-wrap:wrap\">" +
            buttons +
            "</div>"
        ];
      })
    );

    setStatus(
      "Worker verification and management loaded."
    );
  }

  async function changeWorker(id, action) {
    if (!WORKER_ACTIONS.includes(action)) {
      throw new Error(
        "Invalid worker action."
      );
    }

    const updates = {};

    if (action === "verify") {
      updates.verified = true;
    }

    if (action === "unverify") {
      updates.verified = false;
    }

    if (action === "activate") {
      updates.isActive = true;
    }

    if (action === "deactivate") {
      updates.isActive = false;
    }

    if (action === "available") {
      updates.isAvailable = true;
    }

    if (action === "unavailable") {
      updates.isAvailable = false;
    }

    const response =
      await request(
        "/admin/workers/" +
          encodeURIComponent(id),
        {
          method: "PATCH",
          body: updates
        }
      );

    if (response?.success === false) {
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
        value: String(payments.length)
      },
      {
        label: "Paid",
        value: String(
          payments.filter(function (payment) {
            return payment.status === "paid";
          }).length
        )
      },
      {
        label: "Refunded",
        value: String(
          payments.filter(function (payment) {
            return payment.status === "refunded";
          }).length
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
      payments.map(function (payment) {
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
          ].includes(payment.status)
        ) {
          actions +=
            "<button " +
            "type=\"button\" " +
            "data-admin-payment-cancel=\"" +
            escapeHtml(id) +
            "\">Cancel</button>";
        }

        if (
          payment.status === "paid" &&
          payment.gatewayPaymentId
        ) {
          actions +=
            "<button " +
            "type=\"button\" " +
            "data-admin-payment-refund=\"" +
            escapeHtml(id) +
            "\">Refund</button>";
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

          "<div style=\"display:flex;gap:6px;flex-wrap:wrap\">" +
            (actions || "—") +
            "</div>"
        ];
      })
    );

    setStatus(
      "Payment management loaded."
    );
  }

  async function cancelPayment(id) {
    if (
      !window.confirm(
        "Cancel this active payment?"
      )
    ) {
      return;
    }

    const response =
      await request(
        "/admin/payments/" +
          encodeURIComponent(id) +
          "/status",
        {
          method: "PATCH",
          body: {
            status: "cancelled"
          }
        }
      );

    if (response?.success === false) {
      throw new Error(
        response.message ||
        "Unable to cancel payment."
      );
    }

    await loadPayments();
  }

  async function refundPayment(id) {
    if (
      !window.confirm(
        "Refund the full Razorpay payment? This action cannot be undone."
      )
    ) {
      return;
    }

    const response =
      await request(
        "/admin/payments/" +
          encodeURIComponent(id) +
          "/refund",
        {
          method: "POST"
        }
      );

    if (response?.success === false) {
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
        value: String(bookings.length)
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
      bookings.map(function (booking) {
        return [
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
        ];
      })
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

    const cards = [];

    Object.entries(data).forEach(
      function (entry) {
        const key = entry[0];
        const value = entry[1];

        if (
          value !== null &&
          typeof value !== "object" &&
          typeof value !== "function"
        ) {
          cards.push({
            label: key
              .split("_")
              .join(" "),
            value: String(value)
          });
        }
      }
    );

    renderCards(
      cards.length
        ? cards
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
      document.body?.dataset?.adminPage;

    if (bodyPage) {
      return bodyPage
        .trim()
        .toLowerCase();
    }

    const file =
      window.location.pathname
        .split("/")
        .pop()
        .toLowerCase();

    if (file.includes("verification")) {
      return "verification";
    }

    if (file.includes("jobs")) {
      return "jobs";
    }

    if (file.includes("workers")) {
      return "workers";
    }

    if (file.includes("payments")) {
      return "payments";
    }

    if (file.includes("bookings")) {
      return "bookings";
    }

    if (file.includes("reports")) {
      return "reports";
    }

    if (file.includes("users")) {
      return "users";
    }

    return "dashboard";
  }

  async function loadCurrentPage() {
    state.page = getPage();

    if (state.page === "dashboard") {
      await loadDashboard();
      return;
    }

    if (state.page === "users") {
      await loadUsers();
      return;
    }

    if (state.page === "jobs") {
      await loadJobs();
      return;
    }

    if (state.page === "workers") {
      await loadWorkers();
      return;
    }

    if (state.page === "verification") {
      await loadVerification();
      return;
    }

    if (state.page === "payments") {
      await loadPayments();
      return;
    }

    if (state.page === "bookings") {
      await loadBookings();
      return;
    }

    if (state.page === "reports") {
      await loadReports();
      return;
    }

    await loadDashboard();
  }

  function bindEvents() {
    document.addEventListener(
      "click",
      async function (event) {
        const jobStatusButton =
          event.target.closest(
            "[data-admin-job-status]"
          );

        if (jobStatusButton) {
          event.preventDefault();

          try {
            setStatus(
              "Updating job..."
            );

            await changeJobStatus(
              jobStatusButton.dataset
                .adminJobStatus,
              jobStatusButton.dataset
                .status
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

          try {
            setStatus(
              "Deleting job..."
            );

            await deleteJob(
              jobDeleteButton.dataset
                .adminJobDelete
            );
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

          try {
            setStatus(
              "Updating worker..."
            );

            await changeWorker(
              workerButton.dataset
                .adminWorker,
              workerButton.dataset
                .action
            );
          } catch (error) {
            showError(error);
          }

          return;
        }

        const cancelButton =
          event.target.closest(
            "[data-admin-payment-cancel]"
          );

        if (cancelButton) {
          event.preventDefault();

          try {
            setStatus(
              "Cancelling payment..."
            );

            await cancelPayment(
              cancelButton.dataset
                .adminPaymentCancel
            );
          } catch (error) {
            showError(error);
          }

          return;
        }

        const refundButton =
          event.target.closest(
            "[data-admin-payment-refund]"
          );

        if (refundButton) {
          event.preventDefault();

          try {
            setStatus(
              "Processing refund..."
            );

            await refundPayment(
              refundButton.dataset
                .adminPaymentRefund
            );
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
    state: state,
    loadDashboard: loadDashboard,
    loadUsers: loadUsers,
    loadJobs: loadJobs,
    loadWorkers: loadWorkers,
    loadVerification: loadVerification,
    loadPayments: loadPayments,
    loadBookings: loadBookings,
    loadReports: loadReports,
    refresh: loadCurrentPage
  };

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }
})();
