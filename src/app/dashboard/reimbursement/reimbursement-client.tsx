
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUser, useFirestore, addDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { ReimbursementRequest, User } from '@/lib/types';
import { groceryReimbursementSummarization } from '@/ai/flows/grocery-reimbursement-summarization';
import { collection, query, orderBy, Timestamp } from 'firebase/firestore';
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
} from "@/components/ui/dialog";
import { Skeleton } from '@/components/ui/skeleton';


export default function ReimbursementClient() {
    const { user } = useUser();
    const firestore = useFirestore();
    const storage = getStorage();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [paymentFile, setPaymentFile] = useState<File | null>(null);

    const reimbursementsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "reimbursements"), orderBy("submittedAt", "desc"));
    }, [firestore]);

    const { data: reimbursements, isLoading: isLoadingReimbursements } = useCollection<ReimbursementRequest>(reimbursementsQuery);
    
    const roommatesCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'roommates') : null, [firestore]);
    const { data: allRoommates, isLoading: areRoommatesLoading } = useCollection<User & {id: string}>(roommatesCollectionRef);

    const roommatesMap = useMemo(() => {
        if (!allRoommates) return new Map();
        return new Map(allRoommates.map(r => [r.id, r.name || r.displayName || 'Unknown']));
    }, [allRoommates]);

    const reimbursementSummary = useMemo(() => {
        if (!reimbursements) return [];
    
        const summary = new Map<string, number>();
        reimbursements.forEach(req => {
            const currentTotal = summary.get(req.roommateId) || 0;
            summary.set(req.roommateId, currentTotal + req.amount);
        });
    
        return Array.from(summary.entries()).map(([roommateId, totalAmount]) => ({
            roommateId,
            roommateName: roommatesMap.get(roommateId) || 'Unknown',
            totalAmount,
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
            const receiptDataUri = receiptFile ? await fileToDataUri(receiptFile) : undefined;
            const paymentScreenshotDataUri = paymentFile ? await fileToDataUri(paymentFile) : undefined;
            
            const aiResult = await groceryReimbursementSummarization({
                receiptDataUri,
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
            
            if (receiptDataUri && receiptFile) {
                const receiptRef = ref(storage, `reimbursements/${user.uid}/${Date.now()}_receipt`);
                const receiptUrl = await getDownloadURL(await uploadString(receiptRef, receiptDataUri, 'data_url'));
                newRequest.receiptUrl = receiptUrl;
            }

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
            setReceiptFile(null);
            setPaymentFile(null);
            (document.getElementById('reimbursement-form') as HTMLFormElement)?.reset();

        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Failed to submit request. Please try again.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
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
                    <CardDescription>Upload your receipt and payment details for AI-powered analysis.</CardDescription>
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
                        <Label htmlFor="receipt">Receipt Photo</Label>
                        <Input id="receipt" type="file" accept="image/*" onChange={e => setReceiptFile(e.target.files?.[0] || null)} />
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
                        <CardDescription>Total amounts requested by each roommate.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead className="text-right">Total Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={2} className="h-24 text-center">
                                            <Skeleton className="h-8 w-full" />
                                        </TableCell>
                                    </TableRow>
                                ) : reimbursementSummary.map(summary => (
                                    <TableRow key={summary.roommateId}>
                                        <TableCell className="font-medium">{summary.roommateName}</TableCell>
                                        <TableCell className="text-right">₹{summary.totalAmount.toFixed(2)}</TableCell>
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
                                    <TableHead className="text-right">Details</TableHead>
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
                                        <TableCell className="text-right">
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
                                                        {req.receiptUrl && (
                                                            <div>
                                                                <Label>Receipt</Label>
                                                                <Image src={req.receiptUrl} alt="Receipt" width={250} height={400} className="rounded-md object-cover" />
                                                            </div>
                                                        )}
                                                        {req.paymentUrl && (
                                                            <div>
                                                                <Label>Payment</Label>
                                                                <Image src={req.paymentUrl} alt="Payment" width={250} height={400} className="rounded-md object-cover" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {(user as User)?.isAdmin && req.status === 'pending' && (
                                                        <div className="flex gap-2 justify-end">
                                                            <Button variant="destructive" size="sm" disabled>Reject</Button>

                                                            <Button size="sm" disabled>Approve</Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </DialogContent>
                                        </Dialog>
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
