import { Resend } from 'resend';

export interface TransactionalEmailParams {
  to: string;
  subject: string;
  html: string;
}

export interface TransactionalEmailResult {
  success: boolean;
  message: string;
}

export function getEmailConfig(): { apiKey?: string; from?: string; ready: boolean } {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;
  return { apiKey, from, ready: !!apiKey && !!from };
}

export function isValidEmail(email: string): boolean {
  return typeof email === 'string' && email.includes('@') && !email.endsWith('@apex.io');
}

export async function sendTransactionalEmail(
  params: TransactionalEmailParams,
): Promise<TransactionalEmailResult> {
  const { apiKey, from, ready } = getEmailConfig();

  if (!ready) {
    return {
      success: false,
      message: 'Email configuration is incomplete. Please set RESEND_API_KEY and FROM_EMAIL.',
    };
  }

  if (!isValidEmail(params.to)) {
    return { success: false, message: 'Invalid or missing recipient email.' };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: from!,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      return { success: false, message: `Resend error: ${error.message}` };
    }

    return { success: true, message: 'Email sent successfully.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, message: `Failed to send email: ${message}` };
  }
}

export function buildEmailTemplate({
  title,
  previewText,
  body,
  cta,
  ctaUrl,
  footer,
}: {
  title: string;
  previewText: string;
  body: string;
  cta?: string;
  ctaUrl?: string;
  footer?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0A0C12; color: #E5E7EB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 560px; margin: 0 auto; padding: 32px 24px; }
    .card { background: #11131A; border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; padding: 28px; }
    .logo { font-size: 22px; font-weight: 700; color: #22D3EE; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 700; color: #FFFFFF; margin: 0 0 16px; }
    p { font-size: 15px; line-height: 1.6; color: #9CA3AF; margin: 0 0 16px; }
    .highlight { background: rgba(34, 211, 238, 0.08); border-left: 3px solid #22D3EE; padding: 12px 16px; border-radius: 8px; margin: 16px 0; }
    .button { display: inline-block; background: #22D3EE; color: #050505; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 14px; margin-top: 8px; }
    .footer { font-size: 12px; color: #6B7280; margin-top: 24px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">Apex Wallet</div>
      <h1>${title}</h1>
      <p>${previewText}</p>
      <div class="highlight">${body}</div>
      ${cta && ctaUrl ? `<a href="${ctaUrl}" class="button">${cta}</a>` : ''}
    </div>
    <div class="footer">${footer ?? 'Apex Wallet · Institutional-grade crypto custody'}</div>
  </div>
</body>
</html>`;
}
