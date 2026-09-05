"use strict";

function getData(result) {
if (!result || typeof result !== "object") {
return {};
}

if (result.data && typeof result.data === "object") {
return result.data;
}

return result;
}

function escapeDashboardHtml(value = "") {
if (typeof window.escapeHtml === "function") {
return window.escapeHtml(value);
}

const div = document.createElement("div");
div.textContent = String(value);
return div.innerHTML;
}

async function fetchApiData(path) {
try {
if (typeof window.apiFetch === "function") {
return await window.apiFetch(path);
}

if (
  typeof window.SWN !== "undefined" &&
  typeof window.SWN.request === "function"
) {
  return await window.SWN.request(path);
}

throw new Error("API client is not available");

} catch (error) {
return {
ok: false,
success: false,
message:
error?.message ||
"API request failed: ${path}",
error
};
}
}

function showDashboardError(element, message) {
if (!element) {
return;
}

element.innerHTML = "<div class="dashboard-error" role="alert"> <h3>Something went wrong</h3> <p> ${escapeDashboardHtml( message || "Unable to load dashboard data." )} </p> <button type="button" onclick="window.location.reload()" > Retry </button> </div>";
}

function formatNumber(value) {
const number = Number(value);

if (!Number.isFinite(number)) {
return "0";
}

return new Intl.NumberFormat("en-IN").format(number);
}

function getJobStatus(job) {
const status = String(
job?.status || ""
).toLowerCase();

if (status === "completed") {
return "Completed";
}

if (
status === "in_progress" ||
status === "in-progress"
) {
return "In Progress";
}

if (
status === "cancelled" ||
status === "canceled"
) {
return "Cancelled";
}

if (status === "closed") {
return "Closed";
}

if (status === "accepted") {
return "Accepted";
}

return "Open";
}

function getBookingStatus(booking) {
const status = String(
booking?.status || ""
).toLowerCase();

if (status === "completed") {
return "Completed";
}

if (
status === "in_progress" ||
status === "in-progress"
) {
return "In Progress";
}

if (status === "confirmed") {
return "Confirmed";
}

if (status === "accepted") {
return "Accepted";
}

if (status === "rejected") {
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

function createStatusCard(label, count) {
return `
<div class="dashboard-status-card">
<div class="dashboard-status-card__label">
${escapeDashboardHtml(label)}
</div>

  <div class="dashboard-status-card__count">
    ${formatNumber(count)}
  </div>
</div>

`;
}

async function loadCustomerDashboard(element, user) {
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

element.innerHTML = "<div class="dashboard-loading"> Loading your dashboard... </div>";

const result = await fetchApiData(
"/jobs?customerId=${encodeURIComponent( customerId )}"
);

if (
!result ||
result.ok === false ||
result.success === false
) {
showDashboardError(
element,
result?.message ||
"Unable to load your jobs."
);
return;
}

const data = getData(result);

const jobs = Array.isArray(data)
? data
: Array.isArray(data.jobs)
? data.jobs
: [];

const openJobs = jobs.filter(
(job) =>
String(job?.status || "")
.toLowerCase() === "open"
);

const activeJobs = jobs.filter((job) => {
const status = String(
job?.status || ""
).toLowerCase();

return [
  "open",
  "accepted",
  "in_progress",
  "in-progress",
  "confirmed"
].includes(status);

});

const completedJobs = jobs.filter(
(job) =>
String(job?.status || "")
.toLowerCase() === "completed"
);

element.innerHTML = `
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
    "Active Jobs",
    activeJobs.length
  )}

  ${createStatusCard(
    "Completed",
    completedJobs.length
  )}
</section>

<section class="dashboard-section">
  <div class="dashboard-section__header">
    <h2>My Jobs</h2>

    <a href="post-work.html">
      Post New Job
    </a>
  </div>

  <div class="dashboard-job-list">
    ${
      jobs.length
        ? jobs
            .map(
              (job) => `
                <article class="dashboard-job-card">
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

                  <div class="dashboard-job-meta">
                    <span>
                      Status:
                      ${escapeDashboardHtml(
                        getJobStatus(job)
                      )}
                    </span>

                    ${
                      job?.budget !==
                        undefined &&
                      job?.budget !== null
                        ? `
                          <span>
                            Budget:
                            ₹${escapeDashboardHtml(
                              job.budget
                            )}
                          </span>
                        `
                        : ""
                    }
                  </div>
                </article>
              `
            )
            .join("")
        : `
          <div class="dashboard-empty">
            <p>
              You have not posted any jobs yet.
            </p>

            <a href="post-work.html">
              Post Your First Job
            </a>
          </div>
        `
    }
  </div>
</section>

`;
}

async function loadWorkerDashboard(element) {
if (!element) {
return;
}

element.innerHTML = "<div class="dashboard-loading"> Loading worker dashboard... </div>";

const [
jobsResult,
bookingsResult,
profileResult
] = await Promise.all([
fetchApiData("/jobs?status=open"),
fetchApiData("/bookings"),
fetchApiData("/workers/me/profile")
]);

const jobsData = getData(jobsResult);
const bookingsData =
getData(bookingsResult);
const profileData =
getData(profileResult);

const jobs = Array.isArray(jobsData)
? jobsData
: Array.isArray(jobsData.jobs)
? jobsData.jobs
: [];

const bookings =
Array.isArray(bookingsData)
? bookingsData
: Array.isArray(
bookingsData.bookings
)
? bookingsData.bookings
: [];

const profile =
profileData?.worker ||
profileData?.profile ||
profileData;

const activeBookings =
bookings.filter((booking) => {
const status = String(
booking?.status || ""
).toLowerCase();

  return [
    "pending",
    "accepted",
    "confirmed",
    "in_progress",
    "in-progress"
  ].includes(status);
});

const completedBookings =
bookings.filter(
(booking) =>
String(
booking?.status || ""
).toLowerCase() === "completed"
);

const profileCompleted = Boolean(
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
  <div class="dashboard-section__header">
    <h2>Worker Profile</h2>

    <a href="worker-profile.html?edit=1">
      Edit My Profile
    </a>
  </div>

  <div class="dashboard-profile-status">
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

          <a href="worker-profile.html?edit=1">
            Complete My Profile
          </a>
        `
    }
  </div>
</section>

<section class="dashboard-section">
  <div class="dashboard-section__header">
    <h2>Available Jobs</h2>

    <a href="find-work.html">
      View All Jobs
    </a>
  </div>

  <div class="dashboard-job-list">
    ${
      jobs.length
        ? jobs
            .slice(0, 10)
            .map(
              (job) => `
                <article class="dashboard-job-card">
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

                  <div class="dashboard-job-meta">
                    ${
                      job?.budget !==
                        undefined &&
                      job?.budget !== null
                        ? `
                          <span>
                            Budget:
                            ₹${escapeDashboardHtml(
                              job.budget
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
                    job?.id ||
                    job?._id
                      ? `
                        <a
                          href="work-request.html?id=${encodeURIComponent(
                            job.id ||
                              job._id
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
        : `
          <div class="dashboard-empty">
            <p>
              No open jobs are currently available.
            </p>
          </div>
        `
    }
  </div>
</section>

<section class="dashboard-section">
  <div class="dashboard-section__header">
    <h2>Recent Bookings</h2>

    <a href="bookings.html">
      View Bookings
    </a>
  </div>

  <div class="dashboard-booking-list">
    ${
      bookings.length
        ? bookings
            .slice(0, 10)
            .map(
              (booking) => `
                <article class="dashboard-booking-card">
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
        : `
          <div class="dashboard-empty">
            <p>
              No bookings found.
            </p>
          </div>
        `
    }
  </div>
</section>

`;
}

async function initializeDashboard() {
const element =
document.getElementById(
"dashboardContent"
);

if (!element) {
return;
}

let user = null;

if (
typeof window.SWN !==
"undefined" &&
typeof window.SWN.user ===
"function"
) {
user = window.SWN.user();
}

if (
!user &&
typeof window.getCurrentUser ===
"function"
) {
user = window.getCurrentUser();
}

if (!user) {
try {
const result =
await fetchApiData(
"/auth/me"
);

  if (
    result &&
    result.ok !== false &&
    result.success !== false
  ) {
    const data = getData(result);

    user =
      data?.user ||
      data?.data?.user ||
      data;
  }
} catch (error) {
  user = null;
}

}

if (!user) {
showDashboardError(
element,
"Please log in to access your dashboard."
);
return;
}

const role = String(
user?.role ||
user?.userType ||
user?.accountType ||
""
).toLowerCase();

if (role === "worker") {
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

if (role === "admin") {
window.location.href =
"admin.html";
return;
}

showDashboardError(
element,
"Your account role is not supported by this dashboard."
);
}

document.addEventListener(
"DOMContentLoaded",
() => {
initializeDashboard();
}
);

window.initializeDashboard =
initializeDashboard;

window.loadCustomerDashboard =
loadCustomerDashboard;

window.loadWorkerDashboard =
loadWorkerDashboard;
