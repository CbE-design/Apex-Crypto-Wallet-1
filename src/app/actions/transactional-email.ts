'use server';

import { sendTransactionalEmail, buildEmailTemplate } from '@/lib/email';

export async function sendDepositReceivedEmail({
  to,
  asset,
  amount,
  txHash,
}: {
  to: string;
  asset: string;
  amount: number;
  txHash: string;
}) {
  return sendTransactionalEmail({
    to,
    subject: `Deposit Received: ${amount.toFixed(6)} ${asset}`,
    html: buildEmailTemplate({
      title: 'Deposit Confirmed',
      previewText: `We have received a ${asset} deposit into your wallet.`,
      body: `Amount: <strong>${amount.toFixed(6)} ${asset}</strong><br />Transaction: <code>${txHash}</code>`,
      cta: 'View Wallet',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/wallet`,
    }),
  });
}

export async function sendWithdrawalRequestEmail({
  to,
  reference,
  method,
  amount,
}: {
  to: string;
  reference: string;
  method: 'EFT' | 'SWIFT';
  amount: number;
}) {
  return sendTransactionalEmail({
    to,
    subject: `Withdrawal Request Submitted · ${reference}`,
    html: buildEmailTemplate({
      title: 'Withdrawal Request Received',
      previewText: `Your ${method} withdrawal request for ${amount.toFixed(2)} ZAR has been received.`,
      body: `Reference: <strong>${reference}</strong><br />Method: ${method}<br />Amount: ${amount.toFixed(2)} ZAR`,
      cta: 'View Status',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/cash-out`,
    }),
  });
}

export async function sendWithdrawalApprovedEmail({
  to,
  reference,
  method,
  amount,
}: {
  to: string;
  reference: string;
  method: 'EFT' | 'SWIFT';
  amount: number;
}) {
  return sendTransactionalEmail({
    to,
    subject: `Withdrawal Approved · ${reference}`,
    html: buildEmailTemplate({
      title: 'Withdrawal Approved',
      previewText: `Your ${method} withdrawal of ${amount.toFixed(2)} ZAR has been approved.`,
      body: `Reference: <strong>${reference}</strong><br />Method: ${method}<br />Amount: ${amount.toFixed(2)} ZAR`,
      cta: 'View Wallet',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/wallet`,
    }),
  });
}

export async function sendWithdrawalRejectedEmail({
  to,
  reference,
  reason,
}: {
  to: string;
  reference: string;
  reason: string;
}) {
  return sendTransactionalEmail({
    to,
    subject: `Withdrawal Rejected · ${reference}`,
    html: buildEmailTemplate({
      title: 'Withdrawal Rejected',
      previewText: 'Your withdrawal request could not be approved.',
      body: `Reference: <strong>${reference}</strong><br />Reason: ${reason}`,
      cta: 'Contact Support',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/support`,
    }),
  });
}

export async function sendWalletCreditedEmail({
  to,
  asset,
  amount,
  notes,
}: {
  to: string;
  asset: string;
  amount: number;
  notes?: string;
}) {
  return sendTransactionalEmail({
    to,
    subject: `Wallet Credited: ${amount.toFixed(6)} ${asset}`,
    html: buildEmailTemplate({
      title: 'Wallet Credited',
      previewText: `Your wallet has been credited with ${amount.toFixed(6)} ${asset}.`,
      body: `Amount: <strong>${amount.toFixed(6)} ${asset}</strong>${notes ? `<br />Note: ${notes}` : ''}`,
      cta: 'View Wallet',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/wallet`,
    }),
  });
}

export async function sendTransferReceivedEmail({
  to,
  asset,
  amount,
  senderAddress,
}: {
  to: string;
  asset: string;
  amount: number;
  senderAddress: string;
}) {
  return sendTransactionalEmail({
    to,
    subject: `You Received ${amount.toFixed(6)} ${asset}`,
    html: buildEmailTemplate({
      title: 'Incoming Transfer',
      previewText: `You have received ${amount.toFixed(6)} ${asset} in your wallet.`,
      body: `Amount: <strong>${amount.toFixed(6)} ${asset}</strong><br />From: <code>${senderAddress}</code>`,
      cta: 'View Wallet',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/wallet`,
    }),
  });
}

export async function sendTransferSentEmail({
  to,
  asset,
  amount,
  recipientAddress,
}: {
  to: string;
  asset: string;
  amount: number;
  recipientAddress: string;
}) {
  return sendTransactionalEmail({
    to,
    subject: `Transfer Sent: ${amount.toFixed(6)} ${asset}`,
    html: buildEmailTemplate({
      title: 'Transfer Sent',
      previewText: `You have sent ${amount.toFixed(6)} ${asset}.`,
      body: `Amount: <strong>${amount.toFixed(6)} ${asset}</strong><br />To: <code>${recipientAddress}</code>`,
      cta: 'View Wallet',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/wallet`,
    }),
  });
}
