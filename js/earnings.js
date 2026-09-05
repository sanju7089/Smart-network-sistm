"use strict";

function escapeEarningsHtml(value = "") {
if (
typeof window.escapeHtml === "function"
) {
return window.escapeHtml(String(value));
}

return String(value)
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, """)
.replace(/'/g, "'");
}

function formatMoney(value, currency = "INR") {
const amount = Number(value);

if (!Number.isFinite(amount)) {
return "₹0.00";
}

try {
return amount.toLocaleString("en-IN", {
style: "currency",
currency: currency || "INR",
maximumFractionDigits: 2
});
} catch {
return "₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}";
}
}

function formatDate(value) {
if (!value) {
return "Unknown";
}

const date = new Date(value);

if (Number.isNaN(date.getTime())) {
return "Unknown";
}

try {
return date.toLocaleString("en-IN", {
dateStyle: "medium",
timeStyle: "short"
});
} catch {
return date.toLocaleString("en-IN");
}
}

function showEarningsMessage(message, error = false) {
const element = document.querySelector("#earningsMessage");

if (!element) {
return;
}

element.innerHTML = "<div class="notice"> ${escapeEarningsHtml(message)} </div>";

if (error) {
console.error(message);
}
}

function getEarningsData(result) {
if (!result || typeof result !== "object") {
return {};
}

if (
result.data &&
typeof result.data === "object"
) {
return result.data;
}

return result;
}

function renderEarningsStats(data) {
const element = document.querySelector("#earningsStats");

if (!element) {
return;
}

const currency = data.currency || "INR";

const completedBookings =
Number(
data.completedBookingCount ??
data.completedPaidBookings ??
0
);

const totalPaidBookings =
Number(data.totalPaidBookings || 0);

element.innerHTML = `
<div class="card">
<div class="stat">
${escapeEarningsHtml(
formatMoney(
data.availableAmount,
currency
)
)}
</div>
<p>Available Earnings</p>
</div>

<div class="card">
  <div class="stat">
    ${escapeEarningsHtml(
      formatMoney(
        data.grossAmount,
        currency
      )
    )}
  </div>
  <p>Total Paid Earnings</p>
</div>

<div class="card">
  <div class="stat">
    ${escapeEarningsHtml(
      formatMoney(
        data.completedAmount,
        currency
      )
    )}
  </div>
  <p>Completed Work Earnings</p>
</div>

<div class="card">
  <div class="stat">
    ${escapeEarningsHtml(
      formatMoney(
        data.pendingWorkAmount,
        currency
      )
    )}
  </div>
  <p>Paid but Work Not Completed</p>
</div>

<div class="card">
  <div class="stat">
    ${escapeEarningsHtml(
      String(completedBookings)
    )}
  </div>
  <p>Completed Paid Bookings</p>
</div>

<div class="card">
  <div class="stat">
    ${escapeEarningsHtml(
      String(totalPaidBookings)
    )}
  </div>
  <p>Total Paid Bookings</p>
</div>

`;
}

function getTransactionId(payment) {
return (
payment.transactionId ||
payment.razorpayPaymentId ||
payment.razorpayOrderId ||
payment.id ||
"Not available"
);
}

function getJobTitle(payment) {
return (
payment.booking?.job?.title ||
"Work booking"
);
}

function renderPayments(payments) {
const element = document.querySelector(
"#earningsPayments"
);

if (!element) {
return;
}

if (
!Array.isArray(payments) ||
payments.length === 0
) {
element.innerHTML = "<div class="notice"> No earning transactions yet. </div>";
return;
}

element.innerHTML = payments
.map((payment) => {
const status = String(
payment.status || "unknown"
);

  const booking = payment.booking || {};

  const bookingId =
    booking.id || "";

  const jobTitle =
    getJobTitle(payment);

  const transactionId =
    getTransactionId(payment);

  const workStatus =
    booking.status || "Unknown";

  const amount =
    formatMoney(
      payment.amount,
      payment.currency || "INR"
    );

  const method =
    payment.method || "Unknown";

  return `
    <div class="card">

      <div class="row between">
        <b>
          ${escapeEarningsHtml(amount)}
        </b>

        <span class="tag">
          ${escapeEarningsHtml(status)}
        </span>
      </div>

      <p>
        <strong>Work:</strong>
        ${escapeEarningsHtml(jobTitle)}
      </p>

      <p>
        <strong>Booking ID:</strong>
        ${escapeEarningsHtml(
          String(bookingId)
        )}
      </p>

      <p>
        <strong>Transaction ID:</strong>
        ${escapeEarningsHtml(
          String(transactionId)
        )}
      </p>

      <p>
        <strong>Work status:</strong>
        ${escapeEarningsHtml(
          String(workStatus)
        )}
      </p>

      <p>
        <strong>Payment method:</strong>
        ${escapeEarningsHtml(
          String(method)
        )}
      </p>

      ${
        payment.razorpayPaymentId
          ? `
            <p>
              <strong>Razorpay Payment ID:</strong>
              ${escapeEarningsHtml(
                payment.razorpayPaymentId
              )}
            </p>
          `
          : ""
      }

      ${
        payment.razorpayOrderId
          ? `
            <p>
              <strong>Razorpay Order ID:</strong>
              ${escapeEarningsHtml(
                payment.razorpayOrderId
              )}
            </p>
          `
          : ""
      }

      ${
        payment.paidAt
          ? `
            <p class="muted">
              Paid:
              ${escapeEarningsHtml(
                formatDate(
                  payment.paidAt
                )
              )}
            </p>
          `
          : ""
      }

      ${
        payment.refundedAt
          ? `
            <p class="muted">
              Refunded:
              ${escapeEarningsHtml(
                formatDate(
                  payment.refundedAt
                )
              )}
            </p>
          `
          : ""
      }

      ${
        payment.refundId
          ? `
            <p class="muted">
              Refund ID:
              ${escapeEarningsHtml(
                payment.refundId
              )}
            </p>
          `
          : ""
      }

      ${
        Number(payment.refundAmount || 0) > 0
          ? `
            <p class="muted">
              Refund Amount:
              ${escapeEarningsHtml(
                formatMoney(
                  payment.refundAmount,
                  payment.currency || "INR"
                )
              )}
            </p>
          `
          : ""
      }

    </div>
  `;
})
.join("");

}

function renderPagination(pagination) {
const container = document.querySelector(
"#earningsPagination"
);

if (!container) {
return;
}

const page =
Number(pagination?.page || 1);

const totalPages =
Number(pagination?.totalPages || 0);

const total =
Number(pagination?.total || 0);

if (
total <= 0 ||
totalPages <= 1
) {
container.innerHTML = "";
return;
}

container.innerHTML = `
<div class="row between">

  <button
    class="btn"
    type="button"
    id="earningsPrevious"
    ${page <= 1 ? "disabled" : ""}
  >
    Previous
  </button>

  <span>
    Page
    ${escapeEarningsHtml(String(page))}
    of
    ${escapeEarningsHtml(String(totalPages))}
  </span>

  <button
    class="btn"
    type="button"
    id="earningsNext"
    ${page >= totalPages ? "disabled" : ""}
  >
    Next
  </button>

</div>

`;

const previous =
document.querySelector(
"#earningsPrevious"
);

const next =
document.querySelector(
"#earningsNext"
);

if (previous) {
previous.addEventListener(
"click",
() => {
if (page > 1) {
loadEarnings(page - 1);
}
}
);
}

if (next) {
next.addEventListener(
"click",
() => {
if (page < totalPages) {
loadEarnings(page + 1);
}
}
);
}
}

async function earningsRequest(endpoint) {
if (
window.SWN &&
typeof window.SWN.request === "function"
) {
return window.SWN.request(endpoint);
}

if (
typeof window.apiFetch === "function"
) {
return window.apiFetch(endpoint);
}

throw new Error(
"Central API client is not available."
);
}

async function loadEarnings(page = 1) {
const user =
typeof window.protect === "function"
? window.protect("worker")
: null;

if (!user) {
return;
}

const earningsMessage =
document.querySelector(
"#earningsMessage"
);

if (earningsMessage) {
earningsMessage.innerHTML = "";
}

try {
const endpoint =
"/earnings/me?page=${encodeURIComponent( page )}&limit=50";

/*
 * SWN.request() already returns parsed JSON.
 * Do NOT call response.json() here.
 */
const result =
  await earningsRequest(endpoint);

if (
  !result ||
  !result.success
) {
  throw new Error(
    result?.message ||
    "Unable to load earnings."
  );
}

const data =
  getEarningsData(result);

const subtitle =
  document.querySelector(
    "#earningsSubtitle"
  );

if (subtitle) {
  const completedBookings =
    Number(
      data.completedBookingCount ??
      data.completedPaidBookings ??
      0
    );

  subtitle.textContent =
    `${completedBookings} completed paid booking(s) • ${formatMoney(
      data.availableAmount,
      data.currency || "INR"
    )} available`;
}

renderEarningsStats(data);

renderPayments(
  Array.isArray(data.payments)
    ? data.payments
    : []
);

renderPagination(
  data.pagination || {}
);

} catch (error) {
showEarningsMessage(
error?.message ||
"Unable to load earnings.",
true
);

const stats =
  document.querySelector(
    "#earningsStats"
  );

const payments =
  document.querySelector(
    "#earningsPayments"
  );

const pagination =
  document.querySelector(
    "#earningsPagination"
  );

if (stats) {
  stats.innerHTML = "";
}

if (payments) {
  payments.innerHTML = "";
}

if (pagination) {
  pagination.innerHTML = "";
}

}
}

document.addEventListener(
"DOMContentLoaded",
() => {
const refresh =
document.querySelector(
"#refreshEarnings"
);

if (refresh) {
  refresh.addEventListener(
    "click",
    () => loadEarnings(1)
  );
}

loadEarnings(1);

}
);

window.loadEarnings =
loadEarnings;
