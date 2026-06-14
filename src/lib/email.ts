import "server-only";
import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;

/** Email only sends when SMTP is configured; otherwise callers use a dev fallback. */
export const isEmailConfigured = () => Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter: nodemailer.Transporter | null = null;
function getTransport() {
  if (!transporter) {
    const port = Number(SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465, // implicit TLS on 465, STARTTLS otherwise
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const info = await getTransport().sendMail({
    from: EMAIL_FROM || `Spinder <${SMTP_USER}>`,
    to,
    subject: "Reset your Spinder password",
    text: `Reset your password using this link (valid for 30 minutes):\n\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#111114">Reset your password</h2>
        <p style="color:#444">Click the button below to choose a new password. This link is valid for 30 minutes.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#6f86b3;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Reset password</a></p>
        <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
      </div>`,
  });
  // For Ethereal/dev SMTP this prints a viewable preview link.
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) console.log("[email] password reset preview:", preview);
}
