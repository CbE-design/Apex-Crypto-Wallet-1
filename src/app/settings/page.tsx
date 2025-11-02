'use client';

import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Globe } from 'lucide-react';
import { PrivateRoute } from '@/components/private-route';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrency } from '@/context/currency-context';
import { currencies } from '@/lib/currencies';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();

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
        <Card>
          <CardHeader>
            <CardTitle>Localization</CardTitle>
            <CardDescription>Set your preferred currency for display throughout the app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                  <Label htmlFor="currency-select" className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      Display Currency
                  </Label>
                   <Select value={currency.symbol} onValueChange={setCurrency}>
                      <SelectTrigger id="currency-select" className="w-48">
                          <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                          {currencies.map(c => (
                            <SelectItem key={c.symbol} value={c.symbol}>
                                {c.name} ({c.symbol})
                            </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>
               <p className="text-sm text-muted-foreground">
                All financial values in the app will be displayed in <span className="font-semibold">{currency.name} ({currency.symbol})</span>.
            </p>
          </CardContent>
        </Card>
      </div>
    </PrivateRoute>
  );
}
