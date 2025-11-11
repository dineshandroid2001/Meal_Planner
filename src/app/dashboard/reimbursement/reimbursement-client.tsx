
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';
import { HistoryFilters, useHistoryFilters, createDefaultFilters, type FilterState } from '@/components/history-filters';
import { useUser, useFirestore, addDocumentNonBlocking, useCollection, useMemoFirebase, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { ReimbursementRequest, User } from '@/lib/types';
import { formatINR } from '@/lib/utils';
import { collection, query, orderBy, Timestamp, doc } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter
} from "@/components/ui/dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


export default function ReimbursementClient() {
    const { user } = useUser();
    const firestore = useFirestore();
    const storage = getStorage();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [paymentFile, setPaymentFile] = useState<File | null>(null);
    
    // Filter state for history
    const [filters, setFilters] = useState<FilterState>(createDefaultFilters());

    const reimbursementsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "reimbursements"), orderBy("submittedAt", "desc"));
    }, [firestore]);

    const { data: reimbursements, isLoading: isLoadingReimbursements } = useCollection<ReimbursementRequest & { id: string }>(reimbursementsQuery);
    
    const roommatesCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'roommates') : null, [firestore]);
    const { data: allRoommates, isLoading: areRoommatesLoading } = useCollection<User & {id: string}>(roommatesCollectionRef);

    const roommatesMap = useMemo(() => {
        if (!allRoommates) return new Map();
        return new Map(allRoommates.map(r => [r.id, r.name || r.displayName || 'Unknown']));
    }, [allRoommates]);

    // Prepare users data for filter component
    const usersForFilter = useMemo(() => {
        if (!allRoommates) return [];
        return allRoommates.map(r => ({
            id: r.id,
            name: r.name || r.displayName || 'Unknown'
        }));
    }, [allRoommates]);

    // Apply filters to reimbursements
    const filteredReimbursements = useHistoryFilters(reimbursements || undefined, filters, roommatesMap);

    // Calculate filtered stats
    const filteredStats = useMemo(() => {
        if (!filteredReimbursements.length) return { pending: 0, approved: 0, rejected: 0, total: 0 };
        
        return filteredReimbursements.reduce((acc, req) => {
            acc[req.status] = (acc[req.status] || 0) + req.amount;
            acc.total += req.amount;
            return acc;
        }, { pending: 0, approved: 0, rejected: 0, total: 0 });
    }, [filteredReimbursements]);

    const reimbursementSummary = useMemo(() => {
        if (!reimbursements) return [];

        const summary = new Map<string, { pending: number, approved: number }>();
        reimbursements.forEach(req => {
            const current = summary.get(req.roommateId) || { pending: 0, approved: 0 };
            if (req.status === 'pending') {
                current.pending += req.amount;
            } else if (req.status === 'approved') {
                current.approved += req.amount;
            }
            summary.set(req.roommateId, current);
        });

        return Array.from(summary.entries()).map(([roommateId, totals]) => ({
            roommateId,
            roommateName: roommatesMap.get(roommateId) || 'Unknown',
            ...totals
        }));
    }, [reimbursements, roommatesMap]);


    const fileToDataUri = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !description || !amount || !firestore) {
            toast({ title: 'Missing fields', description: 'Please fill out description and amount.', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        toast({ title: 'Submitting...', description: 'Processing your reimbursement request.' });
        
        try {
            const paymentScreenshotDataUri = paymentFile ? await fileToDataUri(paymentFile) : undefined;

            const newRequest: Partial<ReimbursementRequest> = {
                roommateId: user.uid,
                userName: (user as User).name || user.displayName || 'Unknown',
                amount: parseFloat(amount),
                description,
                status: 'pending',
                submittedAt: new Date(),
            };
            

            if (paymentScreenshotDataUri && paymentFile) {
                const paymentRef = ref(storage, `reimbursements/${user.uid}/${Date.now()}_payment`);
                await uploadString(paymentRef, paymentScreenshotDataUri, 'data_url');
                const paymentUrl = await getDownloadURL(paymentRef);
                newRequest.paymentUrl = paymentUrl;
            }


            await addDocumentNonBlocking(collection(firestore, 'reimbursements'), newRequest);
            
            toast({ title: 'Success!', description: 'Your reimbursement request has been submitted.' });
            // Reset form
            setDescription('');
            setAmount('');
            setPaymentFile(null);
            (document.getElementById('reimbursement-form') as HTMLFormElement)?.reset();

        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Failed to submit request. Please try again.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDelete = (reimbursementId: string) => {
        if (!firestore || !(user as User)?.isAdmin) {
            toast({ title: "Permission Denied", description: "You are not authorized to delete requests.", variant: "destructive" });
            return;
        }

        const docRef = doc(firestore, 'reimbursements', reimbursementId);
        deleteDocumentNonBlocking(docRef);
        toast({ title: "Request Deleted", description: "The reimbursement request has been removed." });
    };

    const handleStatusChange = (reimbursementId: string, status: 'approved' | 'rejected') => {
        if (!firestore || !(user as User)?.isAdmin) {
            toast({ title: "Permission Denied", description: "You are not authorized to update requests.", variant: "destructive" });
            return;
        }
        
        const docRef = doc(firestore, 'reimbursements', reimbursementId);
        setDocumentNonBlocking(docRef, { status }, { merge: true });
        toast({ title: `Request ${status}`, description: `The reimbursement request has been ${status}.` });
    };

    const formatDate = (timestamp: Timestamp) => {
        if (timestamp && typeof timestamp.toDate === 'function') {
            return format(timestamp.toDate(), 'PP');
        }
        return 'Invalid date';
    }

    const formatDialogDate = (timestamp: Timestamp) => {
        if (timestamp && typeof timestamp.toDate === 'function') {
            return format(timestamp.toDate(), 'PPp');
        }
        return 'Invalid date';
    }

    const isLoading = isLoadingReimbursements || areRoommatesLoading;

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-3">
                <CardHeader>
                    <CardTitle>Submit Reimbursement</CardTitle>
                    <CardDescription>Upload your payment details for AI-powered analysis.</CardDescription>
                </CardHeader>
                <form id="reimbursement-form" onSubmit={handleSubmit}>
                <CardContent className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" placeholder="e.g., Weekly groceries" value={description} onChange={e => setDescription(e.target.value)} required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="amount">Total Amount (INR)</Label>
                        <Input id="amount" type="number" placeholder="1250.00" value={amount} onChange={e => setAmount(e.target.value)} required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="payment">Payment Screenshot</Label>
                        <Input id="payment" type="file" accept="image/*" onChange={e => setPaymentFile(e.target.files?.[0] || null)} />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                        {isSubmitting ? 'Submitting...' : 'Submit Request'}
                    </Button>
                </CardFooter>
                </form>
            </Card>

            <div className="lg:col-span-4 grid gap-4 auto-rows-max">
                <Card>
                    <CardHeader>
                        <CardTitle>Reimbursement Summary</CardTitle>
                        <CardDescription>Total pending and approved amounts for each roommate.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead className="text-right">Pending</TableHead>
                                    <TableHead className="text-right flex items-center justify-end gap-2">
                                        Approved
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center">
                                            <Skeleton className="h-8 w-full" />
                                        </TableCell>
                                    </TableRow>
                                ) : reimbursementSummary.map(summary => (
                                    <TableRow key={summary.roommateId}>
                                        <TableCell className="font-medium">{summary.roommateName}</TableCell>
                                        <TableCell className="text-right">{formatINR(summary.pending)}</TableCell>
                                        <TableCell className="text-right">{formatINR(summary.approved)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Filters for History */}
                <HistoryFilters
                    filters={filters}
                    onFiltersChange={setFilters}
                    users={usersForFilter}
                    isLoading={isLoading}
                />

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Reimbursement History</CardTitle>
                            </div>
                            <Link href="/dashboard/history">
                                <Button variant="outline" size="sm">
                                    View All History
                                </Button>
                            </Link>
                        </div>
                        <CardDescription className="flex flex-col gap-1">
                            <span>View and filter reimbursement requests. For advanced filtering and full-page history, use the dedicated History page.</span>
                            <span className="text-sm">
                                {filteredReimbursements.length !== reimbursements?.length ? (
                                    <span className="text-orange-600 dark:text-orange-400">
                                        Showing {filteredReimbursements.length} of {reimbursements?.length || 0} requests (filtered)
                                    </span>
                                ) : (
                                    <span className="text-muted-foreground">
                                        Total: {reimbursements?.length || 0} requests
                                    </span>
                                )}
                            </span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* Filtered Stats Summary */}
                        {filteredReimbursements.length > 0 && (
                            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                                <div className="text-sm font-medium mb-2">Filtered Results Summary</div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                    <div className="text-center">
                                        <div className="text-muted-foreground">Total Amount</div>
                                        <div className="font-semibold text-sm">{formatINR(filteredStats.total)}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-muted-foreground">Pending</div>
                                        <div className="font-semibold text-sm text-yellow-600">{formatINR(filteredStats.pending)}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-muted-foreground">Approved</div>
                                        <div className="font-semibold text-sm text-green-600">{formatINR(filteredStats.approved)}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-muted-foreground">Rejected</div>
                                        <div className="font-semibold text-sm text-red-600">{formatINR(filteredStats.rejected)}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            <Skeleton className="h-8 w-full" />
                                        </TableCell>
                                    </TableRow>
                                )}
                                {!isLoading && filteredReimbursements.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            {reimbursements?.length === 0 ? "No reimbursement requests found." : "No requests match your current filters."}
                                        </TableCell>
                                    </TableRow>
                                )}
                                {filteredReimbursements.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell>{roommatesMap.get(req.roommateId) || 'Unknown'}</TableCell>
                                        <TableCell>{formatINR(req.amount)}</TableCell>
                                        <TableCell className="hidden sm:table-cell">{formatDate(req.submittedAt)}</TableCell>
                                        <TableCell>
                                            <Badge variant={req.status === 'pending' ? 'secondary' : req.status === 'approved' ? 'default' : 'destructive'}>
                                                {req.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right flex items-center justify-end gap-2">
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" size="sm">View</Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-[600px]">
                                                <DialogHeader>
                                                <DialogTitle>Reimbursement Details</DialogTitle>
                                                <DialogDescription>
                                                    Submitted by {roommatesMap.get(req.roommateId) || 'Unknown'} on {formatDialogDate(req.submittedAt)}
                                                </DialogDescription>
                                                </DialogHeader>
                                                <div className="grid gap-4 py-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {req.paymentUrl && (
                                                            <div>
                                                                <Label>Payment</Label>
                                                                <Image src={req.paymentUrl} alt="Payment" width={250} height={400} className="rounded-md object-cover" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {(user as User)?.isAdmin && req.status === 'pending' && (
                                                         <DialogFooter>
                                                             <DialogClose asChild>
                                                                <Button variant="destructive" size="sm" onClick={() => handleStatusChange(req.id, 'rejected')}>Reject</Button>
                                                             </DialogClose>
                                                             <DialogClose asChild>
                                                                <Button size="sm" onClick={() => handleStatusChange(req.id, 'approved')}>Approve</Button>
                                                             </DialogClose>
                                                        </DialogFooter>
                                                    )}
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                         {(user as User)?.isAdmin && (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="icon">
                                                        <Trash2 className="h-4 w-4" />
                                                        <span className="sr-only">Delete</span>
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This action cannot be undone. This will permanently delete the reimbursement request.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(req.id)}>Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

    
