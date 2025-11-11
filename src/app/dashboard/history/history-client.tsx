"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HistoryFilters, useHistoryFilters, createDefaultFilters, type FilterState } from '@/components/history-filters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { ReimbursementRequest, User } from '@/lib/types';
import { formatINR } from '@/lib/utils';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Trash2, ArrowLeft, TrendingUp, Users, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
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
import { Label } from '@/components/ui/label';

export default function HistoryPageClient() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    // Filter state
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
        if (!filteredReimbursements.length) return { pending: 0, approved: 0, rejected: 0, total: 0, count: 0 };
        
        const stats = filteredReimbursements.reduce((acc, req) => {
            acc[req.status] = (acc[req.status] || 0) + req.amount;
            acc.total += req.amount;
            return acc;
        }, { pending: 0, approved: 0, rejected: 0, total: 0, count: filteredReimbursements.length });

        stats.count = filteredReimbursements.length;
        return stats;
    }, [filteredReimbursements]);

    // Overall stats (unfiltered)
    const overallStats = useMemo(() => {
        if (!reimbursements?.length) return { pending: 0, approved: 0, rejected: 0, total: 0, count: 0 };
        
        const stats = reimbursements.reduce((acc, req) => {
            acc[req.status] = (acc[req.status] || 0) + req.amount;
            acc.total += req.amount;
            return acc;
        }, { pending: 0, approved: 0, rejected: 0, total: 0, count: reimbursements.length });

        stats.count = reimbursements.length;
        return stats;
    }, [reimbursements]);

    const handleStatusChange = async (requestId: string, newStatus: 'approved' | 'rejected') => {
        if (!firestore) return;
        
        try {
            const requestRef = doc(firestore, 'reimbursements', requestId);
            await setDocumentNonBlocking(requestRef, { status: newStatus }, { merge: true });
            toast({ title: `Request ${newStatus}`, description: `The reimbursement request has been ${newStatus}.` });
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to update request status.', variant: 'destructive' });
        }
    };

    const handleDelete = async (requestId: string) => {
        if (!firestore) return;
        
        try {
            const requestRef = doc(firestore, 'reimbursements', requestId);
            await deleteDocumentNonBlocking(requestRef);
            toast({ title: 'Deleted', description: 'The reimbursement request has been deleted.' });
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to delete request.', variant: 'destructive' });
        }
    };

    const formatDate = (timestamp: any) => {
        if (timestamp && typeof timestamp.toDate === 'function') {
            return format(timestamp.toDate(), 'PP');
        }
        return 'Invalid date';
    };

    const formatDialogDate = (timestamp: any) => {
        if (timestamp && typeof timestamp.toDate === 'function') {
            return format(timestamp.toDate(), 'PPp');
        }
        return 'Invalid date';
    };

    const isLoading = isLoadingReimbursements || areRoommatesLoading;

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto p-6 max-w-7xl">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/dashboard/reimbursement">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold">Reimbursement History</h1>
                        <p className="text-muted-foreground">Complete history of all reimbursement requests with advanced filtering</p>
                    </div>
                </div>

                {/* Overview Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{overallStats.count}</div>
                            <p className="text-xs text-muted-foreground">
                                {filteredStats.count !== overallStats.count && (
                                    <span>Showing {filteredStats.count} filtered</span>
                                )}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatINR(overallStats.total, false)}</div>
                            <p className="text-xs text-muted-foreground">
                                {filteredStats.total !== overallStats.total && (
                                    <span>Filtered: {formatINR(filteredStats.total, false)}</span>
                                )}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-yellow-600">{formatINR(overallStats.pending, false)}</div>
                            <p className="text-xs text-muted-foreground">
                                {filteredStats.pending !== overallStats.pending && (
                                    <span>Filtered: {formatINR(filteredStats.pending, false)}</span>
                                )}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Approved Amount</CardTitle>
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{formatINR(overallStats.approved, false)}</div>
                            <p className="text-xs text-muted-foreground">
                                {filteredStats.approved !== overallStats.approved && (
                                    <span>Filtered: {formatINR(filteredStats.approved, false)}</span>
                                )}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <HistoryFilters
                    filters={filters}
                    onFiltersChange={setFilters}
                    users={usersForFilter}
                    isLoading={isLoading}
                />

                {/* History Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>All Reimbursement Requests</CardTitle>
                        <CardDescription>
                            Complete filterable history of reimbursement requests
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading && (
                                    Array.from({ length: 5 }).map((_, index) => (
                                        <TableRow key={index}>
                                            <TableCell colSpan={6} className="h-12">
                                                <Skeleton className="h-8 w-full" />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                                {!isLoading && filteredReimbursements.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            {reimbursements?.length === 0 ? "No reimbursement requests found." : "No requests match your current filters."}
                                        </TableCell>
                                    </TableRow>
                                )}
                                {filteredReimbursements.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell>
                                            <div className="font-medium">
                                                {roommatesMap.get(req.roommateId) || 'Unknown'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-[200px] truncate" title={req.description}>
                                                {req.description}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{formatINR(req.amount)}</TableCell>
                                        <TableCell className="hidden sm:table-cell">{formatDate(req.submittedAt)}</TableCell>
                                        <TableCell>
                                            <Badge variant={req.status === 'pending' ? 'secondary' : req.status === 'approved' ? 'default' : 'destructive'}>
                                                {req.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
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
                                                                    <div className="mt-2">
                                                                        <Image 
                                                                            src={req.paymentUrl} 
                                                                            alt="Payment" 
                                                                            width={300} 
                                                                            height={400} 
                                                                            className="rounded-md object-cover" 
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {(user as User)?.isAdmin && req.status === 'pending' && (
                                                                <DialogFooter>
                                                                    <DialogClose asChild>
                                                                        <Button 
                                                                            variant="destructive" 
                                                                            size="sm" 
                                                                            onClick={() => handleStatusChange(req.id, 'rejected')}
                                                                        >
                                                                            Reject
                                                                        </Button>
                                                                    </DialogClose>
                                                                    <DialogClose asChild>
                                                                        <Button 
                                                                            size="sm" 
                                                                            onClick={() => handleStatusChange(req.id, 'approved')}
                                                                        >
                                                                            Approve
                                                                        </Button>
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
                                            </div>
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