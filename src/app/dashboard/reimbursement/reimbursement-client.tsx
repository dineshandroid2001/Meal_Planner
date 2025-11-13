
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { CheckCircle, Trash2, Edit, X as XIcon } from 'lucide-react';
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
import { useIsMobile } from '@/hooks/use-mobile';


export default function ReimbursementClient() {
    const { user } = useUser();
    const firestore = useFirestore();
    const storage = useMemo(() => firestore ? getStorage() : null, [firestore]);
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [paymentFile, setPaymentFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [editingRequest, setEditingRequest] = useState<(ReimbursementRequest & { id: string }) | null>(null);
    const [editDescription, setEditDescription] = useState('');
    const [editAmount, setEditAmount] = useState('');
    
    // Filter state for history
    const [filters, setFilters] = useState<FilterState>(createDefaultFilters());

    const isMobile = useIsMobile();

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

    useEffect(() => {
        if (editingRequest) {
            setEditDescription(editingRequest.description);
            setEditAmount(String(editingRequest.amount));
        }
    }, [editingRequest]);

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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setPaymentFile(file);
    };

    const clearFileSelection = () => {
        setPaymentFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !description || !amount || !firestore) {
            toast({ title: 'Missing fields or services unavailable', description: 'Please fill out all fields.', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);

        try {
            let paymentUrl: string | undefined = undefined;

            if (paymentFile && storage) {
                toast({ title: 'Uploading...', description: 'Your receipt is being uploaded.' });
                const paymentScreenshotDataUri = await fileToDataUri(paymentFile);
                const paymentRef = ref(storage, `reimbursements/${user.uid}/${Date.now()}_${paymentFile.name}`);
                await uploadString(paymentRef, paymentScreenshotDataUri, 'data_url');
                paymentUrl = await getDownloadURL(paymentRef);
                toast({ title: 'Upload Complete', description: 'Your receipt has been uploaded successfully.' });
            }

            toast({ title: 'Submitting...', description: 'Saving your reimbursement request.' });

            const newRequest: Partial<ReimbursementRequest> = {
                roommateId: user.uid,
                userName: (user as User).name || user.displayName || 'Unknown',
                amount: parseFloat(amount),
                description,
                status: 'pending',
                submittedAt: new Date(),
            };

            if (paymentUrl) {
                newRequest.paymentUrl = paymentUrl;
            }

            await addDocumentNonBlocking(collection(firestore, 'reimbursements'), newRequest);

            toast({ title: 'Success!', description: 'Your reimbursement request has been submitted.' });

            // Reset form
            setDescription('');
            setAmount('');
            clearFileSelection();

        } catch (error) {
            console.error("Submission error:", error);
            toast({ title: 'Error', description: 'Failed to submit request. Please try again.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRequest || !firestore) return;

        setIsSubmitting(true);
        const docRef = doc(firestore, 'reimbursements', editingRequest.id);
        const updatedData = {
            description: editDescription,
            amount: parseFloat(editAmount),
        };
        await setDocumentNonBlocking(docRef, updatedData, { merge: true });

        setIsSubmitting(false);
        setEditingRequest(null);
        toast({ title: 'Success', description: 'Reimbursement request updated.' });
    };
    
    const handleDelete = (reimbursementId: string) => {
        if (!firestore) return;

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

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'No date';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return format(date, 'PP');
    };
    
    const formatDialogDate = (timestamp: any) => {
        if (!timestamp) return 'No date';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return format(date, 'PPp');
    };

    const isLoading = isLoadingReimbursements || areRoommatesLoading;
    
    const canDelete = (req: ReimbursementRequest) => {
        if (!user) return false;
        if ((user as User)?.isAdmin) {
          return req.status !== 'approved';
        }
        if (user.uid === req.roommateId) {
          return req.status === 'pending';
        }
        return false;
      };

    const canEdit = (req: ReimbursementRequest) => {
        if (!user) return false;
        return user.uid === req.roommateId && req.status === 'pending';
    }
    
    return (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-7">
            <Card className="md:col-span-3">
                <CardHeader>
                    <CardTitle className="text-lg">Submit Reimbursement</CardTitle>
                    <CardDescription>Upload your payment details for submission.</CardDescription>
                </CardHeader>
                <form id="reimbursement-form" onSubmit={handleSubmit}>
                <CardContent className="grid gap-4">
                    <div className="grid gap-3">
                        <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                        <Textarea 
                            id="description" 
                            placeholder="e.g., Weekly groceries" 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            required 
                            className="min-h-[80px] resize-none"
                        />
                    </div>
                    <div className="grid gap-3">
                        <Label htmlFor="amount" className="text-sm font-medium">Total Amount (Rs)</Label>
                        <Input 
                            id="amount" 
                            type="number" 
                            step="0.01"
                            placeholder="1250.00" 
                            value={amount} 
                            onChange={e => setAmount(e.target.value)} 
                            required 
                            className="h-11"
                        />
                    </div>
                    <div className="grid gap-3">
                        <Label htmlFor="payment" className="text-sm font-medium">Payment Screenshot</Label>
                        <Input 
                            id="payment" 
                            ref={fileInputRef}
                            type="file" 
                            accept="image/*" 
                            onChange={handleFileChange}
                            className="h-11 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                        />
                         {paymentFile && (
                            <div className="flex items-center justify-between p-2 mt-2 text-sm rounded-md border border-muted bg-muted/50">
                                <span className="truncate pr-2">{paymentFile.name}</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={clearFileSelection}
                                    className="h-6 w-6"
                                >
                                    <XIcon className="h-4 w-4" />
                                    <span className="sr-only">Remove file</span>
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isSubmitting} className="w-full h-11">
                        {isSubmitting ? 'Submitting...' : 'Submit Request'}
                    </Button>
                </CardFooter>
                </form>
            </Card>

            <div className="md:col-span-4 grid gap-4 auto-rows-max">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Reimbursement Summary</CardTitle>
                        <CardDescription>Total pending and approved amounts for each roommate.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <ScrollArea className={isMobile ? "h-[150px]" : "h-auto"}>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="sticky top-0 bg-background">User</TableHead>
                                            <TableHead className="text-right sticky top-0 bg-background">Pending</TableHead>
                                            <TableHead className="text-right sticky top-0 bg-background">
                                                <div className="flex items-center justify-end gap-2">
                                                    Approved
                                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                                </div>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={3}>
                                                    <Skeleton className="h-8 w-full" />
                                                </TableCell>
                                            </TableRow>
                                        ) : reimbursementSummary.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                                    No reimbursement requests found.
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
                            </ScrollArea>
                        </div>
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
                            <Link href="/dashboard/history" passHref>
                                <Button variant="outline" size="sm" asChild={isMobile}>
                                    <a>{isMobile ? "All" : "View All History"}</a>
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
                        
                        {isLoading && (
                            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full mb-2" />)
                        )}
                        {!isLoading && filteredReimbursements.length === 0 && (
                            <div className="h-24 flex items-center justify-center text-center text-muted-foreground">
                                {reimbursements?.length === 0 ? "No reimbursement requests found." : "No requests match your current filters."}
                            </div>
                        )}

                        {!isLoading && (isMobile ? (
                            <div className="grid gap-3">
                                {filteredReimbursements.map(req => (
                                    <Card key={req.id} className="w-full">
                                        <CardHeader className="p-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="font-semibold">{roommatesMap.get(req.roommateId) || 'Unknown'}</p>
                                                    <p className="text-sm text-muted-foreground">{formatDate(req.submittedAt)}</p>
                                                </div>
                                                <Badge variant={req.status === 'pending' ? 'secondary' : req.status === 'approved' ? 'default' : 'destructive'}>
                                                    {req.status}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0">
                                            <p className="text-lg font-bold mb-2">{formatINR(req.amount)}</p>
                                            <p className="text-sm text-muted-foreground truncate">{req.description}</p>
                                        </CardContent>
                                        <CardFooter className="p-4 flex gap-2">
                                            <Dialog>
                                                <DialogTrigger asChild><Button variant="outline" size="sm" className="flex-1">View</Button></DialogTrigger>
                                                {/* DialogContent shared below */}
                                            </Dialog>
                                            {canEdit(req) && (
                                                <Dialog open={editingRequest?.id === req.id} onOpenChange={(isOpen) => !isOpen && setEditingRequest(null)}>
                                                    <DialogTrigger asChild><Button variant="outline" size="icon"><Edit className="h-4 w-4" /></Button></DialogTrigger>
                                                    {/* DialogContent shared below */}
                                                </Dialog>
                                            )}
                                            {canDelete(req) && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(req.id)}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </CardFooter>
                                    </Card>
                                ))}
                            </div>
                        ) : (
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
                                                {/* DialogContent shared below */}
                                            </Dialog>
                                            {canEdit(req) && (
                                                <Dialog open={editingRequest?.id === req.id} onOpenChange={(isOpen) => !isOpen && setEditingRequest(null)}>
                                                    <DialogTrigger asChild>
                                                        <Button variant="outline" size="icon" onClick={() => setEditingRequest(req)}>
                                                            <Edit className="h-4 w-4" />
                                                            <span className="sr-only">Edit</span>
                                                        </Button>
                                                    </DialogTrigger>
                                                    {/* DialogContent shared below */}
                                                </Dialog>
                                            )}
                                            {canDelete(req) && (
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
                        ))}

                        {/* Shared Dialog Content for View */}
                        {filteredReimbursements.map(req => (
                            <Dialog key={`view-${req.id}`} onOpenChange={(open) => !open && setEditingRequest(null)}>
                                <DialogContent className="sm:max-w-[600px]">
                                    <DialogHeader>
                                    <DialogTitle>Reimbursement Details</DialogTitle>
                                    <DialogDescription>
                                        Submitted by {roommatesMap.get(req.roommateId) || 'Unknown'} on {formatDialogDate(req.submittedAt)}
                                    </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div>
                                            <Label className="font-semibold">Description</Label>
                                            <p className="text-sm text-muted-foreground mt-1">{req.description}</p>
                                        </div>
                                        <div>
                                            <Label className="font-semibold">Amount</Label>
                                            <p className="text-sm text-muted-foreground mt-1">{formatINR(req.amount)}</p>
                                        </div>
                                        {req.paymentUrl && (
                                            <div>
                                                <Label className="font-semibold">Payment Screenshot</Label>
                                                <div className="mt-2 relative">
                                                    <Image 
                                                        src={req.paymentUrl} 
                                                        alt="Payment" 
                                                        width={300} 
                                                        height={400} 
                                                        className="rounded-md object-contain mx-auto" 
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        {(user as User)?.isAdmin && req.status === 'pending' && (
                                             <DialogFooter className="gap-2 flex-col sm:flex-row">
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
                        ))}
                         {/* Shared Dialog Content for Edit */}
                        {editingRequest && (
                             <Dialog open={!!editingRequest} onOpenChange={(isOpen) => !isOpen && setEditingRequest(null)}>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Edit Reimbursement</DialogTitle>
                                        <DialogDescription>
                                            Update the details of your reimbursement request.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleEditSubmit}>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-description">Description</Label>
                                                <Textarea id="edit-description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="edit-amount">Amount</Label>
                                                <Input id="edit-amount" type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <DialogClose asChild>
                                                <Button type="button" variant="secondary">Cancel</Button>
                                            </DialogClose>
                                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Changes'}</Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                             </Dialog>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
    

    