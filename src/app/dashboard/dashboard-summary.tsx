
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Users, CreditCard, CheckCircle, TrendingUp } from 'lucide-react';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import type { MonthlyPlan, Participant, ReimbursementRequest } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardSummary() {
    const firestore = useFirestore();
    const today = new Date();
    const monthId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const planDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'monthlyPlans', monthId) : null, [firestore, monthId]);
    const { data: monthlyPlan, isLoading: isPlanLoading } = useDoc<MonthlyPlan>(planDocRef);

    const participantsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, `monthlyPlans/${monthId}/participations`) : null, [firestore, monthId]);
    const { data: participantsData, isLoading: areParticipantsLoading } = useCollection<Participant>(participantsCollectionRef);
    
    const reimbursementsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'reimbursements') : null, [firestore]);
    const { data: reimbursementsData, isLoading: areReimbursementsLoading } = useCollection<ReimbursementRequest>(reimbursementsCollectionRef);

    const { totalPendingReimbursements, totalApprovedReimbursements } = useMemo(() => {
        if (!reimbursementsData) return { totalPendingReimbursements: 0, totalApprovedReimbursements: 0 };
        return reimbursementsData.reduce((acc, r) => {
            if (r.status === 'pending') {
                acc.totalPendingReimbursements += r.amount;
            } else if (r.status === 'approved') {
                acc.totalApprovedReimbursements += r.amount;
            }
            return acc;
        }, { totalPendingReimbursements: 0, totalApprovedReimbursements: 0 });
    }, [reimbursementsData]);

    const grossAllocatedCost = useMemo(() => {
        if (!participantsData || !monthlyPlan) return 0;
        const costPerDay = (monthlyPlan.monthlyExpense || 0) / 30;
        return participantsData.reduce((acc, p) => acc + (p.days * costPerDay), 0);
    }, [participantsData, monthlyPlan]);

    const netAllocatedCost = useMemo(() => {
        return grossAllocatedCost - totalApprovedReimbursements;
    }, [grossAllocatedCost, totalApprovedReimbursements]);
    
    const isLoading = isPlanLoading || areParticipantsLoading || areReimbursementsLoading;

    if (isLoading) {
        return (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
        )
    }


    return (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium">Total Monthly Expense</CardTitle>
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{monthlyPlan?.monthlyExpense?.toFixed(2) ?? '0.00'}</div>
                    <p className="text-xs text-muted-foreground mt-1">The total budget for the current month.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium">Gross Allocated Cost</CardTitle>
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{grossAllocatedCost.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Total to be collected before reimbursements.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium">Balance to Collect</CardTitle>
                    <Users className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{netAllocatedCost.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Net cost after approved reimbursements.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium">Pending Reimbursements</CardTitle>
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{totalPendingReimbursements.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Total amount pending for reimbursement.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium">Approved Reimbursements</CardTitle>
                    <CheckCircle className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{totalApprovedReimbursements.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Total amount already reimbursed.</p>
                </CardContent>
            </Card>
        </div>
    );
}
