
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const mockUsers = [
    { id: '1', address: '0x1234...5678', joinDate: '2024-05-20', totalValue: 12500.50 },
    { id: '2', address: '0xABCD...EFGH', joinDate: '2024-05-18', totalValue: 8200.00 },
    { id: '3', address: '0x9876...5432', joinDate: '2024-05-15', totalValue: 35000.75 },
    { id: '4', address: '0xWXYZ...IJKL', joinDate: '2024-05-12', totalValue: 500.00 },
];


export default function UserManagementPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<(typeof mockUsers)[0] | null>(null);

    const filteredUsers = mockUsers.filter(user => 
        user.address.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSendClick = (user: (typeof mockUsers)[0]) => {
        setSelectedUser(user);
        setIsSendDialogOpen(true);
    }
    
  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold">User Management</h1>
                <p className="text-muted-foreground">Monitor and manage all application users.</p>
            </div>
             <Button>
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
                        {filteredUsers.map(user => (
                            <TableRow key={user.id}>
                                <TableCell className="font-mono">{user.address}</TableCell>
                                <TableCell>${user.totalValue.toLocaleString()}</TableCell>
                                <TableCell>{user.joinDate}</TableCell>
                                <TableCell className="text-right">
                                     <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Open menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleSendClick(user)}>
                                                <Send className="mr-2 h-4 w-4" />
                                                <span>Send Crypto</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
            <DialogContent>
                 <DialogHeader>
                    <DialogTitle>Send Crypto to User</DialogTitle>
                    <DialogDescription>
                        Send any amount of a selected cryptocurrency directly to {selectedUser?.address}.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {/* Send Crypto Form will go here */}
                    <p>Form to send crypto will be implemented here.</p>
                </div>
                 <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button>Confirm & Send</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
