import MembersClient from './members-client';
import { getDocs, collection, getDoc, doc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import type { Participant, MonthlyPlan, User } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Users } from 'lucide-react';

async function getDashboardData() {
    const { firestore } = initializeFirebase();
    const today = new Date();
    const monthId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const planDocRef = doc(firestore, 'monthlyPlans', monthId);
    const usersCollectionRef = collection(firestore, 'users');
    const participantsCollectionRef = collection(firestore, `monthlyPlans/${monthId}/participants`);

    const [planDocSnap, usersSnap, participantsSnap] = await Promise.all([
        getDoc(planDocRef),
        getDocs(usersCollectionRef),
        getDocs(participantsCollectionRef)
    ]);
    
    const monthlyPlan: MonthlyPlan = planDocSnap.exists() ? (planDocSnap.data() as MonthlyPlan) : { id: monthId, monthlyExpense: 1000, lastUpdatedAt: new Date(), lastUpdatedBy: 'System' };
    
    const allUsers: User[] = usersSnap.docs.map(doc => doc.data() as User);
    const participantsData = participantsSnap.docs.map(doc => doc.data() as Participant);
    
    const participants: Participant[] = allUsers.map(user => {
        const participantData = participantsData.find(p => p.id === user.uid);
        if (participantData) {
            return participantData;
        }
        return {
            id: user.uid,
            name: user.displayName,
            photoURL: user.photoURL,
            days: 0,
            cost: 0,
            lastUpdatedAt: new Date(),
            lastUpdatedBy: 'System',
        };
    });

    return { participants, monthlyPlan };
}


export default async function DashboardPage() {
    const { participants, monthlyPlan } = await getDashboardData();
    
    return (
        <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle>Members</CardTitle>
                    <CardDescription>
                        Manage monthly meal plan participants and their costs.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <MembersClient initialParticipants={participants} monthlyPlan={monthlyPlan} />
                </CardContent>
                <CardFooter>
                  <div className="text-xs text-muted-foreground">
                    Showing <strong>{participants.length}</strong> members.
                  </div>
                </CardFooter>
            </Card>
        </div>
    );
}

export const revalidate = 10; // Revalidate every 10 seconds
