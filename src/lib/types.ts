import { z } from 'zod';

export interface ProtocolStatus {
  isActive: boolean;
  version: string;
  lastUpdated: number;
  maintenanceMode: boolean;
}

export interface PortfolioAsset {
  symbol: string;
  name: string;
  amount: number;
  valueUSD: number;
  priceUSD: number;
  change24h: number;
  icon: string;
}

export interface MarketCoin {
  symbol: string;
  name: string;
  priceUSD: number;
  change24h: number;
  marketCap: number;
  icon: string;
}

export interface Transaction {
  id: string;
  type: 'Buy' | 'Sell' | 'Withdrawal' | 'Swap' | 'Internal Transfer';
  currency: string;
  amount: number;
  price: number;
  status: 'Completed' | 'Pending' | 'Failed' | 'Reconciling';
  timestamp: any;
  notes?: string;
  sender?: string;
  recipient?: string;
  metadata?: {
    travelRuleVerified: boolean;
    complianceId?: string;
    protocol?: string;
  };
}

export interface PriceAlert {
  id: string;
  userId: string;
  currency: string;
  thresholdPrice: number;
  alertType: 'Above' | 'Below';
  triggered: boolean;
}

export interface Wallet {
  id: string;
  userId: string;
  name: string;
  symbol: string;
  balance: number;
  address: string;
  createdAt: any;
}

export const GetExchangeRateInputSchema = z.object({
  fromAsset: z.string().describe('The symbol of the cryptocurrency to convert from.'),
  toAsset: z.string().describe('The symbol of the cryptocurrency to convert to.'),
  fiatCurrency: z.string().optional().describe('The target fiat currency symbol (e.g., "USD", "EUR", "ZAR"). Defaults to USD.'),
});
export type GetExchangeRateInput = z.infer<typeof GetExchangeRateInputSchema>;

export const GetExchangeRateOutputSchema = z.object({
  rate: z.number().describe('The exchange rate from the "from" asset to the "to" asset.'),
});
export type GetExchangeRateOutput = z.infer<typeof GetExchangeRateOutputSchema>;

export const SupportAgentInputSchema = z.object({
  query: z.string().describe("The user's question for the support agent."),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })).optional().describe('The previous conversation history.'),
});
export type SupportAgentInput = z.infer<typeof SupportAgentInputSchema>;

export const SupportAgentOutputSchema = z.object({
  response: z
    .string()
    .describe('A helpful and friendly response to the user\'s query.'),
});
export type SupportAgentOutput = z.infer<typeof SupportAgentOutputSchema>;

export const CryptoAssistantInputSchema = z.object({
  query: z.string().describe("The user's question about cryptocurrency."),
});
export type CryptoAssistantInput = z.infer<typeof CryptoAssistantInputSchema>;

export const CryptoAssistantOutputSchema = z.object({
  response: z
    .string()
    .describe('A helpful and informative response to the user\'s query.'),
});
export type CryptoAssistantOutput = z.infer<typeof CryptoAssistantOutputSchema>;

export const NotificationCategorySchema = z.enum(['general', 'market', 'security', 'system', 'promotion']);
export type NotificationCategory = z.infer<typeof NotificationCategorySchema>;

export const NotificationPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
export type NotificationPriority = z.infer<typeof NotificationPrioritySchema>;

export const SendNotificationInputSchema = z.object({
  title: z.string().describe('The title of the notification.'),
  body: z.string().describe('The body content of the notification.'),
  category: NotificationCategorySchema.default('general').describe('The category/label of the notification.'),
  priority: NotificationPrioritySchema.default('normal').describe('The urgency level of the notification.'),
  sender: z.string().optional().describe('The sender or admin identifier.'),
});
export type SendNotificationInput = z.infer<typeof SendNotificationInputSchema>;

export const SendNotificationOutputSchema = z.object({
  successCount: z.number().describe('The number of messages that were sent successfully.'),
  failureCount: z.number().describe('The number of messages that could not be sent.'),
  broadcastId: z.string().optional().describe('The Firestore broadcast document ID.'),
});
export type SendNotificationOutput = z.infer<typeof SendNotificationOutputSchema>;

export interface BroadcastNotification {
  id: string;
  title: string;
  body: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  sender?: string;
  read: boolean;
  createdAt: any;
  sentCount?: number;
  failureCount?: number;
  metadata?: Record<string, any>;
}

export const SendEmailInputSchema = z.object({
  subject: z.string().describe('The subject of the email.'),
  body: z.string().describe('The HTML body content of the email.'),
});
export type SendEmailInput = z.infer<typeof SendEmailInputSchema>;

export const SendEmailOutputSchema = z.object({
  success: z.boolean().describe('Whether the email sending was initiated successfully.'),
  message: z.string().describe('A summary message of the result.'),
});
export type SendEmailOutput = z.infer<typeof SendEmailOutputSchema>;

export interface Currency {
    symbol: string;
    name: string;
    flag?: string;
    flagUrl: string;
}

// User Profile (shared across contexts and hooks)
export interface UserProfile {
  id: string;
  email: string;
  createdAt: any;
  walletAddress: string;
  walletAddressLowercase?: string;
  fcmToken?: string;
  kycStatus?: KYCStatus;
  kycSubmittedAt?: any;
  kycApprovedAt?: any;
  lastLogin?: any;
  lastSeen?: any;
  isOnline?: boolean;
  isRestricted?: boolean;
  restrictedReason?: string;
  restrictedAt?: any;
  restrictedBy?: string;
}

// KYC Status Types
export type KYCStatus = 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';

// Withdrawal Request Types
export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type WithdrawalMethod = 'EFT' | 'SWIFT';

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userEmail: string;
  walletAddress: string;
  
  // Asset details
  cryptoSymbol: string;
  cryptoAmount: number;
  fiatCurrency: string;
  fiatAmount: number;
  exchangeRate: number;
  networkFee: number;
  
  // Bank details
  withdrawalMethod: WithdrawalMethod;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  routingNumber?: string;
  swiftCode?: string;
  
  // Status tracking
  status: WithdrawalStatus;
  createdAt: any;
  updatedAt: any;
  processedAt?: any;
  processedBy?: string;
  rejectionReason?: string;
  transactionReference?: string;
}

// Admin Notification Types
export type AdminNotificationType = 'KYC_VERIFICATION' | 'WITHDRAWAL_REQUEST' | 'SUPPORT_TICKET' | 'SYSTEM_ALERT' | 'NEW_USER';

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  userId?: string;
  userEmail?: string;
  referenceId?: string;
  read: boolean;
  createdAt: any;
  metadata?: Record<string, any>;
}

// KYC Document Types
export interface KYCSubmission {
  id: string;
  userId: string;
  userEmail: string;
  walletAddress: string;
  status: KYCStatus;
  
  // Personal info
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  address: string;
  
  // Country & jurisdiction
  countryCode: string;

  // Document info
  documentType: 'passport' | 'drivers_license' | 'national_id';
  documentNumber: string;
  documentExpiry: string;

  // Uploaded images (Firebase Storage URLs)
  documentImageUrl: string;
  selfieImageUrl: string;

  // Timestamps
  submittedAt: any;
  reviewedAt?: any;
  reviewedBy?: string;
  rejectionReason?: string;

  // Auto-verification results (computed by admin API)
  autoVerification?: {
    runAt: any;
    ocrConfidence: number;
    extractedFields: {
      fullName: string;
      documentNumber: string;
      dateOfBirth: string;
    };
    fieldMatches: {
      nameMatch: boolean;
      idMatch: boolean;
      dobMatch: boolean;
    };
    faceMatchScore: number;
    overallConfidence: number;
    recommendation: 'AUTO_APPROVE' | 'MANUAL_REVIEW' | 'REJECT';
    rawOcrText: string;
  };

  // Linked withdrawal intent (populated when KYC was triggered by a cash-out attempt)
  withdrawalIntent?: {
    amount: string;
    currency: string;
    method: 'EFT' | 'SWIFT';
  } | null;
}
