function initializeDashboard() {
  const element = document.querySelector(
    "#dashboardContent"
  );

  if (!element) {
    return;
  }

  const user =
    typeof window.protect === "function"
      ? window.protect()
      : null;

  if (!user) {
    return;
  }

  if (user.role === "customer") {
    loadCustomerDashboard(
      element,
      user
    ).catch((error) => {
      console.error(
        "CUSTOMER DASHBOARD ERROR:",
        error
      );

      showDashboardError(
        element,
        error.message ||
          "Unable to load customer dashboard."
      );
    });

    return;
  }

  if (user.role === "worker") {
    loadWorkerDashboard(
      element
    ).catch((error) => {
      console.error(
        "WORKER DASHBOARD ERROR:",
        error
      );

      showDashboardError(
        element,
        error.message ||
          "Unable to load worker dashboard."
      );
    });

    return;
  }

  if (user.role === "admin") {
    window.location.href = "admin.html";
    return;
  }

  showDashboardError(
    element,
    "Your account role is not supported."
  );
}

document.addEventListener(
  "DOMContentLoaded",
  initializeDashboard
);

window.initializeDashboard =
  initializeDashboard;
