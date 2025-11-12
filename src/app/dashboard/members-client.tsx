
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
import { Info, Trash2 } from 'lucide-react';
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
    const [isSubmitting, setIsSubmitting] = useState(false);
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
        if (areRoommatesLoading || areParticipantsLoading || isPlanLoading || !firestore) {
            setIsLoading(true);
            return;
        }

        const costPerDay = (monthlyPlan?.monthlyExpense || 0) / 30;

        const currentParticipantsData = participantsData || [];

        const combinedList = allRoommates?.map(roommate => {
            const participation = currentParticipantsData.find(p => p.id === roommate.id);
            
            const days = participation?.days ?? 0;
            
            let lastUpdatedAtDate: Date | null = null;
            if (participation?.lastUpdatedAt) {
                 if (participation.lastUpdatedAt instanceof Timestamp) {
                    lastUpdatedAtDate = participation.lastUpdatedAt.toDate();
                } else if (typeof participation.lastUpdatedAt === 'string') {
                    lastUpdatedAtDate = new Date(participation.lastUpdatedAt);
                } else if (participation.lastUpdatedAt instanceof Date) {
                    lastUpdatedAtDate = participation.lastUpdatedAt;
                }
            }
            
            return {
                id: roommate.id,
                name: roommate.name || roommate.displayName || 'Unknown',
                photoURL: roommate.photoURL || null,
                days: days,
                cost: calculateCost(days, costPerDay),
                lastUpdatedAt: lastUpdatedAtDate,
                lastUpdatedBy: participation?.lastUpdatedBy || 'System',
                isAdmin: roommate.isAdmin || false,
            };
        }) || [];

        setParticipants(combinedList);
        setIsLoading(false);

    }, [allRoommates, participantsData, monthlyPlan, areRoommatesLoading, areParticipantsLoading, isPlanLoading, firestore]);


    const handleDaysChange = (participantId: string, newDays: string) => {
        const days = parseInt(newDays, 10);
        const costPerDay = (monthlyPlan?.monthlyExpense || 0) / 30;
        setParticipants(prev => prev.map(p =>
            p.id === participantId
                ? { ...p, days: days, cost: calculateCost(days, costPerDay) }
                : p
        ));
    };

    const handleSaveChanges = (participant: Participant) => {
        if (!user || !firestore) {
            toast({ title: "Not authenticated or DB not available", description: "You must be logged in.", variant: "destructive" });
            return;
        }

        if (participant.id.startsWith('placeholder_')) {
            toast({ title: "Cannot Save", description: "This user must sign up first before you can save their participation.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);

        const participantDocRef = doc(firestore, `monthlyPlans/${monthId}/participations`, participant.id);

        const { name, photoURL, cost, ...participantToSave } = participant;

        const updatedParticipant = {
            ...participantToSave,
            days: participant.days, // ensure days are saved
            lastUpdatedAt: new Date(),
            lastUpdatedBy: user.name || user.displayName || user.email || 'Unknown User',
        };

        setDocumentNonBlocking(participantDocRef, updatedParticipant, { merge: true });

        toast({ title: "Success", description: `${participant.name}'s plan updated.` });
        setIsSubmitting(false);
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
    
    const canSelectDays = (participantId: string) => {
        if (!user) return false;
        return user.uid === participantId;
    }

    return (
        <>
            <TooltipProvider>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Member</TableHead>
                            <TableHead>Participation (Days)</TableHead>
                            <TableHead>Calculated Cost</TableHead>
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
                                        disabled={!canSelectDays(p.id)}
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
                                        {(user as User)?.isAdmin && (
                                            <Button
                                                size="sm"
                                                onClick={() => handleSaveChanges(p)}
                                                disabled={isSubmitting}
                                                className="w-full sm:w-auto"
                                            >
                                                Save
                                            </Button>
                                        )}
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
