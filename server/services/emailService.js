const RESEND_API_URL = "https://api.resend.com/emails";

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

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
  expiresMinutes
}) {
  const { apiKey, from } =
    getEmailConfiguration();

  if (!apiKey || !from) {
    const error = new Error(
      "Password reset email service is not configured."
    );

    error.statusCode = 503;

    throw error;
  }

  const safeName =
    String(name || "User").trim() || "User";

  const safeExpires =
    Number(expiresMinutes) > 0
      ? Number(expiresMinutes)
      : 15;

  const response = await fetch(
    RESEND_API_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject:
          "Reset your Smart Work Network password",
        html: `
          <!doctype html>
          <html>
            <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;">
              <div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:12px;padding:32px;">
                <h2 style="margin-top:0;">
                  Smart Work Network
                </h2>

                <p>Hello ${escapeHtml(safeName)},</p>

                <p>
                  We received a request to reset your
                  Smart Work Network account password.
                </p>

                <p>
                  Click the button below to create a
                  new password:
                </p>

                <p style="margin:28px 0;">
                  <a
                    href="${escapeHtml(resetUrl)}"
                    style="display:inline-block;padding:13px 22px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;"
                  >
                    Reset Password
                  </a>
                </p>

                <p>
                  This link will expire in
                  <strong>${safeExpires} minutes</strong>.
                </p>

                <p>
                  If you did not request a password reset,
                  you can safely ignore this email.
                </p>

                <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">

                <p style="font-size:12px;color:#6b7280;">
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
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(
      data?.message ||
      "Unable to send password reset email."
    );

    error.statusCode = 502;

    throw error;
  }

  return {
    success: true,
    id: data?.id || null
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
