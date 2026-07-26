'use server';

import { resend } from '@/lib/email';

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
  transactionId,
  transactionDate,
}: {
  to: string;
  userName: string;
  amount: number | string;
  assetType: string;
  methodDetails: string;
  transactionId: string;
  transactionDate?: string;
}) {
  return sendTemplateEmail({
    from: SENDERS.withdrawals,
    to,
    templateId: TEMPLATE_IDS.withdrawalApproved,
    variables: {
      userName,
      Amount: String(amount),
      AssetType: assetType,
      MethodDetails: methodDetails,
      TransactionID: transactionId,
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
  transactionId,
  transactionDate,
}: {
  to: string;
  userName: string;
  amount: number | string;
  assetType: string;
  methodDetails: string;
  transactionId: string;
  transactionDate?: string;
}) {
  return sendTemplateEmail({
    from: SENDERS.withdrawals,
    to,
    templateId: TEMPLATE_IDS.withdrawalPending,
    variables: {
      userName,
      Amount: String(amount),
      AssetType: assetType,
      MethodDetails: methodDetails,
      TransactionID: transactionId,
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
  transactionId,
  transactionDate,
}: {
  to: string;
  userName: string;
  amount: number | string;
  assetType: string;
  rejectionReason: string;
  transactionId: string;
  transactionDate?: string;
}) {
  return sendTemplateEmail({
    from: SENDERS.withdrawals,
    to,
    templateId: TEMPLATE_IDS.withdrawalRejected,
    variables: {
      userName,
      Amount: String(amount),
      AssetType: assetType,
      RejectionReason: rejectionReason,
      TransactionID: transactionId,
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
  amount: number | string;
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
      Amount: String(amount),
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
  userName: string;
  amount: number | string;
  assetType: string;
  senderName: string;
  transactionId: string;
  transactionDate?: string;
}) {
  return sendTemplateEmail({
    from: SENDERS.transfers,
    to,
    templateId: TEMPLATE_IDS.transferReceived,
    variables: {
      userName,
      Amount: String(amount),
      AssetType: assetType,
      SenderName: senderName,
      TransactionID: transactionId,
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
  userName: string;
  transactionDate?: string;
}) {
  return sendTemplateEmail({
    from: SENDERS.compliance,
    to,
    templateId: TEMPLATE_IDS.kycApproved,
    variables: {
      userName,
      TransactionDate: transactionDate || new Date().toLocaleDateString(),
    },
  });
}

// Alias for direct-send page compatibility
export { sendDepositCreditedEmail as sendWalletCreditedEmail };
