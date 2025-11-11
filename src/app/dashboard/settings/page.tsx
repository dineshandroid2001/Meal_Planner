import SettingsForm from './settings-form';
import { getDoc, doc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import type { MonthlyPlan } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

async function getMonthlyPlan() {
    const { firestore } = initializeFirebase();
    const today = new Date();
    const monthId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const planDocRef = doc(firestore, 'monthlyPlans', monthId);
    const planDocSnap = await getDoc(planDocRef);

    if (planDocSnap.exists()) {
        return planDocSnap.data() as MonthlyPlan;
    }
    
    // Return a default if not set
    return {
        id: monthId,
        monthlyExpense: 1000,
        lastUpdatedAt: new Date(),
        lastUpdatedBy: 'System',
    };
}


export default async function SettingsPage() {
    const monthlyPlan = await getMonthlyPlan();
    
    return (
        <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
            <Card className="max-w-xl">
                <CardHeader>
                    <CardTitle>Admin Settings</CardTitle>
                    <CardDescription>
                        Manage the meal plan settings for the current month. This page is only visible to admins.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <SettingsForm monthlyPlan={monthlyPlan} />
                </CardContent>
            </Card>
        </div>
    );
}

export const revalidate = 10;
