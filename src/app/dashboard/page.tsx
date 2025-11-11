import MembersClient from './members-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
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
                    <MembersClient />
                </CardContent>
                <CardFooter>
                  <div className="text-xs text-muted-foreground">
                    Loading members...
                  </div>
                </CardFooter>
            </Card>
        </div>
    );
}
