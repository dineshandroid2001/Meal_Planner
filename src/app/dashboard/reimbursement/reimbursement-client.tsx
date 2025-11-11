"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { ReimbursementRequest } from '@/lib/types';
import { groceryReimbursementSummarization } from '@/ai/flows/grocery-reimbursement-summarization';
import { addDoc, collection } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
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
} from "@/components/ui/dialog"


type ReimbursementClientProps = {
    initialReimbursements: ReimbursementRequest[];
};

export default function ReimbursementClient({ initialReimbursements }: ReimbursementClientProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reimbursements, setReimbursements] = useState(initialReimbursements);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [paymentFile, setPaymentFile] = useState<File | null>(null);

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
        if (!user || !receiptFile || !paymentFile || !description || !amount) {
            toast({ title: 'Missing fields', description: 'Please fill out all fields and upload both images.', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        toast({ title: 'Submitting...', description: 'Analyzing your request with AI. This may take a moment.' });
        
        try {
            const receiptDataUri = await fileToDataUri(receiptFile);
            const paymentScreenshotDataUri = await fileToDataUri(paymentFile);
            
            const aiResult = await groceryReimbursementSummarization({
                receiptDataUri,
                paymentScreenshotDataUri,
                expectedTotalAmount: parseFloat(amount),
                description,
            });

            // Upload images to Firebase Storage
            const timestamp = Date.now();
            const receiptRef = ref(storage, `reimbursements/${user.uid}/${timestamp}_receipt`);
            const paymentRef = ref(storage, `reimbursements/${user.uid}/${timestamp}_payment`);

            await uploadString(receiptRef, receiptDataUri, 'data_url');
            await uploadString(paymentRef, paymentScreenshotDataUri, 'data_url');

            const receiptUrl = await getDownloadURL(receiptRef);
            const paymentUrl = await getDownloadURL(paymentRef);
            
            const newRequest: Omit<ReimbursementRequest, 'id'> = {
                userId: user.uid,
                userName: user.displayName || 'Unknown',
                amount: parseFloat(amount),
                description,
                receiptUrl,
                paymentUrl,
                status: 'pending',
                submittedAt: new Date(),
                aiSummary: aiResult.summary,
                aiAlignment: aiResult.alignment,
                aiDiscrepancies: aiResult.flaggedDiscrepancies,
            };

            const docRef = await addDoc(collection(db, 'reimbursements'), newRequest);
            setReimbursements(prev => [{ id: docRef.id, ...newRequest }, ...prev]);
            
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
                        <Input id="receipt" type="file" accept="image/*" onChange={e => setReceiptFile(e.target.files?.[0] || null)} required/>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="payment">Payment Screenshot</Label>
                        <Input id="payment" type="file" accept="image/*" onChange={e => setPaymentFile(e.target.files?.[0] || null)} required/>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Submitting...' : 'Submit Request'}
                    </Button>
                </CardFooter>
                </form>
            </Card>

            <Card className="lg:col-span-4">
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
                            {reimbursements.map(req => (
                                <TableRow key={req.id}>
                                    <TableCell>{req.userName}</TableCell>
                                    <TableCell>₹{req.amount.toFixed(2)}</TableCell>
                                    <TableCell>{format(new Date(req.submittedAt), 'PP')}</TableCell>
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
                                                Submitted by {req.userName} on {format(new Date(req.submittedAt), 'PPp')}
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
                                                    <div>
                                                        <Label>Receipt</Label>
                                                        <Image src={req.receiptUrl || "https://picsum.photos/seed/receipt/400/600"} alt="Receipt" width={250} height={400} className="rounded-md object-cover" />
                                                    </div>
                                                    <div>
                                                        <Label>Payment</Label>
                                                        <Image src={req.paymentUrl || "https://picsum.photos/seed/payment/400/600"} alt="Payment" width={250} height={400} className="rounded-md object-cover" />
                                                    </div>
                                                </div>
                                                {user?.isAdmin && req.status === 'pending' && (
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
    );
}
