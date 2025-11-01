'use client';

import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { PrivateRoute } from '@/components/private-route';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <PrivateRoute>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and application preferences.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize the look and feel of the application.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
                <Label htmlFor="theme">Theme</Label>
                <div className="flex items-center gap-2">
                    <Button
                        variant={theme === 'light' ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => setTheme('light')}
                        aria-label="Set light theme"
                    >
                        <Sun className="h-5 w-5" />
                    </Button>
                     <Button
                        variant={theme === 'dark' ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => setTheme('dark')}
                        aria-label="Set dark theme"
                    >
                        <Moon className="h-5 w-5" />
                    </Button>
                </div>
            </div>
             <p className="text-sm text-muted-foreground">
                Current theme: <span className="font-semibold capitalize">{theme}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </PrivateRoute>
  );
}
