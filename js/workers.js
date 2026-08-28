function escapeWorkerHtml(value = "") {
if (typeof window.escapeHtml === "function") {
return window.escapeHtml(value);
}

return String(value)
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, """)
.replace(/'/g, "'");
}

function getWorkerQuery() {
return new URLSearchParams(window.location.search);
}

function getWorkerServiceFilter() {
const params = getWorkerQuery();

return String(
params.get("service") || ""
).trim();
}

function getJobId() {
const params = getWorkerQuery();

return String(
params.get("jobId") || ""
).trim();
}

function getWorkerId() {
const params = getWorkerQuery();

return String(
params.get("id") || ""
).trim();
}

function workerProfileUrl(workerId) {
const jobId = getJobId();

const params = new URLSearchParams({
id: workerId
});

if (jobId) {
params.set("jobId", jobId);
}

return "worker-profile.html?${params.toString()}";
}

function checkoutUrl(workerId) {
const jobId = getJobId();

const params = new URLSearchParams({
workerId: workerId
});

if (jobId) {
params.set("jobId", jobId);
}

return "checkout.html?${params.toString()}";
}

function renderWorkerCard(worker) {
const id = worker._id || worker.id;

if (!id) {
return "";
}

const name = escapeWorkerHtml(
worker.name || "Worker"
);

const service = escapeWorkerHtml(
worker.service || "General Service"
);

const location = escapeWorkerHtml(
worker.location ||
"Location not specified"
);

const experience = escapeWorkerHtml(
worker.experience ||
"Experience not specified"
);

const verifiedBadge = worker.verified
? "<span class="tag">Verified</span>"
: "<span class="tag">Profile Pending Verification</span>";

return `
<div class="card">

  ${verifiedBadge}

  <h3>${name}</h3>

  <p class="muted">
    ${service} • ${location}
  </p>

  <p>
    Experience: ${experience}
  </p>

  <a
    class="btn btn-primary"
    href="${workerProfileUrl(id)}"
  >
    View Profile
  </a>

</div>

`;
}

async function loadWorkers() {
const list =
document.querySelector("#workersList");

if (!list) return;

list.innerHTML = "<div class="notice"> Loading workers... </div>";

try {
const service =
getWorkerServiceFilter();

const params =
  new URLSearchParams();

if (service) {
  params.set("service", service);
}

const query =
  params.toString();

const response =
  await fetch(
    SWN.api(
      `/workers${
        query
          ? `?${query}`
          : ""
      }`
    )
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
    "Unable to load workers."
  );
}

const workers =
  Array.isArray(result.data)
    ? result.data
    : [];

if (!workers.length) {
  list.innerHTML = `
    <div class="notice">
      No active workers found for this service.
    </div>
  `;

  return;
}

const cards =
  workers
    .map(renderWorkerCard)
    .filter(Boolean)
    .join("");

list.innerHTML =
  cards ||
  `
    <div class="notice">
      No valid worker profiles found.
    </div>
  `;

} catch (error) {
console.error(
"LOAD WORKERS ERROR:",
error
);

list.innerHTML = `
  <div class="notice">
    ${escapeWorkerHtml(
      error.message ||
      "Unable to load workers."
    )}
  </div>
`;

}
}

async function loadWorkerDetail() {
const detail =
document.querySelector("#workerDetail");

if (!detail) return;

const workerId =
getWorkerId();

if (!workerId) {
detail.innerHTML = "<div class="notice"> Worker ID is missing. </div>";

return;

}

detail.innerHTML = "<div class="notice"> Loading worker profile... </div>";

try {
const response =
await fetch(
SWN.api(
"/workers/${encodeURIComponent( workerId )}"
)
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
    "Worker not found."
  );
}

const worker =
  result.data;

if (!worker) {
  throw new Error(
    "Worker not found."
  );
}

const id =
  worker._id || worker.id;

if (!id) {
  throw new Error(
    "Worker profile is invalid."
  );
}

const name =
  escapeWorkerHtml(
    worker.name || "Worker"
  );

const service =
  escapeWorkerHtml(
    worker.service ||
    "General Service"
  );

const location =
  escapeWorkerHtml(
    worker.location ||
    "Location not specified"
  );

const experience =
  escapeWorkerHtml(
    worker.experience ||
    "Not specified"
  );

const bio =
  escapeWorkerHtml(
    worker.bio ||
    "No additional information provided."
  );

const phone =
  escapeWorkerHtml(
    worker.phone ||
    "Available after booking"
  );

const verifiedBadge =
  worker.verified
    ? `
      <span class="tag">
        Verified Worker
      </span>
    `
    : `
      <span class="tag">
        Verification Pending
      </span>
    `;

detail.innerHTML = `
  <div class="card">

    ${verifiedBadge}

    <h1>${name}</h1>

    <p class="lead">
      ${service}
    </p>

    <p>
      <b>Location:</b>
      ${location}
    </p>

    <p>
      <b>Experience:</b>
      ${experience}
    </p>

    <p>
      <b>About:</b>
      ${bio}
    </p>

    <p>
      <b>Contact:</b>
      ${phone}
    </p>

    <a
      class="btn btn-primary"
      href="${checkoutUrl(id)}"
    >
      Book This Worker
    </a>

  </div>
`;

} catch (error) {
console.error(
"LOAD WORKER DETAIL ERROR:",
error
);

detail.innerHTML = `
  <div class="notice">
    ${escapeWorkerHtml(
      error.message ||
      "Unable to load worker profile."
    )}
  </div>
`;

}
}

document.addEventListener(
"DOMContentLoaded",
function() {
loadWorkers();
loadWorkerDetail();
}
);

window.loadWorkers = loadWorkers;
window.loadWorkerDetail = loadWorkerDetail;
