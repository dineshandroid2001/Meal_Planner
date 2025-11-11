import MembersClient from './members-client';
import DashboardSummary from './dashboard-summary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
    return (
        <div className="grid auto-rows-max items-start gap-4 md:gap-6">
            <Suspense fallback={
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            }>
                <DashboardSummary />
            </Suspense>
            <div className="grid gap-4 md:gap-6">
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Members</CardTitle>
                        <CardDescription>
                            Manage monthly meal plan participants and their costs.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-3 sm:px-6">
                        <MembersClient />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
