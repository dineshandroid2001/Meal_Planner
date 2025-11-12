
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { Participant, MonthlyPlan, User } from '@/lib/types';
import { formatINR } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';
import { useUser, useFirestore, setDocumentNonBlocking, useCollection, useDoc, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, collection, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Info, Trash2, CheckCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const dayOptions = [0, 10, 15, 20, 30];
const MAINTENANCE_COST = 100;

function MembersList() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const today = new Date();
    const monthId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const planDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'monthlyPlans', monthId) : null, [firestore, monthId]);
    const { data: monthlyPlan, isLoading: isPlanLoading } = useDoc<MonthlyPlan>(planDocRef);

    const participantsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, `monthlyPlans/${monthId}/participations`) : null, [firestore, monthId]);
    const { data: participantsData, isLoading: areParticipantsLoading } = useCollection<Omit<Participant, 'name' | 'photoURL' | 'cost'>>(participantsCollectionRef);

    const roommatesCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'roommates') : null, [firestore]);
    const { data: allRoommates, isLoading: areRoommatesLoading } = useCollection<User & {id: string}>(roommatesCollectionRef);

    const calculateCost = (days: number, costPerDay: number) => {
        if (days === 0) {
            return MAINTENANCE_COST;
        }
        return days * costPerDay;
    };
    
    useEffect(() => {
        if (areRoommatesLoading || isPlanLoading || areParticipantsLoading || !firestore) {
            setIsLoading(true);
            return;
        }

        const costPerDay = (monthlyPlan?.monthlyExpense || 0) / 30;

        const combinedList = allRoommates?.map(roommate => {
            const firestoreParticipant = participantsData?.find(p => p.id === roommate.id);
            const days = firestoreParticipant?.days ?? 0;
            const isPaid = firestoreParticipant?.isPaid ?? false;
            
            let lastUpdatedAtDate: Date | null = null;
            if (firestoreParticipant?.lastUpdatedAt) {
                 if (firestoreParticipant.lastUpdatedAt instanceof Timestamp) {
                    lastUpdatedAtDate = firestoreParticipant.lastUpdatedAt.toDate();
                } else if (typeof firestoreParticipant.lastUpdatedAt === 'string') {
                    lastUpdatedAtDate = new Date(firestoreParticipant.lastUpdatedAt);
                } else if (firestoreParticipant.lastUpdatedAt instanceof Date) {
                    lastUpdatedAtDate = firestoreParticipant.lastUpdatedAt;
                }
            }
            
            return {
                id: roommate.id,
                name: roommate.name || roommate.displayName || 'Unknown',
                photoURL: roommate.photoURL || null,
                days: days,
                cost: calculateCost(days, costPerDay),
                lastUpdatedAt: lastUpdatedAtDate,
                lastUpdatedBy: firestoreParticipant?.lastUpdatedBy || 'System',
                isAdmin: roommate.isAdmin || false,
                isPaid: isPaid,
            };
        }) || [];

        setParticipants(combinedList);
        setIsLoading(false);

    }, [allRoommates, participantsData, monthlyPlan, areRoommatesLoading, areParticipantsLoading, isPlanLoading, firestore]);


    const handleDaysChange = (participantId: string, newDaysStr: string) => {
        const newDays = parseInt(newDaysStr, 10);
        
        if (!user || !firestore) {
            toast({ title: "Not authenticated or DB not available", description: "You must be logged in.", variant: "destructive" });
            return;
        }

        const participantDocRef = doc(firestore, `monthlyPlans/${monthId}/participations`, participantId);

        // When days change, reset payment status
        const updatedParticipantData = {
            days: newDays,
            isPaid: false, 
            lastUpdatedAt: new Date(),
            lastUpdatedBy: user.name || user.displayName || user.email || 'Unknown User',
        };

        setDocumentNonBlocking(participantDocRef, updatedParticipantData, { merge: true });

        toast({
            title: "Plan Updated",
            description: `Participation set to ${newDays} days. Awaiting payment confirmation.`,
        });
    };
    
    const handleMarkAsPaid = (participantId: string) => {
        if (!user || !(user as User).isAdmin || !firestore) {
            toast({ title: "Permission Denied", description: "Only admins can mark payments as paid.", variant: "destructive" });
            return;
        }
        
        const participantDocRef = doc(firestore, `monthlyPlans/${monthId}/participations`, participantId);
        
        const updatedData = {
            isPaid: true,
            paidAt: new Date(), // Optional: track when it was paid
        };

        setDocumentNonBlocking(participantDocRef, updatedData, { merge: true });
        
        toast({ title: "Payment Confirmed", description: "The member's contribution has been marked as paid." });
    };


    const handleDeleteMember = (participantId: string) => {
        if (!firestore || !(user as User)?.isAdmin) {
            toast({ title: "Permission Denied", description: "You are not authorized to delete members.", variant: "destructive" });
            return;
        }
        
        const roommateDocRef = doc(firestore, 'roommates', participantId);
        const participationDocRef = doc(firestore, `monthlyPlans/${monthId}/participations`, participantId);

        // Non-blocking deletions
        deleteDocumentNonBlocking(roommateDocRef);
        deleteDocumentNonBlocking(participationDocRef);

        toast({ title: "Member Deleted", description: "The member has been removed." });
    };

    const getInitials = (name: string | null | undefined) => {
        if (!name) return "U";
        const names = name.split(' ');
        if (names.length > 1) {
            return names[0][0] + names[names.length - 1][0];
        }
        return name[0];
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-[250px]" />
                            <Skeleton className="h-4 w-[200px]" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }
    
    const canEditDays = (participantId: string) => {
        if (!user) return false;
        // Any user (admin or not) can only edit their own days.
        return user.uid === participantId;
    };

    return (
        <>
            <TooltipProvider>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Member</TableHead>
                            <TableHead>Participation (Days)</TableHead>
                            <TableHead>Calculated Cost</TableHead>
                            <TableHead>Payment Status</TableHead>
                            <TableHead className="hidden md:table-cell">Last Updated</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {participants.map((p) => (
                            <TableRow key={p.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9">
                                            <AvatarImage src={p.photoURL ?? ''} alt={p.name ?? ''} />
                                            <AvatarFallback>{getInitials(p.name)}</AvatarFallback>
                                        </Avatar>
                                        <div className="grid gap-0.5">
                                          <div className="font-medium">{p.name}</div>
                                          {p.isAdmin && <Badge>Admin</Badge>}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Select
                                        value={String(p.days)}
                                        onValueChange={(value) => handleDaysChange(p.id, value)}
                                        disabled={!canEditDays(p.id)}
                                    >
                                        <SelectTrigger className="w-full sm:w-[120px]">
                                            <SelectValue placeholder="Select days" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {dayOptions.map(day => (
                                                <SelectItem key={day} value={String(day)}>{day === 30 ? 'Full Month' : `${day} days`}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>{formatINR(p.cost)}</TableCell>
                                <TableCell>
                                    {p.isPaid ? (
                                        <Badge variant="default" className="gap-1.5 pl-2 pr-2.5 py-1 text-sm">
                                            <CheckCircle className="h-4 w-4" />
                                            Paid
                                        </Badge>
                                    ) : (
                                        <Button 
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleMarkAsPaid(p.id)}
                                            disabled={!(user as User)?.isAdmin}
                                            className="h-9"
                                        >
                                            Mark as Paid
                                        </Button>
                                    )}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                    {p.days > 0 && p.lastUpdatedAt && (
                                    <div className="flex items-center gap-2">
                                        {(() => {
                                            if (p.lastUpdatedAt instanceof Date) return format(p.lastUpdatedAt, 'PPp');
                                            if (typeof p.lastUpdatedAt === 'object' && p.lastUpdatedAt && 'toDate' in p.lastUpdatedAt) {
                                                return format(p.lastUpdatedAt.toDate(), 'PPp');
                                            }
                                            return format(new Date(p.lastUpdatedAt as string), 'PPp');
                                        })()}
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Info className="h-4 w-4 text-muted-foreground" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Updated by: {p.lastUpdatedBy}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {(user as User)?.isAdmin && user?.uid !== p.id && (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="icon" className="h-9 w-9">
                                                        <Trash2 className="h-4 w-4" />
                                                        <span className="sr-only">Delete Member</span>
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This action cannot be undone. This will permanently delete {p.name}'s account and participation data.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteMember(p.id)}>Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TooltipProvider>
        </>
    );
}

export default function MembersClient() {
    return <MembersList />;
}
