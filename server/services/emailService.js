const RESEND_API_URL =
  "https://api.resend.com/emails";

function getEmailConfiguration() {
  const apiKey = String(
    process.env.RESEND_API_KEY || ""
  ).trim();

  const from = String(
    process.env.EMAIL_FROM || ""
  ).trim();

  return {
    apiKey,
    from
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendOtpEmail({
  to,
  name,
  otp,
  purpose,
  expiresMinutes
}) {
  const {
    apiKey,
    from
  } = getEmailConfiguration();

  if (
    !apiKey ||
    !from
  ) {
    const error =
      new Error(
        "OTP email service is not configured."
      );

    error.statusCode = 503;

    throw error;
  }

  const safeName =
    String(
      name || "User"
    ).trim() ||
    "User";

  const safeOtp =
    String(
      otp || ""
    ).trim();

  const safeExpires =
    Number(
      expiresMinutes
    ) > 0
      ? Number(
          expiresMinutes
        )
      : 10;

  const isSignup =
    purpose === "signup";

  const isLogin =
    purpose === "login";

  const isReset =
    purpose === "reset";

  let subject =
    "Your Smart Work Network OTP";

  let heading =
    "Verification OTP";

  let description =
    "Use the OTP below to continue.";

  if (isSignup) {
    subject =
      "Verify your Smart Work Network account";

    heading =
      "Verify your email address";

    description =
      "Use the OTP below to verify your email and activate your Smart Work Network account.";
  } else if (isLogin) {
    subject =
      "Your Smart Work Network login OTP";

    heading =
      "Login verification OTP";

    description =
      "Use the OTP below to complete your Smart Work Network login.";
  } else if (isReset) {
    subject =
      "Your Smart Work Network password reset OTP";

    heading =
      "Password reset OTP";

    description =
      "Use the OTP below to verify your identity and reset your Smart Work Network password.";
  }

  const response =
    await fetch(
      RESEND_API_URL,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            from,

            /*
             * IMPORTANT:
             * 'to' is the registered
             * user's email.
             */
            to: [to],

            subject,

            html: `
              <!doctype html>

              <html>
                <body
                  style="
                    margin:0;
                    padding:0;
                    background:#f5f7fb;
                    font-family:Arial,sans-serif;
                  "
                >

                  <div
                    style="
                      max-width:600px;
                      margin:30px auto;
                      background:#ffffff;
                      border-radius:12px;
                      padding:32px;
                    "
                  >

                    <h2>
                      Smart Work Network
                    </h2>

                    <p>
                      Hello
                      ${escapeHtml(
                        safeName
                      )},
                    </p>

                    <h3>
                      ${escapeHtml(
                        heading
                      )}
                    </h3>

                    <p>
                      ${escapeHtml(
                        description
                      )}
                    </p>

                    <div
                      style="
                        margin:30px 0;
                        padding:20px;
                        background:#f3f4f6;
                        border-radius:10px;
                        text-align:center;
                      "
                    >

                      <div
                        style="
                          font-size:34px;
                          font-weight:bold;
                          letter-spacing:8px;
                        "
                      >
                        ${escapeHtml(
                          safeOtp
                        )}
                      </div>

                    </div>

                    <p>
                      This OTP will expire in
                      <strong>
                        ${safeExpires} minutes
                      </strong>.
                    </p>

                    <p>
                      Never share this OTP with anyone.
                    </p>

                    <hr
                      style="
                        border:none;
                        border-top:1px solid #e5e7eb;
                        margin:25px 0;
                      "
                    >

                    <p
                      style="
                        font-size:12px;
                        color:#6b7280;
                      "
                    >
                      Smart Work Network security notification.
                    </p>

                  </div>

                </body>
              </html>
            `
          })
      }
    );

  let data = null;

  try {
    data =
      await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error =
      new Error(
        data?.message ||
          "Unable to send OTP email."
      );

    error.statusCode = 502;

    throw error;
  }

  return {
    success: true,
    id:
      data?.id || null
  };
}

/*
 * Compatibility function.
 */
export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
  expiresMinutes
}) {
  const {
    apiKey,
    from
  } = getEmailConfiguration();

  if (
    !apiKey ||
    !from
  ) {
    const error =
      new Error(
        "Password reset email service is not configured."
      );

    error.statusCode = 503;

    throw error;
  }

  const safeName =
    String(
      name || "User"
    ).trim() ||
    "User";

  const safeExpires =
    Number(
      expiresMinutes
    ) > 0
      ? Number(
          expiresMinutes
        )
      : 15;

  const response =
    await fetch(
      RESEND_API_URL,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            from,

            to: [to],

            subject:
              "Reset your Smart Work Network password",

            html: `
              <!doctype html>

              <html>
                <body
                  style="
                    margin:0;
                    padding:0;
                    background:#f5f7fb;
                    font-family:Arial,sans-serif;
                  "
                >

                  <div
                    style="
                      max-width:600px;
                      margin:30px auto;
                      background:#ffffff;
                      border-radius:12px;
                      padding:32px;
                    "
                  >

                    <h2>
                      Smart Work Network
                    </h2>

                    <p>
                      Hello
                      ${escapeHtml(
                        safeName
                      )},
                    </p>

                    <p>
                      A password reset was requested for your account.
                    </p>

                    <p
                      style="
                        margin:28px 0;
                      "
                    >

                      <a
                        href="${escapeHtml(
                          resetUrl
                        )}"
                        style="
                          display:inline-block;
                          padding:13px 22px;
                          background:#111827;
                          color:#ffffff;
                          text-decoration:none;
                          border-radius:8px;
                        "
                      >
                        Reset Password
                      </a>

                    </p>

                    <p>
                      This link will expire in
                      <strong>
                        ${safeExpires} minutes
                      </strong>.
                    </p>

                  </div>

                </body>
              </html>
            `
          })
      }
    );

  let data = null;

  try {
    data =
      await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error =
      new Error(
        data?.message ||
          "Unable to send password reset email."
      );

    error.statusCode = 502;

    throw error;
  }

  return {
    success: true,
    id:
      data?.id || null
  };
}
