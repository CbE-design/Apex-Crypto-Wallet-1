import { Bell, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="flex items-center justify-between p-4 border-b bg-card shadow-sm sticky top-0 z-10">
      <h1 className="text-xl md:text-2xl font-bold text-primary">Apex Crypto Wallet</h1>
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" className="rounded-full">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full">
          <UserCircle className="h-6 w-6" />
          <span className="sr-only">Profile</span>
        </Button>
      </div>
    </header>
  );
}
