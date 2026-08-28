function showWorkMessage(message) {
  if (window.SWN && typeof SWN.flash === "function") {
    SWN.flash(message);
  } else {
    alert(message);
  }
}

function escapeWorkHtml(value = "") {
  if (typeof window.escapeHtml === "function") {
    return window.escapeHtml(value);
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getJobIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id");
}

async function postWork(event) {
  if (event) {
    event.preventDefault();
  }

  const user = protect("customer");

  if (!user) return;

  const form = document.querySelector("#workForm");

  if (!form) {
    showWorkMessage("Work form not found.");
    return;
  }

  const formData = new FormData(form);

  const jobData = {
    title: String(formData.get("title") || "").trim(),
    description: String(
      formData.get("description") || ""
    ).trim(),
    category: String(
      formData.get("category") || ""
    ).trim(),
    service: String(
      formData.get("service") || ""
    ).trim(),
    location: String(
      formData.get("location") || ""
    ).trim(),
    budget: String(formData.get("budget") || "").trim()
  };

  if (!jobData.title || !jobData.description) {
    showWorkMessage(
      "Please enter both work title and description."
    );
    return;
  }

  if (
    jobData.budget !== "" &&
    (!Number.isFinite(Number(jobData.budget)) ||
      Number(jobData.budget) < 0)
  ) {
    showWorkMessage("Please enter a valid budget.");
    return;
  }

  const submitButton = form.querySelector(
    'button[type="submit"], input[type="submit"]'
  );

  const originalButtonText = submitButton
    ? submitButton.textContent
    : "";

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Posting...";
    }

    const response = await apiFetch("/jobs", {
      method: "POST",
      body: JSON.stringify({
        ...jobData,
        budget:
          jobData.budget === ""
            ? ""
            : Number(jobData.budget)
      })
    });

    let result = {};

    try {
      result = await response.json();
    } catch {
      result = {};
    }

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Unable to post work."
      );
    }

    showWorkMessage(
      result.message || "Work posted successfully."
    );

    window.location.href =
      "customer-dashboard.html";
  } catch (error) {
    console.error("POST WORK ERROR:", error);

    showWorkMessage(
      error.message || "Unable to post work."
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent =
        originalButtonText || "Post Work";
    }
  }
}

async function jobs(id = "jobsList") {
  const element = document.getElementById(id);

  if (!element) return;

  element.innerHTML = `
    <div class="notice">
      Loading work requests...
    </div>
  `;

  try {
    const response = await fetch(
      SWN.api("/jobs?status=open")
    );

    let result = {};

    try {
      result = await response.json();
    } catch {
      result = {};
    }

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
          "Unable to load work requests."
      );
    }

    const jobList = Array.isArray(result.data)
      ? result.data
      : [];

    element.innerHTML = jobList.length
      ? jobList
          .map((job) => {
            const title = escapeWorkHtml(job.title);
            const service = escapeWorkHtml(
              job.service || job.category || "General"
            );
            const location = escapeWorkHtml(
              job.location || "Location not specified"
            );

            return `
              <div class="item">
                <div class="row between">
                  <div>
                    <b>${title}</b>

                    <p class="muted">
                      ${service} • ${location}
                    </p>
                  </div>

                  <a
                    class="btn btn-primary"
                    href="work-request.html?id=${encodeURIComponent(
                      job._id
                    )}"
                  >
                    Open
                  </a>
                </div>
              </div>
            `;
          })
          .join("")
      : `
          <div class="notice">
            No work requests available yet.
          </div>
        `;
  } catch (error) {
    console.error("LOAD JOBS ERROR:", error);

    element.innerHTML = `
      <div class="notice">
        Unable to load work requests.
      </div>
    `;
  }
}

async function request() {
  const element =
    document.querySelector("#requestDetail");

  const id = getJobIdFromUrl();

  if (!element || !id) return;

  element.innerHTML = `
    <div class="notice">
      Loading work details...
    </div>
  `;

  try {
    const response = await fetch(
      SWN.api(`/jobs/${encodeURIComponent(id)}`)
    );

    let result = {};

    try {
      result = await response.json();
    } catch {
      result = {};
    }

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Job not found."
      );
    }

    const job = result.data;

    if (!job) {
      throw new Error("Job not found.");
    }

    const title = escapeWorkHtml(job.title);
    const description = escapeWorkHtml(
      job.description || ""
    );
    const service = escapeWorkHtml(
      job.service || job.category || "General"
    );
    const location = escapeWorkHtml(
      job.location || "Location not specified"
    );

    const budget =
      job.budget === null ||
      job.budget === undefined ||
      job.budget === ""
        ? "Negotiable"
        : `₹${Number(job.budget).toLocaleString(
            "en-IN"
          )}`;

    element.innerHTML = `
      <h2>${title}</h2>

      <p class="lead">
        ${description}
      </p>

      <span class="tag">
        ${service}
      </span>

      <span class="tag">
        ${location}
      </span>

      <p>
        Budget: ${budget}
      </p>

      <a
        class="btn btn-primary"
        href="workers.html?service=${encodeURIComponent(
          job.service || job.category || ""
        )}&jobId=${encodeURIComponent(job._id)}"
      >
        Find Matched Workers
      </a>
    `;
  } catch (error) {
    console.error("LOAD JOB DETAIL ERROR:", error);

    element.innerHTML = `
      <div class="notice">
        ${escapeWorkHtml(
          error.message ||
            "Unable to load work details."
        )}
      </div>
    `;
  }
}

document.addEventListener(
  "DOMContentLoaded",
  () => {
    jobs();
    request();
  }
);

window.postWork = postWork;
window.jobs = jobs;
window.request = request;
