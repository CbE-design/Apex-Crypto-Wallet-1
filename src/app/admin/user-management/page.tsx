
'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Send, Loader2, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/context/wallet-context';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, runTransaction, doc, serverTimestamp, getDoc, where, limit, getDocs } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { PortfolioValue } from '@/components/admin/user-management/portfolio-value';
import { CryptoIcon } from '@/components/crypto-icon';
import { Label } from '@/components/ui/label';

interface UserProfile {
    id: string;
    walletAddress: string;
    createdAt: Timestamp;
}

export default function UserManagementPage() {
    const { toast } = useToast();
    const { user, wallet, createWallet, confirmAndCreateWallet } = useWallet();
    const firestore = useFirestore();

    const [searchTerm, setSearchTerm] = useState('');
    const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
    const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
    const [isNewUserMnemonicDialogOpen, setIsNewUserMnemonicDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [newMnemonic, setNewMnemonic] = useState('');
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    
    // State for the send crypto form
    const [sendAmount, setSendAmount] = useState('');
    const [isSending, setIsSending] = useState(false);
    const sendAsset = 'ETH'; // Hardcoded to ETH for now

    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore]);

    const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

    const filteredUsers = useMemo(() => {
        if (!users) return [];
        return users.filter(user => 
            user.walletAddress.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [users, searchTerm]);

    const handleSendClick = (user: UserProfile) => {
        setSelectedUser(user);
        setIsSendDialogOpen(true);
        setSendAmount('');
        setIsSending(false);
    }

    const handleAddUser = async () => {
        setIsCreatingUser(true);
        try {
            const generatedMnemonic = await createWallet();
            setNewMnemonic(generatedMnemonic);
            setIsAddUserDialogOpen(false);
            setIsNewUserMnemonicDialogOpen(true);
        } catch (error) {
            toast({
                title: 'Error Creating Wallet',
                description: 'Could not generate a new wallet. Please try again.',
                variant: 'destructive'
            });
        } finally {
            setIsCreatingUser(false);
        }
    }

    const handleConfirmNewUser = async () => {
        if (!newMnemonic) {
            toast({
                title: 'Mnemonic not found',
                description: 'Cannot create user without a mnemonic.',
                variant: 'destructive'
            });
            return;
        }
        setIsCreatingUser(true);
        try {
            await confirmAndCreateWallet(newMnemonic);
            toast({
                title: "User Created",
                description: "The new user has been successfully created and their wallet is ready.",
            });
            setIsNewUserMnemonicDialogOpen(false);
            setNewMnemonic('');
        } catch (error) {
             toast({
                title: 'User Creation Failed',
                description: 'There was an error finalizing the user creation.',
                variant: 'destructive'
            });
        } finally {
            setIsCreatingUser(false);
        }
    }

    const handleConfirmSend = async () => {
        if (!user || !wallet || !firestore || !selectedUser || !sendAmount) {
            toast({ title: "Cannot process transaction", description: "Admin wallet or selected user is not properly configured.", variant: "destructive"});
            return;
        }

        setIsSending(true);
        const amount = parseFloat(sendAmount);

        try {
            await runTransaction(firestore, async (transaction) => {
                // 1. Get admin's wallet
                const adminWalletRef = doc(firestore, 'users', user.uid, 'wallets', sendAsset);
                const adminWalletDoc = await transaction.get(adminWalletRef);

                if (!adminWalletDoc.exists() || adminWalletDoc.data().balance < amount) {
                    throw new Error(`Insufficient admin balance of ${sendAsset}.`);
                }

                // 2. Debit admin's wallet
                const newAdminBalance = adminWalletDoc.data().balance - amount;
                transaction.update(adminWalletRef, { balance: newAdminBalance });

                // 3. Log admin's 'send' transaction
                const adminTxRef = doc(collection(adminWalletRef, 'transactions'));
                transaction.set(adminTxRef, {
                    userId: user.uid,
                    type: 'Sell',
                    amount: amount,
                    price: 0,
                    timestamp: serverTimestamp(),
                    notes: `Sent to user ${selectedUser.id}`
                });

                // 4. Get recipient's wallet
                const recipientWalletRef = doc(firestore, 'users', selectedUser.id, 'wallets', sendAsset);
                const recipientWalletDoc = await transaction.get(recipientWalletRef);
                const recipientCurrentBalance = recipientWalletDoc.exists() ? recipientWalletDoc.data().balance : 0;
                
                // 5. Credit recipient's wallet
                const newRecipientBalance = recipientCurrentBalance + amount;
                transaction.set(recipientWalletRef, { 
                    balance: newRecipientBalance, 
                    currency: sendAsset,
                    id: sendAsset,
                    userId: selectedUser.id
                }, { merge: true });


                // 6. Log recipient's 'receive' transaction
                const recipientTxRef = doc(collection(recipientWalletRef, 'transactions'));
                transaction.set(recipientTxRef, {
                    userId: selectedUser.id,
                    type: 'Buy',
                    amount: amount,
                    price: 0,
                    timestamp: serverTimestamp(),
                    notes: `Received from admin`
                });
            });

            toast({
                title: 'Transaction Successful',
                description: `Successfully sent ${amount} ${sendAsset} to ${selectedUser.walletAddress}.`,
            });

            setIsSendDialogOpen(false);
        } catch (error: any) {
            console.error("Admin send transaction failed:", error);
            toast({
                title: 'Transaction Failed',
                description: error.message || 'Could not complete the transaction.',
                variant: 'destructive',
            });
        } finally {
            setIsSending(false);
        }
    }
    
  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold">User Management</h1>
                <p className="text-muted-foreground">Monitor and manage all application users.</p>
            </div>
             <Button onClick={() => setIsAddUserDialogOpen(true)}>
                <PlusCircle className="mr-2" />
                Add User
            </Button>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>A list of all users in the system.</CardDescription>
                <div className="pt-4">
                    <Input 
                        placeholder="Search by wallet address..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-sm"
                    />
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Wallet Address</TableHead>
                            <TableHead>Total Portfolio Value</TableHead>
                            <TableHead>Join Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingUsers ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                                </TableCell>
                            </TableRow>
                        ) : filteredUsers.length > 0 ? (
                            filteredUsers.map(user => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-mono">{user.walletAddress}</TableCell>
                                    <TableCell>
                                        <PortfolioValue userId={user.id} />
                                    </TableCell>
                                    <TableCell>{user.createdAt?.toDate().toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Open menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleSendClick(user)} disabled={user.id === (auth.currentUser?.uid || '')}>
                                                    <Send className="mr-2 h-4 w-4" />
                                                    <span>Send Crypto</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    No users found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        {/* Send Crypto Dialog */}
        <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
            <DialogContent>
                 <DialogHeader>
                    <DialogTitle>Send Crypto to User</DialogTitle>
                    <DialogDescription>
                        Send ETH directly to <strong className="font-mono text-primary">{selectedUser?.walletAddress}</strong>. This amount will be debited from your admin wallet.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                   <div className="space-y-2">
                        <Label htmlFor="send-asset">Asset</Label>
                         <div className="flex items-center gap-2 p-2 rounded-md bg-muted w-full">
                            <CryptoIcon name="Ethereum" />
                            <span className="font-semibold">Ethereum (ETH)</span>
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="send-amount">Amount</Label>
                        <Input
                            id="send-amount"
                            type="number"
                            placeholder="0.00"
                            value={sendAmount}
                            onChange={(e) => setSendAmount(e.target.value)}
                            disabled={isSending}
                        />
                    </div>
                </div>
                 <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" disabled={isSending}>Cancel</Button>
                    </DialogClose>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button disabled={isSending || !sendAmount || parseFloat(sendAmount) <= 0}>
                                Review & Send
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Transaction</AlertDialogTitle>
                                <AlertDialogDescription>
                                    You are about to send {sendAmount} {sendAsset}. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="space-y-2 py-2 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Recipient</span>
                                    <span className="font-mono break-all text-right ml-4">{selectedUser?.walletAddress}</span>
                                </div>
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleConfirmSend} disabled={isSending}>
                                    {isSending ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2" />}
                                    Confirm & Send
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        {/* Add User Confirmation Dialog */}
        <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
            <DialogContent>
                 <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>
                        This will generate a new wallet and a unique seed phrase for a new user.
                    </DialogDescription>
                </DialogHeader>
                 <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleAddUser} disabled={isCreatingUser}>
                        {isCreatingUser ? <Loader2 className="animate-spin mr-2"/> : null}
                        Generate New User Wallet
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

         {/* New User Mnemonic Dialog */}
        <Dialog open={isNewUserMnemonicDialogOpen} onOpenChange={setIsNewUserMnemonicDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New User's Seed Phrase</DialogTitle>
                    <DialogDescription>
                    This is the new user's seed phrase. Copy it now and provide it to the user.
                    <strong className="text-destructive"> They will NOT be able to recover their wallet without it. This is the only time you will see this.</strong>
                    </DialogDescription>
                </DialogHeader>
                <div className="my-4 p-4 bg-muted rounded-lg font-mono text-center text-lg tracking-wider">
                    {newMnemonic}
                </div>
                <DialogFooter>
                    <Button onClick={handleConfirmNewUser} disabled={isCreatingUser} className="w-full">
                        {isCreatingUser ? <Loader2 className="animate-spin" /> : "User Account Created & Wallet Ready"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
