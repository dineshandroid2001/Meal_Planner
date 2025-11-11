'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Users, CreditCard } from 'lucide-react';
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

    const totalAllocatedCost = useMemo(() => {
        if (!participantsData || !monthlyPlan) return 0;
        const costPerDay = (monthlyPlan.monthlyExpense || 0) / 30;
        return participantsData.reduce((acc, p) => acc + (p.days * costPerDay), 0);
    }, [participantsData, monthlyPlan]);
    
    const totalReimbursements = useMemo(() => {
        if (!reimbursementsData) return 0;
        return reimbursementsData.reduce((acc, r) => acc + r.amount, 0);
    }, [reimbursementsData]);

    const isLoading = isPlanLoading || areParticipantsLoading || areReimbursementsLoading;

    if (isLoading) {
        return (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
            </div>
        )
    }


    return (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Monthly Expense</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{monthlyPlan?.monthlyExpense?.toFixed(2) ?? '0.00'}</div>
                    <p className="text-xs text-muted-foreground">The total budget for the current month.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Allocated Cost</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{totalAllocatedCost.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">Sum of costs based on participation.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Reimbursements</CardTitle>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{totalReimbursements.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">Total amount requested for reimbursement.</p>
                </CardContent>
            </Card>
        </div>
    );
}
