
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { Participant, MonthlyPlan, User } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';
import { useUser, useFirestore, setDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, collection, getDocs, query, getDoc, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const dayOptions = [0, 10, 15, 20, 30];

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

    useEffect(() => {
        const fetchParticipantDetails = async () => {
            if (!firestore || areParticipantsLoading || !participantsData || isPlanLoading) {
                setIsLoading(areParticipantsLoading || isPlanLoading);
                return;
            }
            setIsLoading(true);

            const costPerDay = (monthlyPlan?.monthlyExpense || 0) / 30;

            const participantPromises = participantsData.map(async (p) => {
                const roommateDocRef = doc(firestore, 'roommates', p.id);
                const roommateSnap = await getDoc(roommateDocRef);
                const roommate = roommateSnap.data() as User;
                
                let lastUpdatedAtDate = new Date(); // Default
                if (p.lastUpdatedAt) {
                    if (p.lastUpdatedAt instanceof Timestamp) {
                        lastUpdatedAtDate = p.lastUpdatedAt.toDate();
                    } else if (p.lastUpdatedAt instanceof Date) {
                        lastUpdatedAtDate = p.lastUpdatedAt;
                    }
                }
                
                return {
                    ...p,
                    name: roommate?.displayName || 'Unknown',
                    photoURL: roommate?.photoURL || null,
                    cost: p.days * costPerDay,
                    lastUpdatedAt: lastUpdatedAtDate,
                };
            });
            
            const fetchedParticipants = await Promise.all(participantPromises);
            
            const allRoommatesQuery = query(collection(firestore, 'roommates'));
            const allRoommatesSnap = await getDocs(allRoommatesQuery);
            
            const allRoommates = allRoommatesSnap.docs.map(d => ({ id: d.id, ...d.data() } as User & {id: string}));

            const participatingIds = new Set(fetchedParticipants.map(p => p.id));
            
            allRoommates.forEach(roommate => {
                if (!participatingIds.has(roommate.id)) {
                    fetchedParticipants.push({
                        id: roommate.id,
                        name: roommate.displayName,
                        photoURL: roommate.photoURL,
                        days: 0,
                        cost: 0,
                        lastUpdatedAt: new Date(),
                        lastUpdatedBy: 'System',
                    });
                }
            });


            setParticipants(fetchedParticipants);
            setIsLoading(false);
        };

        fetchParticipantDetails();
    }, [firestore, participantsData, monthlyPlan, areParticipantsLoading, isPlanLoading]);


    const handleDaysChange = (participantId: string, newDays: string) => {
        const days = parseInt(newDays, 10);
        const costPerDay = (monthlyPlan?.monthlyExpense || 0) / 30;
        setParticipants(prev => prev.map(p =>
            p.id === participantId
            ? { ...p, days: days, cost: days * costPerDay }
            : p
        ));
    };

    const handleSaveChanges = (participant: Participant) => {
        if (!user || !firestore) {
            toast({ title: "Not authenticated or DB not available", description: "You must be logged in.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        
        const participantDocRef = doc(firestore, `monthlyPlans/${monthId}/participations`, participant.id);

        const { name, photoURL, cost, ...participantToSave } = participant;

        const updatedParticipant = {
            ...participantToSave,
            lastUpdatedAt: new Date(),
            lastUpdatedBy: user.displayName || user.email || 'Unknown User',
        };

        setDocumentNonBlocking(participantDocRef, updatedParticipant, { merge: true });

        toast({ title: "Success", description: `${participant.name}'s plan updated.` });
        
        // We don't want to wait for the result, so we'll set submitting to false immediately.
        // Errors will be caught by the global error handler.
        setIsSubmitting(false);
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

    return (
        <TooltipProvider>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Participation (Days)</TableHead>
                        <TableHead>Calculated Cost</TableHead>
                        <TableHead>Last Updated</TableHead>
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
                                    <div className="font-medium">{p.name}</div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Select
                                    value={String(p.days)}
                                    onValueChange={(value) => handleDaysChange(p.id, value)}
                                    disabled={user?.uid !== p.id && !(user as User)?.isAdmin}
                                >
                                    <SelectTrigger className="w-[120px]">
                                        <SelectValue placeholder="Select days" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dayOptions.map(day => (
                                            <SelectItem key={day} value={String(day)}>{day === 30 ? 'Full Month' : `${day} days`}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </TableCell>
                            <TableCell>₹{p.cost.toFixed(2)}</TableCell>
                            <TableCell>
                                {p.lastUpdatedAt && (
                                <div className="flex items-center gap-2">
                                    {format(p.lastUpdatedAt, 'PPp')}
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
                                <Button
                                    size="sm"
                                    onClick={() => handleSaveChanges(p)}
                                    disabled={isSubmitting || (user?.uid !== p.id && !(user as User)?.isAdmin)}
                                >
                                    Save
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TooltipProvider>
    );
}

export default function MembersClient() {
    return <MembersList />;
}
