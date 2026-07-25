import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { Resend } from 'resend';

// Initialize Resend client securely within the function scope
let resend: Resend;

// Define the function with secrets management
export const sendWithdrawalTemplateEmail = onDocumentUpdated({
  document: "withdrawal_requests/{docId}",
  secrets: ["RESEND_API_KEY"],
}, async (event) => {
  if (!process.env.RESEND_API_KEY) {
    logger.error("RESEND_API_KEY is not set. Aborting function.");
    return;
  }
  resend = new Resend(process.env.RESEND_API_KEY);

  // Get the state of the document before and after the change
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();

  // Guard clause: Ensure data exists and status has changed from PENDING to APPROVED
  if (!beforeData || !afterData || !(beforeData.status === 'PENDING' && afterData.status === 'APPROVED')) {
    logger.info(`No action taken for withdrawal ${event.params.docId}. Status change was not PENDING -> APPROVED.`);
    return;
  }

  // Extract variables from the newly approved document payload
  const { userEmail: to, accountHolder: userName, fiatAmount: amount, fiatCurrency: currency, processedAt } = afterData;

  // Validate that essential data for the email is present
  if (!to || !userName || !amount || !currency) {
    logger.error(`Missing required data for email in document ${event.params.docId}.`, afterData);
    return;
  }

  // Format the date for the email template
  const transactionDate = processedAt?.toDate()?.toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }) || new Date().toLocaleDateString();

  logger.info(`Attempting to send withdrawal processed email to: ${to}`);

  try {
    const { data, error } = await resend.emails.send({
      from: "Apex Private Ledger <withdrawals@apex-crypto.co.uk>",
      to: [to],
      subject: `💸 Withdrawal Processed: ${amount} ${currency || 'GBP'}`,
      template: {
        id: "re_J5jHzQJq_E6jgaLVZ3RHrJXFzMJ6VbZV5", 
        variables: {
          userName,
          amount: amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          currency,
          transactionDate,
        },
      },
    });

    if (error) {
      logger.error(`Failed to send email for withdrawal ${event.params.docId}. Resend API Error:`, error);
      return;
    }

    logger.info(`Successfully sent email with ID ${data?.id} for withdrawal ${event.params.docId}.`);
  } catch (err) {
    logger.error(`An unexpected error occurred while sending email for withdrawal ${event.params.docId}:`, err);
  }
});
