'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUser, useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useCurrency } from '@/context/currency-context';

const formSchema = z.object({
  amount: z.string().nonempty({ message: "Amount is required" }),
  bankName: z.string().nonempty({ message: "Bank name is required" }),
  accountNumber: z.string().nonempty({ message: "Account number is required" }),
  accountHolder: z.string().nonempty({ message: "Account holder name is required" }),
});

export function WithdrawalForm() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { cryptoRates } = useCurrency();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "",
      bankName: "",
      accountNumber: "",
      accountHolder: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user || !firestore) return;

    try {
      await addDoc(collection(firestore, 'withdrawal_requests'), {
        userId: user.uid,
        fiatAmount: parseFloat(values.amount),
        fiatCurrency: 'ZAR',
        cryptoSymbol: 'BTC', // Assuming BTC for now
        cryptoAmount: parseFloat(values.amount) / cryptoRates.BTC, // Simplified conversion
        status: 'PENDING',
        withdrawalMethod: 'EFT',
        bankName: values.bankName,
        accountNumber: values.accountNumber,
        accountHolder: values.accountHolder,
        createdAt: serverTimestamp(),
      });
      form.reset();
      // TODO: Add toast notification for success
    } catch (error) {
      console.error("Error creating withdrawal request:", error);
      // TODO: Add toast notification for error
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/60">
      <CardHeader>
        <CardTitle>Request a Withdrawal</CardTitle>
        <CardDescription>Enter the details for your withdrawal request.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (ZAR)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 500.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., FNB" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accountNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 123456789" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accountHolder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Holder Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">Submit Request</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
