
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUser, useFirestore, addDocumentNonBlocking, useCollection, useMemoFirebase, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { ReimbursementRequest, User } from '@/lib/types';
import { groceryReimbursementSummarization } from '@/ai/flows/grocery-reimbursement-summarization';
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
  DialogFooter,
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
        toast({ title: 'Submitting...', description: 'Analyzing your request with AI. This may take a moment.' });
        
        try {
            const paymentScreenshotDataUri = paymentFile ? await fileToDataUri(paymentFile) : undefined;
            
            const aiResult = await groceryReimbursementSummarization({
                paymentScreenshotDataUri,
                expectedTotalAmount: parseFloat(amount),
                description,
            });

            const newRequest: Partial<ReimbursementRequest> = {
                roommateId: user.uid,
                userName: (user as User).name || user.displayName || 'Unknown',
                amount: parseFloat(amount),
                description,
                status: 'pending',
                submittedAt: new Date(),
                aiSummary: aiResult.summary,
                aiAlignment: aiResult.alignment,
                aiDiscrepancies: aiResult.flaggedDiscrepancies,
            };
            

            if (paymentScreenshotDataUri && paymentFile) {
                const paymentRef = ref(storage, `reimbursements/${user.uid}/${Date.now()}_payment`);
                const paymentUrl = await getDownloadURL(await uploadString(paymentRef, paymentScreenshotDataUri, 'data_url'));
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
                        <Label htmlFor="amount">Total Amount (₹)</Label>
                        <Input id="amount" type="number" placeholder="1250.00" value={amount} onChange={e => setAmount(e.target.value)} required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="payment">Payment Screenshot</Label>
                        <Input id="payment" type="file" accept="image/*" onChange={e => setPaymentFile(e.target.files?.[0] || null)} />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isSubmitting}>
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
                                        <TableCell className="text-right">₹{summary.pending.toFixed(2)}</TableCell>
                                        <TableCell className="text-right">₹{summary.approved.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Reimbursement History</CardTitle>
                        <CardDescription>View the status of all reimbursement requests.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Date</TableHead>
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
                                {reimbursements?.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell>{roommatesMap.get(req.roommateId) || 'Unknown'}</TableCell>
                                        <TableCell>₹{req.amount.toFixed(2)}</TableCell>
                                        <TableCell>{formatDate(req.submittedAt)}</TableCell>
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
                                                    <div className="font-semibold">AI Analysis</div>
                                                    <div className="text-sm p-3 bg-muted/50 rounded-lg space-y-2">
                                                        <p><strong>Summary:</strong> {req.aiSummary}</p>
                                                        <p><strong>Alignment:</strong> {req.aiAlignment}</p>
                                                        <p><strong>Discrepancies:</strong> {req.aiDiscrepancies || 'None'}</p>
                                                    </div>
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

    
