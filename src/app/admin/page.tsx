
'use client';

import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';

export default function AdminPage() {
  const { userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If not loading and the user is not an admin, redirect them
    if (!loading && (!userProfile || !userProfile.isAdmin)) {
      router.push('/');
    }
  }, [userProfile, loading, router]);

  // Render nothing or a loading spinner while checking auth
  if (loading || !userProfile || !userProfile.isAdmin) {
    return null;
  }

  // Render the admin dashboard if the user is an admin
  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4">
        <ShieldCheck className="h-8 w-8 text-primary" />
        <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Welcome, Admin! Manage your application here.</p>
        </div>
       </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>This is a protected area only visible to administrators.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            You can add admin-specific components here, like user management tables, application statistics, or configuration settings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
