function escapeEarningsHtml(
  value = ""
) {
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

function formatMoney(
  value,
  currency = "INR"
) {
  return Number(
    value || 0
  ).toLocaleString(
    "en-IN",
    {
      style: "currency",
      currency
    }
  );
}

function formatDate(
  value
) {
  if (!value) {
    return "Unknown";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown";
  }

  return date.toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  );
}

function showEarningsMessage(
  message,
  error = false
) {
  const element =
    document.querySelector(
      "#earningsMessage"
    );

  if (!element) return;

  element.innerHTML = `
    <div class="notice">
      ${escapeEarningsHtml(message)}
    </div>
  `;

  if (error) {
    console.error(message);
  }
}

function renderEarningsStats(
  data
) {
  const element =
    document.querySelector(
      "#earningsStats"
    );

  if (!element) return;

  const currency =
    data.currency || "INR";

  element.innerHTML = `

    <div class="card">

      <div class="stat">
        ${escapeEarningsHtml(
          formatMoney(
            data.grossAmount,
            currency
          )
        )}
      </div>

      <p>
        Total Paid Earnings
      </p>

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

      <p>
        Completed Work Earnings
      </p>

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

      <p>
        Paid but Work Not Completed
      </p>

    </div>

    <div class="card">

      <div class="stat">
        ${escapeEarningsHtml(
          String(
            data.totalPaidBookings || 0
          )
        )}
      </div>

      <p>
        Paid Bookings
      </p>

    </div>

  `;
}

function renderPayments(
  payments
) {
  const element =
    document.querySelector(
      "#earningsPayments"
    );

  if (!element) return;

  if (!payments.length) {

    element.innerHTML = `
      <div class="notice">
        No paid bookings yet.
      </div>
    `;

    return;
  }

  element.innerHTML =
    payments
      .map(
        (payment) => `
          <div class="card">

            <div class="row between">

              <b>
                ${escapeEarningsHtml(
                  formatMoney(
                    payment.amount,
                    payment.currency ||
                      "INR"
                  )
                )}
              </b>

              <span class="tag">
                ${escapeEarningsHtml(
                  payment.status
                )}
              </span>

            </div>

            <p>
              Booking:
              ${escapeEarningsHtml(
                String(
                  payment.booking?.id ||
                  ""
                )
              )}
            </p>

            <p>
              Work status:
              ${escapeEarningsHtml(
                payment.booking?.status ||
                "Unknown"
              )}
            </p>

            <p class="muted">
              Paid:
              ${escapeEarningsHtml(
                formatDate(
                  payment.paidAt
                )
              )}
            </p>

          </div>
        `
      )
      .join("");
}

async function loadEarnings() {

  const user =
    typeof window.protect ===
    "function"
      ? protect("worker")
      : null;

  if (!user) {
    return;
  }

  try {

    const response =
      await apiFetch(
        "/earnings/me"
      );

    let result = {};

    try {
      result =
        await response.json();
    } catch {
      result = {};
    }

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
        "Unable to load earnings."
      );
    }

    const data =
      result.data || {};

    const subtitle =
      document.querySelector(
        "#earningsSubtitle"
      );

    if (subtitle) {
      subtitle.textContent =
        `${data.totalPaidBookings || 0} paid booking(s)`;
    }

    renderEarningsStats(
      data
    );

    renderPayments(
      Array.isArray(
        data.payments
      )
        ? data.payments
        : []
    );

  } catch (error) {

    showEarningsMessage(
      error.message ||
      "Unable to load earnings.",
      true
    );

    const payments =
      document.querySelector(
        "#earningsPayments"
      );

    if (payments) {
      payments.innerHTML = "";
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
        loadEarnings
      );
    }

    loadEarnings();

  }
);

window.loadEarnings =
  loadEarnings;
