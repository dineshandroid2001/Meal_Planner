import MembersClient from './members-client';
import DashboardSummary from './dashboard-summary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
    return (
        <div className="grid auto-rows-max items-start gap-4 md:gap-8">
            <Suspense fallback={
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                </div>
            }>
                <DashboardSummary />
            </Suspense>
            <div className="grid gap-4 md:gap-8 lg:grid-cols-1">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Members</CardTitle>
                        <CardDescription>
                            Manage monthly meal plan participants and their costs.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <MembersClient />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
