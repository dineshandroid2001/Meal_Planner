"use client";

import React, { useState, useEffect } from 'react';
import type { MonthlyPlan } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type SettingsFormProps = {
    monthlyPlan: MonthlyPlan;
};

export default function SettingsForm({ monthlyPlan }: SettingsFormProps) {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [expense, setExpense] = useState(monthlyPlan.monthlyExpense);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (user && !user.isAdmin) {
            toast({ title: "Access Denied", description: "You are not an admin.", variant: "destructive" });
            router.push('/dashboard');
        }
    }, [user, router, toast]);

    const handleSave = async () => {
        if (!user || !user.isAdmin) return;
        setIsSubmitting(true);
        try {
            const today = new Date();
            const monthId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            const planDocRef = doc(db, 'monthlyPlans', monthId);

            await setDoc(planDocRef, {
                monthlyExpense: expense,
                lastUpdatedAt: new Date(),
                lastUpdatedBy: user.displayName || user.email,
            }, { merge: true });

            toast({ title: "Success", description: "Monthly expense updated." });
            router.refresh();
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to update settings.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user?.isAdmin) {
        return null;
    }

    return (
        <div className="grid gap-6">
            <div className="grid gap-3">
                <Label htmlFor="monthly-expense">Monthly Food Expense (₹)</Label>
                <Input
                    id="monthly-expense"
                    type="number"
                    className="w-full"
                    value={expense}
                    onChange={(e) => setExpense(Number(e.target.value))}
                />
                <p className="text-sm text-muted-foreground">
                    This amount will be used to calculate the cost per person based on their participation.
                </p>
            </div>
            <Button onClick={handleSave} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Settings'}
            </Button>
        </div>
    );
}
