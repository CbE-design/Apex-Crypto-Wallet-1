'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Mail, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface EmailCollectionDialogProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (email: string) => void;
}

export function EmailCollectionDialog({ userId, open, onOpenChange, onSaved }: EmailCollectionDialogProps) {
  const [email, setEmail] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim().includes('@')) {
      toast({ title: 'Invalid Email', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore is not available.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateDoc(doc(firestore, 'users', userId), { email: email.trim() });
      toast({ title: 'Email Saved', description: 'You can now receive account notifications.' });
      onSaved?.(email.trim());
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save email:', error);
      toast({ title: 'Failed to Save', description: 'Could not save your email. Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-white/[0.08] bg-[#0A0C12]/95 backdrop-blur-2xl rounded-[24px] max-w-sm">
        <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[24px] bg-gradient-to-r from-cyan-500 to-violet-500" />
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <Mail className="h-4 w-4 text-cyan-400" />
            </div>
            <DialogTitle className="text-white text-lg">Stay Updated</DialogTitle>
          </div>
          <DialogDescription className="text-white/40 text-sm leading-relaxed">
            Add your email address so we can send you deposit confirmations, withdrawal updates, and important account alerts.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-medium text-white/60">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20"
              required
              disabled={isSubmitting}
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting || !email.trim().includes('@')}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white font-semibold"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Email
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
