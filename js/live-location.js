(function () {
  "use strict";

  const STORAGE_KEY =
    "swn_live_location";

  const DEFAULT_RADIUS_KM = 30;

  function saveLocation(position) {
    if (!position?.coords) {
      return null;
    }

    const latitude =
      Number(position.coords.latitude);

    const longitude =
      Number(position.coords.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return null;
    }

    const location = {
      latitude,
      longitude,
      accuracy:
        Number.isFinite(
          Number(position.coords.accuracy)
        )
          ? Number(
              position.coords.accuracy
            )
          : null,
      savedAt:
        new Date().toISOString()
    };

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(location)
      );
    } catch (error) {
      console.warn(
        "Unable to store live location:",
        error
      );
    }

    return location;
  }

  function getSavedLocation() {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {
        return null;
      }

      const location =
        JSON.parse(raw);

      if (
        !Number.isFinite(
          Number(location.latitude)
        ) ||
        !Number.isFinite(
          Number(location.longitude)
        )
      ) {
        return null;
      }

      return {
        latitude:
          Number(location.latitude),
        longitude:
          Number(location.longitude),
        accuracy:
          Number.isFinite(
            Number(location.accuracy)
          )
            ? Number(location.accuracy)
            : null,
        savedAt:
          location.savedAt || null
      };
    } catch (error) {
      console.warn(
        "Unable to read live location:",
        error
      );

      return null;
    }
  }

  function getCurrentLocation() {
    return new Promise(
      (resolve, reject) => {
        if (
          !navigator.geolocation
        ) {
          reject(
            new Error(
              "इस device/browser में GPS location उपलब्ध नहीं है।"
            )
          );
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location =
              saveLocation(position);

            if (!location) {
              reject(
                new Error(
                  "GPS location सही नहीं मिली।"
                )
              );
              return;
            }

            resolve(location);
          },
          (error) => {
            let message =
              "Location प्राप्त नहीं हो सकी।";

            if (
              error?.code ===
              error.PERMISSION_DENIED
            ) {
              message =
                "Location permission allow करें।";
            } else if (
              error?.code ===
              error.POSITION_UNAVAILABLE
            ) {
              message =
                "GPS location अभी उपलब्ध नहीं है।";
            } else if (
              error?.code ===
              error.TIMEOUT
            ) {
              message =
                "GPS location प्राप्त करने में समय लग गया।";
            }

            reject(
              new Error(message)
            );
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000
          }
        );
      }
    );
  }

  async function saveJobLocation(
    jobId,
    location
  ) {
    if (
      !jobId ||
      !location ||
      !window.SWN ||
      typeof window.SWN.request !==
        "function"
    ) {
      return null;
    }

    return window.SWN.request(
      `/live-location/job/${encodeURIComponent(
        jobId
      )}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          latitude:
            location.latitude,
          longitude:
            location.longitude
        })
      }
    );
  }

  async function saveWorkerLocation(
    location
  ) {
    if (
      !location ||
      !window.SWN ||
      typeof window.SWN.request !==
        "function"
    ) {
      return null;
    }

    return window.SWN.request(
      "/live-location/worker/me",
      {
        method: "PATCH",
        body: JSON.stringify({
          latitude:
            location.latitude,
          longitude:
            location.longitude
        })
      }
    );
  }

  async function findNearbyJobs(
    radiusKm = DEFAULT_RADIUS_KM
  ) {
    const location =
      getSavedLocation();

    if (!location) {
      throw new Error(
        "पहले अपनी live location allow करें।"
      );
    }

    const radius = Math.max(
      DEFAULT_RADIUS_KM,
      Number(radiusKm) ||
        DEFAULT_RADIUS_KM
    );

    return window.SWN.request(
      `/live-location/jobs/nearby?latitude=${encodeURIComponent(
        location.latitude
      )}&longitude=${encodeURIComponent(
        location.longitude
      )}&radiusKm=${encodeURIComponent(
        radius
      )}`
    );
  }

  async function findNearbyWorkers(
    radiusKm = DEFAULT_RADIUS_KM
  ) {
    const location =
      getSavedLocation();

    if (!location) {
      throw new Error(
        "पहले अपनी live location allow करें।"
      );
    }

    const radius = Math.max(
      DEFAULT_RADIUS_KM,
      Number(radiusKm) ||
        DEFAULT_RADIUS_KM
    );

    return window.SWN.request(
      `/live-location/workers/nearby?latitude=${encodeURIComponent(
        location.latitude
      )}&longitude=${encodeURIComponent(
        location.longitude
      )}&radiusKm=${encodeURIComponent(
        radius
      )}`
    );
  }

  function createLocationButton(
    input
  ) {
    if (
      !input ||
      input.dataset.swnGpsReady
    ) {
      return;
    }

    input.dataset.swnGpsReady =
      "true";

    const wrapper =
      document.createElement("div");

    wrapper.style.display = "flex";
    wrapper.style.flexDirection =
      "column";
    wrapper.style.gap = "8px";

    input.parentNode.insertBefore(
      wrapper,
      input
    );

    wrapper.appendChild(input);

    const button =
      document.createElement("button");

    button.type = "button";

    button.textContent =
      "📍 मेरी वर्तमान लोकेशन इस्तेमाल करें";

    button.style.cursor =
      "pointer";

    button.style.padding =
      "10px 14px";

    button.style.borderRadius =
      "8px";

    button.style.border =
      "1px solid #ccc";

    button.style.background =
      "#fff";

    const status =
      document.createElement("small");

    status.style.display =
      "block";

    button.addEventListener(
      "click",
      async () => {
        button.disabled = true;

        status.textContent =
          "📍 Location प्राप्त की जा रही है...";

        try {
          const location =
            await getCurrentLocation();

          status.textContent =
            `✓ Live location saved (${location.latitude.toFixed(
              5
            )}, ${location.longitude.toFixed(
              5
            )})`;

        } catch (error) {
          status.textContent =
            error?.message ||
            "Location प्राप्त नहीं हुई।";
        } finally {
          button.disabled = false;
        }
      }
    );

    wrapper.appendChild(button);
    wrapper.appendChild(status);
  }

  function setupLocationButtons() {
    const selectors = [
      'input[name="location"]',
      'textarea[name="location"]',
      "#location"
    ];

    selectors.forEach(
      (selector) => {
        document
          .querySelectorAll(selector)
          .forEach(
            createLocationButton
          );
      }
    );
  }

  /*
   * Existing SWN.request को wrap करके
   * Job और Worker दोनों की GPS location
   * automatically save करते हैं।
   *
   * Existing files/flows को remove नहीं करते।
   */
  function setupAutoLocation() {
    if (
      !window.SWN ||
      typeof window.SWN.request !==
        "function"
    ) {
      return;
    }

    if (
      window.SWN.__liveLocationWrapped
    ) {
      return;
    }

    const originalRequest =
      window.SWN.request.bind(
        window.SWN
      );

    window.SWN.request =
      async function (
        endpoint,
        options = {}
      ) {
        const result =
          await originalRequest(
            endpoint,
            options
          );

        try {
          const method =
            String(
              options?.method ||
                "GET"
            ).toUpperCase();

          /*
           * CUSTOMER → CREATE JOB
           * GPS → JOB LIVE LOCATION
           */
          if (
            method === "POST" &&
            endpoint === "/jobs" &&
            result?.success === true
          ) {
            const jobId =
              result?.data?._id ||
              result?.data?.id;

            const location =
              getSavedLocation();

            if (
              jobId &&
              location
            ) {
              try {
                await saveJobLocation(
                  jobId,
                  location
                );
              } catch (error) {
                console.warn(
                  "AUTO JOB LOCATION ERROR:",
                  error
                );
              }
            }
          }

          /*
           * WORKER → PROFILE UPDATE
           * GPS → WORKER LIVE LOCATION
           *
           * worker-profile.html existing
           * PATCH /workers/:id flow को
           * touch किए बिना GPS sync होता है।
           */
          if (
            method === "PATCH" &&
            typeof endpoint ===
              "string" &&
            endpoint.startsWith(
              "/workers/"
            ) &&
            !endpoint.startsWith(
              "/workers/me/"
            )
          ) {
            const location =
              getSavedLocation();

            if (location) {
              try {
                await saveWorkerLocation(
                  location
                );
              } catch (error) {
                console.warn(
                  "AUTO WORKER LOCATION ERROR:",
                  error
                );
              }
            }
          }
        } catch (error) {
          /*
           * Location fail होने पर
           * existing Job/Worker operation
           * कभी fail नहीं होगी।
           */
          console.warn(
            "AUTO LIVE LOCATION ERROR:",
            error
          );
        }

        return result;
      };

    window.SWN.__liveLocationWrapped =
      true;
  }

  function exposeAPI() {
    window.SWNLiveLocation = {
      DEFAULT_RADIUS_KM,

      getCurrentLocation,

      getSavedLocation,

      saveJobLocation,

      saveWorkerLocation,

      findNearbyJobs,

      findNearbyWorkers
    };
  }

  function init() {
    exposeAPI();

    setupLocationButtons();

    setupAutoLocation();
  }

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
