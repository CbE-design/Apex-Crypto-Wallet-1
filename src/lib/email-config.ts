/**
 * Email configuration constants.
 * This file does NOT use 'use server' so it can safely export objects and constants.
 */

// Dedicated sender identities under the verified domain apex-crypto.co.uk
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
