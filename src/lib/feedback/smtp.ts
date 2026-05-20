/**
 * SMTP Email Service
 *
 * Sends feedback JSON payload via SMTP to the configured address.
 * Transporter is initialized eagerly at module load with startup validation.
 */

import nodemailer from "nodemailer";

interface FeedbackPayload {
  rating: number | null;
  feedback: string;
  timestamp: string;
  source: string;
}

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const SMTP_TO = process.env.SMTP_TO || SMTP_USER;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: SMTP_USER
    ? {
        user: SMTP_USER,
        pass: SMTP_PASS,
      }
    : undefined,
  tls: {
    rejectUnauthorized: false,
  },
});

if (SMTP_HOST) {
  transporter.verify().then(() => {
    console.log("SMTP transporter ready");
  }).catch((err: Error) => {
    console.warn("SMTP transporter verification failed:", err.message);
  });
} else {
  console.warn("SMTP_HOST not set — email sending will fail");
}

/**
 * Sends the feedback payload as a JSON email via SMTP.
 */
export async function sendFeedbackEmail(payload: FeedbackPayload): Promise<boolean> {
  if (!SMTP_HOST) {
    throw new Error("SMTP is not configured. Set SMTP_HOST and related environment variables.");
  }

  const subject = `GEM Feedback — Rating: ${payload.rating}/10 — ${payload.timestamp}`;
  const jsonBody = JSON.stringify(payload, null, 2);

  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">GEM Feedback Received</h2>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-weight: bold; background: #f5f5f5;">Rating</td>
          <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${payload.rating}/10</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-weight: bold; background: #f5f5f5;">Feedback</td>
          <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${payload.feedback}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-weight: bold; background: #f5f5f5;">Timestamp</td>
          <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${payload.timestamp}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-weight: bold; background: #f5f5f5;">Source</td>
          <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${payload.source}</td>
        </tr>
      </table>
      <h3 style="color: #1a1a1a;">Raw JSON</h3>
      <pre style="background: #f5f5f5; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 13px;">${jsonBody}</pre>
    </div>
  `;

  try {
    const result = await transporter.sendMail({
      from: SMTP_FROM,
      to: SMTP_TO,
      subject,
      text: jsonBody,
      html: htmlBody,
    });

    console.log("Email sent successfully:", result.messageId);
    return true;
  } catch (error) {
    console.error("Failed to send email via SMTP:", error);
    throw error;
  }
}