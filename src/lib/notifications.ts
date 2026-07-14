
import {
  Firestore,
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

/**
 * The type of notification to send.
 * - 'direct': A personal alert to a single user.
 * - 'broadcast': A global announcement to all users.
 */
type NotificationType = 'direct' | 'broadcast';

interface DispatchOptions {
  type: NotificationType;
  title: string;
  body: string;
  recipientId?: string; // Required for 'direct' notifications
}

/**
 * Dispatches a notification to the Firestore database.
 *
 * @param firestore The Firestore database instance.
 * @param options The notification details.
 * @throws Will throw an error if sending fails or if a recipientId is missing for a direct notification.
 */
export const dispatchNotification = async (
  firestore: Firestore,
  options: DispatchOptions
): Promise<void> => {
  const { type, title, body, recipientId } = options;

  try {
    if (type === 'direct') {
      if (!recipientId) {
        throw new Error('A recipientId is required for direct notifications.');
      }
      // Writes to the /notifications collection for a specific user
      await addDoc(collection(firestore, 'notifications'), {
        recipientId,
        title,
        body,
        read: false,
        createdAt: serverTimestamp(),
      });
    } else if (type === 'broadcast') {
      // Writes to the /broadcasts collection for all users
      await addDoc(collection(firestore, 'broadcasts'), {
        title,
        body,
        createdAt: serverTimestamp(),
      });
    } else {
      throw new Error(`Unsupported notification type: ${type}`);
    }
  } catch (error) {
    console.error('Error dispatching notification:', error);
    // Re-throw for handling in the UI, e.g., show a toast message
    throw error;
  }
};
