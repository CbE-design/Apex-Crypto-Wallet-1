
import { NotificationBell } from '@/components/notification-bell';

export function Header() {
  return (
    <header className="flex items-center justify-between p-4 bg-background border-b">
      <div>
        {/* Your Logo or App Name */}
        <h1 className="text-xl font-bold">My App</h1>
      </div>
      <div>
        <NotificationBell />
      </div>
    </header>
  );
}
