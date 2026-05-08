/**
 * SMTP Email Service
 *
 * Sends feedback JSON payload via SMTP to the configured address.
 * Does NOT store anything in Supabase — just forwards the output.
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

// Create a reusable transporter (lazy init)
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true for port 465, false for 587
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      tls: {
        // Do not fail on self-signed certs
        rejectUnauthorized: false,
      },
    });
  }
  return transporter;
}

/**
 * Sends the feedback payload as a JSON email via SMTP.
 */
export async function sendFeedbackEmail(payload: FeedbackPayload): Promise<boolean> {
  const transport = getTransporter();

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
    const result = await transport.sendMail({
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
