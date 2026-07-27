'use server';

import { Resend } from 'resend';

// Initialize Resend directly from environment variables
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Dedicated sender identities under your verified domain apex-crypto.co.uk
export const SENDERS = {
  withdrawals: 'Apex Withdrawals <withdrawals@apex-crypto.co.uk>',
  deposits: 'Apex Ledger <deposits@apex-crypto.co.uk>',
  transfers: 'Apex Transfers <transfers@apex-crypto.co.uk>',
  compliance: 'Apex Compliance <compliance@apex-crypto.co.uk>',
  security: 'Apex Security <security@apex-crypto.co.uk>',
  support: 'Apex Support <support@apex-crypto.co.uk>',
};

// Resend Published Template Slugs / IDs
export const TEMPLATE_IDS = {
  withdrawalApproved: 'withdrawal-confirmation-2',
  withdrawalPending: 'withdrawal-request',
  withdrawalRejected: 'withdrawal-declined',
  depositCredited: 'deposit-confirmation',
  transferReceived: 'transfer-inbound',
  kycApproved: 'identity-verified',
  kycRejected: 'identity-declined',
};

// Generic helper to send hosted Resend templates
async function sendTemplateEmail({
  from,
  to,
  templateId,
  variables,
}: {
  from: string;
  to: string;
  templateId: string;
  variables: Record<string, string>;
}) {
  if (!resend) {
    console.warn('Resend API key missing. Email skipped.');
    return { success: false, error: 'Resend API key missing' };
  }

  try {
    const data = await resend.emails.send({
      from,
      to: [to],
      template: {
        id: templateId,
        variables,
      },
    });
    return { success: true, data };
  } catch (error: any) {
    console.error('Failed to send Resend template email:', error);
    return { success: false, error: error.message };
  }
}

// 1. Withdrawal Approved Email
export async function sendWithdrawalApprovedEmail({
  to,
  userName,
  amount,
  assetType,
  methodDetails,
  method,
  reference,
  transactionId,
  transactionDate,
}: {
  to: string;
  userName?: string;
  amount?: number | string;
  assetType?: string;
  methodDetails?: string;
  method?: string;
  reference?: string;
  transactionId?: string;
  transactionDate?: string;
}) {
  const resolvedTxId = transactionId || reference || `TX-${Math.floor(100000 + Math.random() * 900000)}`;
  const resolvedMethod = methodDetails || method || 'Bank Transfer';
  const resolvedUserName = userName || 'Valued Client';
  const resolvedAsset = assetType || 'USD';

  return sendTemplateEmail({
    from: SENDERS.withdrawals,
    to,
    templateId: TEMPLATE_IDS.withdrawalApproved,
    variables: {
      userName: resolvedUserName,
      Amount: String(amount ?? 0),
      AssetType: resolvedAsset,
      MethodDetails: resolvedMethod,
      TransactionID: resolvedTxId,
      TransactionDate: transactionDate || new Date().toLocaleDateString(),
    },
  });
}

// 2. Withdrawal Pending (Request Received) Email
export async function sendWithdrawalPendingEmail({
  to,
  userName,
  amount,
  assetType,
  methodDetails,
  method,
  reference,
  transactionId,
  transactionDate,
}: {
  to: string;
  userName?: string;
  amount?: number | string;
  assetType?: string;
  methodDetails?: string;
  method?: string;
  reference?: string;
  transactionId?: string;
  transactionDate?: string;
}) {
  const resolvedTxId = transactionId || reference || `TX-${Math.floor(100000 + Math.random() * 900000)}`;
  const resolvedMethod = methodDetails || method || 'Bank Transfer';
  const resolvedUserName = userName || 'Valued Client';
  const resolvedAsset = assetType || 'USD';

  return sendTemplateEmail({
    from: SENDERS.withdrawals,
    to,
    templateId: TEMPLATE_IDS.withdrawalPending,
    variables: {
      userName: resolvedUserName,
      Amount: String(amount ?? 0),
      AssetType: resolvedAsset,
      MethodDetails: resolvedMethod,
      TransactionID: resolvedTxId,
      TransactionDate: transactionDate || new Date().toLocaleDateString(),
    },
  });
}

// 3. Withdrawal Rejected Email
export async function sendWithdrawalRejectedEmail({
  to,
  userName,
  amount,
  assetType,
  rejectionReason,
  reason,
  reference,
  transactionId,
  transactionDate,
}: {
  to: string;
  userName?: string;
  amount?: number | string;
  assetType?: string;
  rejectionReason?: string;
  reason?: string;
  reference?: string;
  transactionId?: string;
  transactionDate?: string;
}) {
  const resolvedTxId = transactionId || reference || `TX-${Math.floor(100000 + Math.random() * 900000)}`;
  const resolvedReason = rejectionReason || reason || 'Standard Compliance Review';
  const resolvedUserName = userName || 'Valued Client';
  const resolvedAsset = assetType || 'USD';

  return sendTemplateEmail({
    from: SENDERS.withdrawals,
    to,
    templateId: TEMPLATE_IDS.withdrawalRejected,
    variables: {
      userName: resolvedUserName,
      Amount: String(amount ?? 0),
      AssetType: resolvedAsset,
      RejectionReason: resolvedReason,
      TransactionID: resolvedTxId,
      TransactionDate: transactionDate || new Date().toLocaleDateString(),
    },
  });
}

// 4. Deposit / Direct Send Credited Email
export async function sendDepositCreditedEmail({
  to,
  userName,
  amount,
  asset,
  assetType,
  transactionId,
  transactionDate,
  notes,
}: {
  to: string;
  userName?: string;
  amount?: number | string;
  asset?: string;
  assetType?: string;
  transactionId?: string;
  transactionDate?: string;
  notes?: string;
}) {
  const resolvedAsset = assetType || asset || 'USDT';
  const resolvedUserName = userName || 'Valued Client';
  const resolvedTxId = transactionId || `TX-${Math.floor(100000 + Math.random() * 900000)}`;

  return sendTemplateEmail({
    from: SENDERS.deposits,
    to,
    templateId: TEMPLATE_IDS.depositCredited,
    variables: {
      userName: resolvedUserName,
      Amount: String(amount ?? 0),
      AssetType: resolvedAsset,
      TransactionID: resolvedTxId,
      TransactionDate: transactionDate || new Date().toLocaleDateString(),
    },
  });
}

// 5. Internal Transfer Received Email
export async function sendTransferReceivedEmail({
  to,
  userName,
  amount,
  assetType,
  senderName,
  transactionId,
  transactionDate,
}: {
  to: string;
  userName?: string;
  amount?: number | string;
  assetType?: string;
  senderName?: string;
  transactionId?: string;
  transactionDate?: string;
}) {
  const resolvedUserName = userName || 'Valued Client';
  const resolvedAsset = assetType || 'USDT';
  const resolvedSender = senderName || 'Apex User';
  const resolvedTxId = transactionId || `TX-${Math.floor(100000 + Math.random() * 900000)}`;

  return sendTemplateEmail({
    from: SENDERS.transfers,
    to,
    templateId: TEMPLATE_IDS.transferReceived,
    variables: {
      userName: resolvedUserName,
      Amount: String(amount ?? 0),
      AssetType: resolvedAsset,
      SenderName: resolvedSender,
      TransactionID: resolvedTxId,
      TransactionDate: transactionDate || new Date().toLocaleDateString(),
    },
  });
}

// 6. Identity Verification (KYC) Approved Email
export async function sendKycApprovedEmail({
  to,
  userName,
  transactionDate,
}: {
  to: string;
  userName?: string;
  transactionDate?: string;
}) {
  const resolvedUserName = userName || 'Valued Client';

  return sendTemplateEmail({
    from: SENDERS.compliance,
    to,
    templateId: TEMPLATE_IDS.kycApproved,
    variables: {
      userName: resolvedUserName,
      TransactionDate: transactionDate || new Date().toLocaleDateString(),
    },
  });
}

// 7. Identity Verification (KYC) Rejected Email
export async function sendKycRejectedEmail({
  to,
  email,
  userName,
  name,
  reason,
  rejectionReason,
  transactionDate,
}: {
  to?: string;
  email?: string;
  userName?: string;
  name?: string;
  reason?: string;
  rejectionReason?: string;
  transactionDate?: string;
}) {
  const resolvedTo = to || email || '';
  const resolvedUserName = userName || name || 'Valued Client';
  const resolvedReason = rejectionReason || reason || 'Document verification failed.';

  if (!resolvedTo) {
    console.warn('No recipient email provided for KYC rejection email.');
    return { success: false, error: 'Missing recipient' };
  }

  return sendTemplateEmail({
    from: SENDERS.compliance,
    to: resolvedTo,
    templateId: TEMPLATE_IDS.kycRejected,
    variables: {
      userName: resolvedUserName,
      RejectionReason: resolvedReason,
      TransactionDate: transactionDate || new Date().toLocaleDateString(),
    },
  });
}

// Aliases for page compatibility
export { sendDepositCreditedEmail as sendWalletCreditedEmail };
export { sendWithdrawalPendingEmail as sendWithdrawalRequestEmail };
