
"use client";

import React, { useState, useEffect } from 'react';
import type { MonthlyPlan, User } from '@/lib/types';
import { useUser, useFirestore, setDocumentNonBlocking, useDoc, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';


export default function SettingsForm() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [expense, setExpense] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const today = new Date();
    const monthId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const planDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'monthlyPlans', monthId) : null, [firestore, monthId]);
    const { data: monthlyPlan, isLoading } = useDoc<MonthlyPlan>(planDocRef);

    useEffect(() => {
        if (user && !(user as User).isAdmin) {
            toast({ title: "Access Denied", description: "You are not an admin.", variant: "destructive" });
            router.push('/dashboard');
        }
    }, [user, router, toast]);

    useEffect(() => {
        if (monthlyPlan) {
            setExpense(monthlyPlan.monthlyExpense);
        }
    }, [monthlyPlan]);

    const handleSave = async () => {
        if (!user || !(user as User).isAdmin || !firestore) return;
        setIsSubmitting(true);
        try {
            const planDocRef = doc(firestore, 'monthlyPlans', monthId);

            const newPlanData = {
                id: monthId,
                adminId: user.uid,
                monthlyExpense: expense,
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
    
    if (isLoading) {
        return <Skeleton className="h-24 w-full" />;
    }

    if (!(user as User)?.isAdmin) {
        return <p>You do not have permission to view this page.</p>;
    }

    return (
        <div className="grid gap-6 max-w-md">
            <div className="grid gap-3">
                <Label htmlFor="monthly-expense" className="text-sm font-medium">Monthly Food Expense (₹)</Label>
                <Input
                    id="monthly-expense"
                    type="number"
                    step="0.01"
                    className="w-full h-11"
                    value={expense}
                    onChange={(e) => setExpense(Number(e.target.value))}
                    placeholder="Enter monthly expense amount"
                />
                <p className="text-sm text-muted-foreground">
                    This amount will be used to calculate the cost per person based on their participation.
                </p>
            </div>
            <Button onClick={handleSave} disabled={isSubmitting} className="w-full h-11">
                {isSubmitting ? 'Saving...' : 'Save Settings'}
            </Button>
        </div>
    );
}
