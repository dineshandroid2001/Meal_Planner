
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
    
    const roommatesCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'roommates') : null, [firestore]);
    const { data: allRoommates, isLoading: areRoommatesLoading } = useCollection<{id: string}>(roommatesCollectionRef);
    
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

    const fullMonthPerHeadAmount = useMemo(() => {
        if (!monthlyPlan) return 0;
        return monthlyPlan.monthlyExpense || 0;
    }, [monthlyPlan]);

    const totalCollectedAmount = useMemo(() => {
        if (!participantsData || !monthlyPlan || !allRoommates) return 0;
        const costPerDay = (monthlyPlan.monthlyExpense || 0) / 30;
        
        // Create a Set of valid roommate IDs for fast lookup
        const validRoommateIds = new Set(allRoommates.map(r => r.id));
        
        console.log('=== Total Collected Amount Calculation ===');
        console.log('Monthly Expense:', monthlyPlan.monthlyExpense);
        console.log('Cost Per Day:', costPerDay);
        console.log('Valid Roommate IDs:', Array.from(validRoommateIds));
        console.log('Number of participants:', participantsData.length);
        
        // Only count participants who are in the roommates collection
        const total = participantsData
            .filter(p => {
                const isValid = p.id && validRoommateIds.has(p.id) && p.days !== undefined && p.days !== null;
                if (p.id && !validRoommateIds.has(p.id)) {
                    console.log(`⚠️ Skipping participant ${p.id}: Not in roommates collection`);
                }
                return isValid;
            })
            .reduce((acc, p) => {
                const cost = p.days * costPerDay;
                console.log(`✓ Participant ${p.id}: ${p.days} days × Rs ${costPerDay.toFixed(2)} = Rs ${cost.toFixed(2)}`);
                return acc + cost;
            }, 0);
            
        console.log('Total Collected:', total);
        console.log('===========================================');
        
        return total;
    }, [participantsData, monthlyPlan, allRoommates]);

    const balance = useMemo(() => {
        return totalCollectedAmount - totalApprovedReimbursements;
    }, [totalCollectedAmount, totalApprovedReimbursements]);
    
    const isLoading = isPlanLoading || areParticipantsLoading || areReimbursementsLoading || areRoommatesLoading;

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
                    <CardTitle className="text-sm font-medium">Full Month Per-Head Amount</CardTitle>
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Rs {fullMonthPerHeadAmount.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Monthly expense set by admin.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium">Total Collected Amount</CardTitle>
                    <Users className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Rs {totalCollectedAmount.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Sum of all participants' costs.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium">Gross Reimbursements (Approved)</CardTitle>
                    <CheckCircle className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Rs {totalApprovedReimbursements.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Total of approved reimbursements.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium">Balance</CardTitle>
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Rs {balance.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Total Collected − Reimbursements.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium">Pending Reimbursements</CardTitle>
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Rs {totalPendingReimbursements.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Requests pending for approval.</p>
                </CardContent>
            </Card>
        </div>
    );
}
