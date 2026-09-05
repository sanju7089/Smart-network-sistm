"use strict";

/*
========================================================
SMART WORK NETWORK
DASHBOARD.JS
========================================================

Customer:
- Account summary
- Posted work
- Booking history
- Payment history
- Dashboard statistics

Worker:
- Available jobs
- My bookings
- Profile status
- Recent bookings

Admin:
- Redirect to admin dashboard
========================================================
*/

function getData(result) {
  if (!result || typeof result !== "object") {
    return {};
  }

  if (
    result.data !== undefined &&
    result.data !== null
  ) {
    return result.data;
  }

  return result;
}


/* ======================================================
   SECURITY / HTML ESCAPING
====================================================== */

function escapeDashboardHtml(value = "") {
  if (
    typeof window.escapeHtml === "function"
  ) {
    return window.escapeHtml(value);
  }

  const div = document.createElement("div");

  div.textContent = String(value);

  return div.innerHTML;
}


/* ======================================================
   API
====================================================== */

async function fetchApiData(path) {
  try {
    if (
      window.SWN &&
      typeof window.SWN.request === "function"
    ) {
      return await window.SWN.request(path);
    }

    if (
      typeof window.apiFetch === "function"
    ) {
      return await window.apiFetch(path);
    }

    throw new Error(
      "API client is not available."
    );

  } catch (error) {
    return {
      ok: false,
      success: false,
      message:
        error?.message ||
        `API request failed: ${path}`,
      error
    };
  }
}


/* ======================================================
   COMMON HELPERS
====================================================== */

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat(
    "en-IN"
  ).format(number);
}


function formatMoneyFromPaise(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "₹0";
  }

  return `₹${new Intl.NumberFormat(
    "en-IN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  ).format(number / 100)}`;
}


function formatMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "₹0";
  }

  return `₹${new Intl.NumberFormat(
    "en-IN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  ).format(number)}`;
}


function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}


function getId(item) {
  return (
    item?._id ||
    item?.id ||
    item?.userId ||
    null
  );
}


function normalizeStatus(value) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
}


function getJobStatus(job) {
  const status =
    normalizeStatus(
      job?.status
    );

  if (
    status === "completed"
  ) {
    return "Completed";
  }

  if (
    status === "in_progress"
  ) {
    return "In Progress";
  }

  if (
    status === "cancelled" ||
    status === "canceled"
  ) {
    return "Cancelled";
  }

  if (
    status === "closed"
  ) {
    return "Closed";
  }

  if (
    status === "accepted"
  ) {
    return "Accepted";
  }

  if (
    status === "confirmed"
  ) {
    return "Confirmed";
  }

  return "Open";
}


function getBookingStatus(booking) {
  const status =
    normalizeStatus(
      booking?.status
    );

  if (
    status === "completed"
  ) {
    return "Completed";
  }

  if (
    status === "in_progress"
  ) {
    return "In Progress";
  }

  if (
    status === "confirmed"
  ) {
    return "Confirmed";
  }

  if (
    status === "accepted"
  ) {
    return "Accepted";
  }

  if (
    status === "rejected"
  ) {
    return "Rejected";
  }

  if (
    status === "cancelled" ||
    status === "canceled"
  ) {
    return "Cancelled";
  }

  return "Pending";
}


function getPaymentStatus(payment) {
  const status =
    normalizeStatus(
      payment?.status
    );

  if (
    status === "paid" ||
    status === "success" ||
    status === "successful"
  ) {
    return "Paid";
  }

  if (
    status === "failed"
  ) {
    return "Failed";
  }

  if (
    status === "refunded"
  ) {
    return "Refunded";
  }

  if (
    status === "cancelled" ||
    status === "canceled"
  ) {
    return "Cancelled";
  }

  if (
    status === "processing"
  ) {
    return "Processing";
  }

  if (
    status === "pending"
  ) {
    return "Pending";
  }

  if (
    status === "created"
  ) {
    return "Created";
  }

  return status
    ? String(status)
        .replace(/_/g, " ")
        .replace(/\b\w/g, c =>
          c.toUpperCase()
        )
    : "Unknown";
}


function getPaymentAmount(payment) {
  const amount =
    Number(
      payment?.amount
    );

  if (
    !Number.isFinite(amount)
  ) {
    return "₹0";
  }

  /*
    Backend stores Razorpay amount
    in paise.
  */
  return formatMoneyFromPaise(
    amount
  );
}


/* ======================================================
   DASHBOARD UI HELPERS
====================================================== */

function createStatusCard(
  label,
  count
) {
  return `
    <div class="dashboard-status-card">

      <div
        class="dashboard-status-card__label"
      >
        ${escapeDashboardHtml(label)}
      </div>

      <div
        class="dashboard-status-card__count"
      >
        ${formatNumber(count)}
      </div>

    </div>
  `;
}


function showDashboardError(
  element,
  message
) {
  if (!element) {
    return;
  }

  element.innerHTML = `
    <div
      class="dashboard-error"
      role="alert"
    >

      <h3>
        Something went wrong
      </h3>

      <p>
        ${escapeDashboardHtml(
          message ||
          "Unable to load dashboard data."
        )}
      </p>

      <button
        type="button"
        onclick="window.location.reload()"
      >
        Retry
      </button>

    </div>
  `;
}


function createEmptyState(
  message,
  link,
  linkText
) {
  return `
    <div class="dashboard-empty">

      <p>
        ${escapeDashboardHtml(message)}
      </p>

      ${
        link && linkText
          ? `
            <a href="${escapeDashboardHtml(link)}">
              ${escapeDashboardHtml(linkText)}
            </a>
          `
          : ""
      }

    </div>
  `;
}


/* ======================================================
   CUSTOMER ACCOUNT CARD
====================================================== */

function createCustomerAccountCard(
  user
) {
  const name =
    user?.name ||
    "Customer";

  const email =
    user?.email ||
    "—";

  const phone =
    user?.phone ||
    "Not added";

  const location =
    user?.location ||
    "Not added";

  return `
    <section class="dashboard-section">

      <div
        class="dashboard-section__header"
      >

        <div>
          <h2>
            My Account
          </h2>

          <p>
            Your Smart Work Network account details.
          </p>
        </div>

        <a href="profile.html">
          Edit Profile
        </a>

      </div>

      <div class="dashboard-profile-grid">

        <div class="dashboard-profile-item">
          <strong>
            Name
          </strong>

          <span>
            ${escapeDashboardHtml(name)}
          </span>
        </div>

        <div class="dashboard-profile-item">
          <strong>
            Email
          </strong>

          <span>
            ${escapeDashboardHtml(email)}
          </span>
        </div>

        <div class="dashboard-profile-item">
          <strong>
            Phone
          </strong>

          <span>
            ${escapeDashboardHtml(phone)}
          </span>
        </div>

        <div class="dashboard-profile-item">
          <strong>
            Location
          </strong>

          <span>
            ${escapeDashboardHtml(location)}
          </span>
        </div>

        <div class="dashboard-profile-item">
          <strong>
            Account Type
          </strong>

          <span>
            Customer
          </span>
        </div>

      </div>

    </section>
  `;
}


/* ======================================================
   CUSTOMER JOB CARD
====================================================== */

function createCustomerJobCard(
  job
) {
  const id =
    getId(job);

  const title =
    job?.title ||
    "Untitled Job";

  const description =
    job?.description ||
    "No description available.";

  const status =
    getJobStatus(job);

  const budget =
    job?.budget !== undefined &&
    job?.budget !== null &&
    job?.budget !== ""
      ? formatMoney(job.budget)
      : null;

  const location =
    job?.location ||
    "";

  return `
    <article
      class="dashboard-job-card"
    >

      <h3>
        ${escapeDashboardHtml(title)}
      </h3>

      <p>
        ${escapeDashboardHtml(description)}
      </p>

      <div
        class="dashboard-job-meta"
      >

        <span>
          Status:
          ${escapeDashboardHtml(status)}
        </span>

        ${
          budget
            ? `
              <span>
                Budget:
                ${escapeDashboardHtml(budget)}
              </span>
            `
            : ""
        }

        ${
          location
            ? `
              <span>
                Location:
                ${escapeDashboardHtml(location)}
              </span>
            `
            : ""
        }

        ${
          job?.createdAt
            ? `
              <span>
                Posted:
                ${escapeDashboardHtml(
                  formatDate(job.createdAt)
                )}
              </span>
            `
            : ""
        }

      </div>

      ${
        id
          ? `
            <a
              href="work-request.html?id=${encodeURIComponent(id)}"
            >
              View Job
            </a>
          `
          : ""
      }

    </article>
  `;
}


/* ======================================================
   CUSTOMER BOOKING CARD
====================================================== */

function createCustomerBookingCard(
  booking
) {
  const id =
    getId(booking);

  const status =
    getBookingStatus(
      booking
    );

  const job =
    booking?.jobId;

  const jobTitle =
    booking?.job?.title ||
    booking?.jobTitle ||
    job?.title ||
    "Work Booking";

  const date =
    booking?.date ||
    booking?.scheduledDate ||
    booking?.createdAt;

  const worker =
    booking?.worker ||
    booking?.workerId;

  const workerName =
    worker?.name ||
    booking?.workerName ||
    "Worker";

  return `
    <article
      class="dashboard-booking-card"
    >

      <h3>
        ${escapeDashboardHtml(jobTitle)}
      </h3>

      <div
        class="dashboard-job-meta"
      >

        <span>
          Worker:
          ${escapeDashboardHtml(workerName)}
        </span>

        <span>
          Status:
          ${escapeDashboardHtml(status)}
        </span>

        ${
          date
            ? `
              <span>
                Date:
                ${escapeDashboardHtml(
                  formatDate(date)
                )}
              </span>
            `
            : ""
        }

      </div>

      ${
        id
          ? `
            <a
              href="bookings.html?id=${encodeURIComponent(id)}"
            >
              View Booking
            </a>
          `
          : ""
      }

    </article>
  `;
}


/* ======================================================
   CUSTOMER PAYMENT CARD
====================================================== */

function createCustomerPaymentCard(
  payment
) {
  const id =
    getId(payment);

  const status =
    getPaymentStatus(
      payment
    );

  const amount =
    getPaymentAmount(
      payment
    );

  const transaction =
    payment?.transactionId ||
    payment?.gatewayPaymentId ||
    payment?.razorpayPaymentId ||
    "—";

  const date =
    payment?.paidAt ||
    payment?.createdAt;

  return `
    <article
      class="dashboard-payment-card"
    >

      <div
        class="dashboard-payment-main"
      >

        <h3>
          ${escapeDashboardHtml(amount)}
        </h3>

        <p>
          Status:
          ${escapeDashboardHtml(status)}
        </p>

      </div>

      <div
        class="dashboard-job-meta"
      >

        <span>
          Transaction:
          ${escapeDashboardHtml(transaction)}
        </span>

        ${
          date
            ? `
              <span>
                Date:
                ${escapeDashboardHtml(
                  formatDate(date)
                )}
              </span>
            `
            : ""
        }

        ${
          payment?.method
            ? `
              <span>
                Method:
                ${escapeDashboardHtml(
                  payment.method
                )}
              </span>
            `
            : ""
        }

      </div>

      ${
        id
          ? `
            <a
              href="payment.html?id=${encodeURIComponent(id)}"
            >
              View Payment
            </a>
          `
          : ""
      }

    </article>
  `;
}


/* ======================================================
   CUSTOMER DASHBOARD
====================================================== */

async function loadCustomerDashboard(
  element,
  user
) {
  if (!element) {
    return;
  }

  const customerId =
    user?.id ||
    user?._id ||
    user?.userId;

  if (!customerId) {
    showDashboardError(
      element,
      "Your account information is incomplete."
    );

    return;
  }

  element.innerHTML = `
    <div class="dashboard-loading">
      Loading your customer dashboard...
    </div>
  `;

  /*
    Important:
    Do NOT rely on cached customerId
    for security-sensitive ownership.
    Backend also validates ownership.
  */

  const [
    profileResult,
    jobsResult,
    bookingsResult,
    paymentsResult
  ] = await Promise.all([
    fetchApiData(
      "/users/me"
    ),

    fetchApiData(
      `/jobs?customerId=${encodeURIComponent(
        customerId
      )}`
    ),

    fetchApiData(
      "/bookings"
    ),

    fetchApiData(
      "/payments?limit=20&page=1"
    )
  ]);

  /*
  ======================================================
  PROFILE
  ======================================================
  */

  let customer =
    user;

  if (
    profileResult &&
    profileResult.ok !== false &&
    profileResult.success !== false
  ) {
    const profileData =
      getData(profileResult);

    customer =
      profileData?.user ||
      profileData?.data?.user ||
      profileData ||
      user;
  }

  /*
  ======================================================
  JOBS
  ======================================================
  */

  let jobs = [];

  if (
    jobsResult &&
    jobsResult.ok !== false &&
    jobsResult.success !== false
  ) {
    const jobsData =
      getData(jobsResult);

    jobs =
      Array.isArray(jobsData)
        ? jobsData
        : Array.isArray(
            jobsData?.jobs
          )
          ? jobsData.jobs
          : [];
  }

  /*
  ======================================================
  BOOKINGS
  ======================================================
  */

  let bookings = [];

  if (
    bookingsResult &&
    bookingsResult.ok !== false &&
    bookingsResult.success !== false
  ) {
    const bookingsData =
      getData(bookingsResult);

    bookings =
      Array.isArray(bookingsData)
        ? bookingsData
        : Array.isArray(
            bookingsData?.bookings
          )
          ? bookingsData.bookings
          : [];
  }

  /*
  ======================================================
  PAYMENTS
  ======================================================
  */

  let payments = [];

  let paymentsError = "";

  if (
    paymentsResult &&
    paymentsResult.ok !== false &&
    paymentsResult.success !== false
  ) {
    const paymentsData =
      getData(paymentsResult);

    payments =
      Array.isArray(paymentsData)
        ? paymentsData
        : Array.isArray(
            paymentsData?.payments
          )
          ? paymentsData.payments
          : [];
  } else {
    paymentsError =
      paymentsResult?.message ||
      "Payment history is temporarily unavailable.";
  }

  /*
  ======================================================
  JOB STATISTICS
  ======================================================
  */

  const openJobs =
    jobs.filter(
      job =>
        normalizeStatus(
          job?.status
        ) === "open"
    );

  const activeJobs =
    jobs.filter(
      job =>
        [
          "open",
          "accepted",
          "confirmed",
          "in_progress"
        ].includes(
          normalizeStatus(
            job?.status
          )
        )
    );

  const completedJobs =
    jobs.filter(
      job =>
        normalizeStatus(
          job?.status
        ) === "completed"
    );

  const cancelledJobs =
    jobs.filter(
      job =>
        [
          "cancelled",
          "canceled"
        ].includes(
          normalizeStatus(
            job?.status
          )
        )
    );

  /*
  ======================================================
  BOOKING STATISTICS
  ======================================================
  */

  const activeBookings =
    bookings.filter(
      booking =>
        [
          "pending",
          "accepted",
          "confirmed",
          "in_progress"
        ].includes(
          normalizeStatus(
            booking?.status
          )
        )
    );

  const completedBookings =
    bookings.filter(
      booking =>
        normalizeStatus(
          booking?.status
        ) === "completed"
    );

  const cancelledBookings =
    bookings.filter(
      booking =>
        [
          "cancelled",
          "canceled"
        ].includes(
          normalizeStatus(
            booking?.status
          )
        )
    );

  /*
  ======================================================
  PAYMENT STATISTICS
  ======================================================
  */

  const paidPayments =
    payments.filter(
      payment =>
        [
          "paid",
          "success",
          "successful"
        ].includes(
          normalizeStatus(
            payment?.status
          )
        )
    );

  const paymentTotalPaise =
    paidPayments.reduce(
      (total, payment) => {
        const amount =
          Number(
            payment?.amount
          );

        if (
          !Number.isFinite(
            amount
          )
        ) {
          return total;
        }

        return total + amount;
      },
      0
    );

  /*
  ======================================================
  RENDER CUSTOMER DASHBOARD
  ======================================================
  */

  element.innerHTML = `

    <!-- ACCOUNT HEADER -->

    <section class="dashboard-section">

      <div
        class="dashboard-section__header"
      >

        <div>

          <h1>
            Welcome,
            ${escapeDashboardHtml(
              customer?.name ||
              "Customer"
            )}
          </h1>

          <p>
            Manage your work, bookings and payments.
          </p>

        </div>

        <a
          class="btn btn-primary"
          href="post-work.html"
        >
          Post New Work
        </a>

      </div>

    </section>


    <!-- MAIN STATISTICS -->

    <section class="dashboard-summary">

      ${createStatusCard(
        "Total Jobs",
        jobs.length
      )}

      ${createStatusCard(
        "Open Jobs",
        openJobs.length
      )}

      ${createStatusCard(
        "Active Bookings",
        activeBookings.length
      )}

      ${createStatusCard(
        "Completed",
        completedJobs.length
      )}

      ${createStatusCard(
        "Total Bookings",
        bookings.length
      )}

      ${createStatusCard(
        "Payments",
        payments.length
      )}

    </section>


    <!-- ACCOUNT -->

    ${createCustomerAccountCard(
      customer
    )}


    <!-- POSTED WORK -->

    <section class="dashboard-section">

      <div
        class="dashboard-section__header"
      >

        <div>

          <h2>
            My Posted Work
          </h2>

          <p>
            Work requests posted from your customer account.
          </p>

        </div>

        <a href="post-work.html">
          Post New Work
        </a>

      </div>

      <div
        class="dashboard-job-list"
      >

        ${
          jobs.length
            ? jobs
                .map(
                  createCustomerJobCard
                )
                .join("")
            : createEmptyState(
                "You have not posted any work yet.",
                "post-work.html",
                "Post Your First Work"
              )
        }

      </div>

    </section>


    <!-- BOOKINGS -->

    <section class="dashboard-section">

      <div
        class="dashboard-section__header"
      >

        <div>

          <h2>
            My Bookings
          </h2>

          <p>
            Track workers and booking status.
          </p>

        </div>

        <a href="bookings.html">
          View All Bookings
        </a>

      </div>

      <div
        class="dashboard-booking-list"
      >

        ${
          bookings.length
            ? bookings
                .slice(0, 10)
                .map(
                  createCustomerBookingCard
                )
                .join("")
            : createEmptyState(
                "You do not have any bookings yet.",
                "workers.html",
                "Find a Worker"
              )
        }

      </div>

    </section>


    <!-- PAYMENT HISTORY -->

    <section class="dashboard-section">

      <div
        class="dashboard-section__header"
      >

        <div>

          <h2>
            Payment History
          </h2>

          <p>
            Your customer payment records.
          </p>

        </div>

        <a href="payments.html">
          View All Payments
        </a>

      </div>

      ${
        paymentsError
          ? `
            <div
              class="dashboard-error"
              role="alert"
            >
              <p>
                ${escapeDashboardHtml(
                  paymentsError
                )}
              </p>

              <button
                type="button"
                onclick="window.location.reload()"
              >
                Retry
              </button>
            </div>
          `
          : `
            <div
              class="dashboard-payment-summary"
            >

              ${createStatusCard(
                "Payment Records",
                payments.length
              )}

              ${createStatusCard(
                "Successful Payments",
                paidPayments.length
              )}

              <div
                class="dashboard-status-card"
              >

                <div
                  class="dashboard-status-card__label"
                >
                  Total Paid
                </div>

                <div
                  class="dashboard-status-card__count"
                >
                  ${escapeDashboardHtml(
                    formatMoneyFromPaise(
                      paymentTotalPaise
                    )
                  )}
                </div>

              </div>

            </div>

            <div
              class="dashboard-payment-list"
            >

              ${
                payments.length
                  ? payments
                      .slice(0, 10)
                      .map(
                        createCustomerPaymentCard
                      )
                      .join("")
                  : createEmptyState(
                      "No payment history is available yet.",
                      null,
                      null
                    )
              }

            </div>
          `
      }

    </section>


    <!-- QUICK ACTIONS -->

    <section class="dashboard-section">

      <div
        class="dashboard-section__header"
      >

        <h2>
          Quick Actions
        </h2>

      </div>

      <div
        class="dashboard-quick-actions"
      >

        <a href="post-work.html">
          Post Work
        </a>

        <a href="workers.html">
          Find Worker
        </a>

        <a href="bookings.html">
          My Bookings
        </a>

        <a href="payments.html">
          Payment History
        </a>

        <a href="profile.html">
          My Profile
        </a>

        <a href="support.html">
          Support
        </a>

      </div>

    </section>

  `;
}


/* ======================================================
   WORKER DASHBOARD
====================================================== */

async function loadWorkerDashboard(
  element
) {
  if (!element) {
    return;
  }

  element.innerHTML = `
    <div class="dashboard-loading">
      Loading worker dashboard...
    </div>
  `;

  const [
    jobsResult,
    bookingsResult,
    profileResult
  ] = await Promise.all([
    fetchApiData(
      "/jobs?status=open"
    ),

    fetchApiData(
      "/bookings"
    ),

    fetchApiData(
      "/workers/me/profile"
    )
  ]);

  const jobsData =
    getData(jobsResult);

  const bookingsData =
    getData(bookingsResult);

  const profileData =
    getData(profileResult);

  const jobs =
    Array.isArray(jobsData)
      ? jobsData
      : Array.isArray(
          jobsData?.jobs
        )
        ? jobsData.jobs
        : [];

  const bookings =
    Array.isArray(bookingsData)
      ? bookingsData
      : Array.isArray(
          bookingsData?.bookings
        )
        ? bookingsData.bookings
        : [];

  const profile =
    profileData?.worker ||
    profileData?.profile ||
    profileData;

  const activeBookings =
    bookings.filter(
      booking =>
        [
          "pending",
          "accepted",
          "confirmed",
          "in_progress"
        ].includes(
          normalizeStatus(
            booking?.status
          )
        )
    );

  const completedBookings =
    bookings.filter(
      booking =>
        normalizeStatus(
          booking?.status
        ) === "completed"
    );

  const profileCompleted =
    Boolean(
      profile?.profileCompleted
    );

  element.innerHTML = `

    <section class="dashboard-summary">

      ${createStatusCard(
        "Available Jobs",
        jobs.length
      )}

      ${createStatusCard(
        "My Bookings",
        bookings.length
      )}

      ${createStatusCard(
        "Active Work",
        activeBookings.length
      )}

      ${createStatusCard(
        "Completed",
        completedBookings.length
      )}

    </section>


    <section class="dashboard-section">

      <div
        class="dashboard-section__header"
      >

        <h2>
          Worker Profile
        </h2>

        <a
          href="worker-profile.html?edit=1"
        >
          Edit My Profile
        </a>

      </div>

      <div
        class="dashboard-profile-status"
      >

        ${
          profileCompleted
            ? `
              <p>
                Your worker profile is complete.
              </p>
            `
            : `
              <p>
                Your worker profile is incomplete.
              </p>

              <a
                href="worker-profile.html?edit=1"
              >
                Complete My Profile
              </a>
            `
        }

      </div>

    </section>


    <section class="dashboard-section">

      <div
        class="dashboard-section__header"
      >

        <h2>
          Available Jobs
        </h2>

        <a href="find-work.html">
          View All Jobs
        </a>

      </div>

      <div
        class="dashboard-job-list"
      >

        ${
          jobs.length
            ? jobs
                .slice(0, 10)
                .map(
                  job => `
                    <article
                      class="dashboard-job-card"
                    >

                      <h3>
                        ${escapeDashboardHtml(
                          job?.title ||
                          "Untitled Job"
                        )}
                      </h3>

                      <p>
                        ${escapeDashboardHtml(
                          job?.description ||
                          "No description available."
                        )}
                      </p>

                      <div
                        class="dashboard-job-meta"
                      >

                        ${
                          job?.budget !== undefined &&
                          job?.budget !== null &&
                          job?.budget !== ""
                            ? `
                              <span>
                                Budget:
                                ${escapeDashboardHtml(
                                  formatMoney(
                                    job.budget
                                  )
                                )}
                              </span>
                            `
                            : ""
                        }

                        ${
                          job?.location
                            ? `
                              <span>
                                Location:
                                ${escapeDashboardHtml(
                                  job.location
                                )}
                              </span>
                            `
                            : ""
                        }

                      </div>

                      ${
                        getId(job)
                          ? `
                            <a
                              href="work-request.html?id=${encodeURIComponent(
                                getId(job)
                              )}"
                            >
                              View Job
                            </a>
                          `
                          : ""
                      }

                    </article>
                  `
                )
                .join("")
            : createEmptyState(
                "No open jobs are currently available.",
                null,
                null
              )
        }

      </div>

    </section>


    <section class="dashboard-section">

      <div
        class="dashboard-section__header"
      >

        <h2>
          Recent Bookings
        </h2>

        <a href="bookings.html">
          View Bookings
        </a>

      </div>

      <div
        class="dashboard-booking-list"
      >

        ${
          bookings.length
            ? bookings
                .slice(0, 10)
                .map(
                  booking => `
                    <article
                      class="dashboard-booking-card"
                    >

                      <h3>
                        ${escapeDashboardHtml(
                          booking?.job?.title ||
                          booking?.jobTitle ||
                          "Booking"
                        )}
                      </h3>

                      <p>
                        Status:
                        ${escapeDashboardHtml(
                          getBookingStatus(
                            booking
                          )
                        )}
                      </p>

                    </article>
                  `
                )
                .join("")
            : createEmptyState(
                "No bookings found.",
                null,
                null
              )
        }

      </div>

    </section>

  `;
}


/* ======================================================
   INITIALIZE DASHBOARD
====================================================== */

async function initializeDashboard() {
  const element =
    document.getElementById(
      "dashboardContent"
    );

  if (!element) {
    return;
  }

  let user = null;

  /*
    First use centralized auth state.
  */

  if (
    window.SWN &&
    typeof window.SWN.user ===
      "function"
  ) {
    user =
      window.SWN.user();
  }

  /*
    Compatibility with existing auth.js.
  */

  if (
    !user &&
    typeof window.getCurrentUser ===
      "function"
  ) {
    user =
      window.getCurrentUser();
  }

  /*
    Last fallback:
    ask backend for current user.
  */

  if (!user) {
    const result =
      await fetchApiData(
        "/auth/me"
      );

    if (
      result &&
      result.ok !== false &&
      result.success !== false
    ) {
      const data =
        getData(result);

      user =
        data?.user ||
        data?.data?.user ||
        data;
    }
  }

  if (!user) {
    showDashboardError(
      element,
      "Please log in to access your dashboard."
    );

    return;
  }

  const role =
    String(
      user?.role ||
      user?.userType ||
      user?.accountType ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    role === "worker"
  ) {
    await loadWorkerDashboard(
      element
    );

    return;
  }

  if (
    role === "customer" ||
    role === "user"
  ) {
    await loadCustomerDashboard(
      element,
      user
    );

    return;
  }

  if (
    role === "admin"
  ) {
    window.location.href =
      "admin.html";

    return;
  }

  showDashboardError(
    element,
    "Your account role is not recognized."
  );
}


/* ======================================================
   START
====================================================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    initializeDashboard();
  }
);


/* ======================================================
   GLOBAL EXPORTS
   Useful for existing pages/tests.
====================================================== */

window.initializeDashboard =
  initializeDashboard;

window.loadCustomerDashboard =
  loadCustomerDashboard;

window.loadWorkerDashboard =
  loadWorkerDashboard;
