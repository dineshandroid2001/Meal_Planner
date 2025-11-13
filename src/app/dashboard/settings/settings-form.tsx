
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { MonthlyPlan, User, ReimbursementRequest } from '@/lib/types';
import { useUser, useFirestore, setDocumentNonBlocking, useDoc, useMemoFirebase, useCollection, deleteDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { doc, collection, getDocs, query } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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


export default function SettingsForm() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [expense, setExpense] = useState<string | number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newAdminId, setNewAdminId] = useState<string | null>(null);

    const today = new Date();
    const monthId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const planDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'monthlyPlans', monthId) : null, [firestore, monthId]);
    const { data: monthlyPlan, isLoading: isPlanLoading } = useDoc<MonthlyPlan>(planDocRef);
    
    const roommatesCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'roommates') : null, [firestore]);
    const { data: allRoommates, isLoading: areRoommatesLoading } = useCollection<User & {id: string}>(roommatesCollectionRef);

    const reimbursementsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "reimbursements")) : null, [firestore]);
    const { data: reimbursements, isLoading: areReimbursementsLoading } = useCollection<ReimbursementRequest>(reimbursementsQuery);

    const hasPendingReimbursements = useMemo(() => {
        if (!reimbursements) return false;
        return reimbursements.some(r => r.status === 'pending');
    }, [reimbursements]);

    const nonAdminRoommates = useMemo(() => {
        if (!allRoommates || !user) return [];
        return allRoommates.filter(r => r.id !== user.uid && !r.isAdmin);
    }, [allRoommates, user]);

    useEffect(() => {
        if (user && !(user as User).isAdmin) {
            toast({ title: "Access Denied", description: "You are not an admin.", variant: "destructive" });
            router.push('/dashboard');
        }
    }, [user, router, toast]);

    useEffect(() => {
        if (monthlyPlan) {
            setExpense(monthlyPlan.monthlyExpense || 0);
        } else {
            setExpense(0);
        }
    }, [monthlyPlan]);

    const handleSave = async () => {
        if (!user || !(user as User).isAdmin || !firestore) return;
        setIsSubmitting(true);
        try {
            const planDocRef = doc(firestore, 'monthlyPlans', monthId);
            
            const expenseValue = typeof expense === 'string' ? parseFloat(expense) : expense;

            const newPlanData = {
                id: monthId,
                adminId: user.uid,
                monthlyExpense: isNaN(expenseValue) ? 0 : expenseValue,
                lastUpdatedAt: new Date(),
                lastUpdatedBy: user.displayName || user.email || 'Unknown User',
            };

            setDocumentNonBlocking(planDocRef, newPlanData, { merge: true });

            toast({ title: "Success", description: "Monthly expense updated." });
            router.refresh();
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to update settings.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAdminTransfer = async () => {
        if (!user || !firestore || !newAdminId) {
            toast({ title: "Error", description: "No new admin selected or user not authenticated.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        
        try {
            const currentAdminRef = doc(firestore, 'roommates', user.uid);
            const newAdminRef = doc(firestore, 'roommates', newAdminId);
            const appConfigRef = doc(firestore, 'app-config', 'admin');

            // 1. Promote new admin
            setDocumentNonBlocking(newAdminRef, { isAdmin: true }, { merge: true });

            // 2. Update the global admin config
            setDocumentNonBlocking(appConfigRef, { uid: newAdminId }, { merge: true });

            // 3. Demote current admin
            setDocumentNonBlocking(currentAdminRef, { isAdmin: false }, { merge: true });
            
            toast({ title: "Admin Role Transferred", description: "The new admin has been appointed." });
            router.push('/dashboard');
            router.refresh();

        } catch (error) {
            console.error("Failed to transfer admin role:", error);
            toast({ title: "Error", description: "Failed to transfer admin role. Please try again.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetMonth = async () => {
        if (!firestore) {
            toast({ title: "Error", description: "Database not available.", variant: "destructive" });
            return;
        }

        if (hasPendingReimbursements) {
            toast({ title: "Action Blocked", description: "Please resolve all pending reimbursements before resetting.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        toast({ title: "Resetting...", description: "Please wait while the data is being reset." });

        try {
            // 1. Delete all reimbursements
            const reimbursementsQueryRef = query(collection(firestore, 'reimbursements'));
            const reimbursementsSnapshot = await getDocs(reimbursementsQueryRef);
            reimbursementsSnapshot.forEach(doc => {
                deleteDocumentNonBlocking(doc.ref);
            });

            // 2. Reset all participations for the current month
            const participationsQueryRef = query(collection(firestore, `monthlyPlans/${monthId}/participations`));
            const participationsSnapshot = await getDocs(participationsQueryRef);
            participationsSnapshot.forEach(doc => {
                setDocumentNonBlocking(doc.ref, { days: 0, isPaid: false }, { merge: true });
            });

            toast({ title: "Success", description: "All reimbursements have been deleted and participation has been reset." });

        } catch (error) {
            console.error("Failed to reset month data:", error);
            toast({ title: "Error", description: "Failed to reset data. Please try again.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const isLoading = isPlanLoading || areRoommatesLoading || areReimbursementsLoading;

    if (isLoading) {
        return <Skeleton className="h-48 w-full" />;
    }

    if (!(user as User)?.isAdmin) {
        return <p>You do not have permission to view this page.</p>;
    }

    return (
        <div className="grid gap-6 max-w-md">
            {/* Monthly Expense Setting */}
            <div className="grid gap-3">
                <Label htmlFor="monthly-expense" className="text-sm font-medium">Monthly Food Expense (Rs)</Label>
                <Input
                    id="monthly-expense"
                    type="number"
                    step="0.01"
                    className="w-full h-11"
                    value={expense}
                    onChange={(e) => setExpense(e.target.value)}
                    placeholder="Enter monthly expense amount"
                />
                <p className="text-sm text-muted-foreground">
                    This amount will be used to calculate the cost per person based on their participation.
                </p>
            </div>
            <Button onClick={handleSave} disabled={isSubmitting} className="w-full h-11">
                {isSubmitting ? 'Saving...' : 'Save Settings'}
            </Button>
            
            <Separator className="my-4" />

            {/* Admin Transfer Section */}
            <div className="grid gap-3">
                <h3 className="text-lg font-medium">Transfer Admin Role</h3>
                <p className="text-sm text-muted-foreground">
                    Select a roommate to transfer your admin responsibilities to. This action is irreversible and you will lose your admin privileges.
                </p>
                <div className="grid gap-3">
                    <Label htmlFor="new-admin" className="text-sm font-medium">New Administrator</Label>
                    <Select onValueChange={setNewAdminId} value={newAdminId ?? undefined}>
                        <SelectTrigger id="new-admin" className="h-11">
                            <SelectValue placeholder="Select a roommate" />
                        </SelectTrigger>
                        <SelectContent>
                            {nonAdminRoommates.map(roommate => (
                                <SelectItem key={roommate.id} value={roommate.id}>
                                    {roommate.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="destructive"
                            disabled={!newAdminId || isSubmitting}
                            className="w-full h-11"
                        >
                            {isSubmitting ? 'Transferring...' : 'Transfer Admin Role'}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. You will lose your admin privileges, and the selected roommate will become the new administrator.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleAdminTransfer}>
                                Yes, Transfer Role
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>

            <Separator className="my-4" />
            
            {/* Reset Data Section */}
            <div className="grid gap-3">
                <h3 className="text-lg font-medium">Reset Month Data</h3>
                <p className="text-sm text-muted-foreground">
                    This will delete all reimbursement requests for the current month and reset every member's participation days to zero. This action cannot be undone.
                </p>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="destructive"
                            disabled={isSubmitting || hasPendingReimbursements}
                            className="w-full h-11"
                        >
                            {isSubmitting ? 'Resetting...' : 'Reset All Month Data'}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure you want to reset all data for this month?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete all reimbursement requests and reset all participation days to 0. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleResetMonth}>
                                Yes, Reset Data
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                {hasPendingReimbursements && (
                    <p className="text-sm text-destructive font-medium">
                        You cannot reset the month because there are pending reimbursement requests. Please approve or reject them first.
                    </p>
                )}
            </div>
        </div>
    );
}
