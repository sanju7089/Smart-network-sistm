(function () {
  "use strict";

  let initialized = false;

  function showMessage(
    message,
    isError = true
  ) {
    let box =
      document.getElementById(
        "googleLoginMessage"
      );

    if (!box) {
      box =
        document.createElement(
          "div"
        );

      box.id =
        "googleLoginMessage";

      box.style.marginTop =
        "12px";

      box.style.padding =
        "10px";

      box.style.borderRadius =
        "8px";

      const container =
        document.getElementById(
          "googleLoginButton"
        );

      if (container) {
        container.appendChild(
          box
        );
      }
    }

    box.textContent =
      message;

    box.style.display =
      "block";

    box.style.background =
      isError
        ? "#ffe5e5"
        : "#e7f8ec";

    box.style.color =
      isError
        ? "#b00020"
        : "#146c2e";
  }

  function redirectAfterLogin(
    user
  ) {
    if (
      typeof window.dashboardUrl ===
      "function"
    ) {
      window.location.href =
        window.dashboardUrl(
          user
        );

      return;
    }

    if (
      user?.role ===
      "worker"
    ) {
      window.location.href =
        "worker-dashboard.html";
      return;
    }

    if (
      user?.role ===
      "admin"
    ) {
      window.location.href =
        "admin-dashboard.html";
      return;
    }

    window.location.href =
      "customer-dashboard.html";
  }

  async function handleGoogleCredential(
    response
  ) {
    try {
      if (
        !response ||
        !response.credential
      ) {
        showMessage(
          "Google Login credential नहीं मिला।"
        );
        return;
      }

      showMessage(
        "Google account verify हो रहा है...",
        false
      );

      if (
        typeof window.apiFetch !==
        "function"
      ) {
        throw new Error(
          "API system is not ready."
        );
      }

      const result =
        await window.apiFetch(
          "/auth/google",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              credential:
                response.credential
            })
          }
        );

      if (
        !result?.success ||
        !result?.user
      ) {
        throw new Error(
          result?.message ||
            "Google Login failed."
        );
      }

      localStorage.setItem(
        "swn_user",
        JSON.stringify(
          result.user
        )
      );

      showMessage(
        "Login successful. Redirecting...",
        false
      );

      redirectAfterLogin(
        result.user
      );
    } catch (error) {
      console.error(
        "GOOGLE LOGIN FRONTEND ERROR:",
        error
      );

      showMessage(
        error?.message ||
          "Google Login failed. Please try again."
      );
    }
  }

  async function waitForGoogle() {
    for (
      let i = 0;
      i < 100;
      i++
    ) {
      if (
        window.google &&
        window.google.accounts &&
        window.google.accounts.id
      ) {
        return true;
      }

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            100
          )
      );
    }

    return false;
  }

  async function initGoogleLogin() {
    if (initialized) {
      return;
    }

    const container =
      document.getElementById(
        "googleLoginButton"
      );

    if (!container) {
      return;
    }

    if (
      typeof window.apiFetch !==
      "function"
    ) {
      console.error(
        "apiFetch is not available."
      );
      return;
    }

    const googleReady =
      await waitForGoogle();

    if (!googleReady) {
      showMessage(
        "Google Login service load नहीं हो पाई। Page refresh करके फिर कोशिश करें."
      );
      return;
    }

    try {
      const config =
        await window.apiFetch(
          "/auth/google-config"
        );

      const clientId =
        String(
          config?.clientId || ""
        ).trim();

      if (
        !config?.success ||
        !clientId
      ) {
        throw new Error(
          config?.message ||
            "Google Client ID नहीं मिला."
        );
      }

      window.google.accounts.id.initialize(
        {
          client_id:
            clientId,
          callback:
            handleGoogleCredential,
          auto_select: false,
          cancel_on_tap_outside:
            true
        }
      );

      container.innerHTML =
        "";

      window.google.accounts.id.renderButton(
        container,
        {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: 360,
          logo_alignment:
            "left"
        }
      );

      initialized =
        true;
    } catch (error) {
      console.error(
        "GOOGLE LOGIN INIT ERROR:",
        error
      );

      showMessage(
        error?.message ||
          "Google Login setup में समस्या है."
      );
    }
  }

  window.initGoogleLogin =
    initGoogleLogin;

  document.addEventListener(
    "DOMContentLoaded",
    function () {
      setTimeout(
        initGoogleLogin,
        300
      );
    }
  );
})();
