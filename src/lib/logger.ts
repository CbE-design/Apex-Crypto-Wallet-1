/**
 * Standardized logging utility for Apex Wallet.
 * Logs will appear in the Firebase App Hosting / Cloud Run console.
 */
export const logger = {
  info: (tag: string, message: string, data?: any) => {
    console.log(`[INFO][${tag}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  
  warn: (tag: string, message: string, data?: any) => {
    console.warn(`[WARN][${tag}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  
  error: (tag: string, message: string, error?: any) => {
    console.error(`[ERROR][${tag}] ${message}`, error || '');
  },
  
  security: (tag: string, message: string, data?: any) => {
    console.log(`[SECURITY][${tag}] 🛡️  ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
};
