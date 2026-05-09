'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface State { hasError: boolean; message: string }

export class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? 'Unknown error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AdminErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center p-8">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center border border-destructive/20">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-widest mb-2">Panel Error</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {this.state.message || 'An unexpected error occurred in the admin panel.'}
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => {
              this.setState({ hasError: false, message: '' });
              window.location.reload();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Reload Panel
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
