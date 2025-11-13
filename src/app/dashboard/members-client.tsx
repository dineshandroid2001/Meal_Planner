
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { Participant, MonthlyPlan, User } from '@/lib/types';
import { formatINR } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { Label } from '@/components/ui/label';

const dayOptions = [0, 10, 15, 20, 30];
const MAINTENANCE_COST = 100;

function MembersList() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const isMobile = useIsMobile();

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
                    <div key={i} className="flex items-center space-x-4 p-2">
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
    
    const renderLastUpdated = (p: Participant) => {
        if (p.days <= 0 || !p.lastUpdatedAt) return null;
        
        let formattedDate: string;
        try {
            if (p.lastUpdatedAt instanceof Date) formattedDate = format(p.lastUpdatedAt, 'PPp');
            else if (typeof p.lastUpdatedAt === 'object' && p.lastUpdatedAt && 'toDate' in p.lastUpdatedAt) {
                formattedDate = format(p.lastUpdatedAt.toDate(), 'PPp');
            } else {
                formattedDate = format(new Date(p.lastUpdatedAt as string), 'PPp');
            }
        } catch {
            return null; // Invalid date
        }
        
        return (
             <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {formattedDate}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Updated by: {p.lastUpdatedBy}</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        )
    };

    if (isMobile) {
        return (
            <TooltipProvider>
                <div className="grid gap-4">
                    {participants.map(p => (
                        <Card key={p.id} className="w-full">
                            <CardHeader className="flex flex-row items-start justify-between gap-4 p-4">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={p.photoURL ?? ''} alt={p.name ?? ''} />
                                        <AvatarFallback>{getInitials(p.name)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="font-medium">{p.name}</div>
                                        {p.isAdmin && <Badge>Admin</Badge>}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="grid gap-4 p-4 pt-0">
                                <div className="grid gap-2">
                                    <Label htmlFor={`days-select-mob-${p.id}`} className="text-xs">Participation</Label>
                                    <Select
                                        value={String(p.days)}
                                        onValueChange={(value) => handleDaysChange(p.id, value)}
                                        disabled={!canEditDays(p.id)}
                                        aria-labelledby={`days-select-mob-${p.id}`}
                                    >
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            {dayOptions.map(day => (
                                                <SelectItem key={day} value={String(day)}>{day === 30 ? 'Full Month' : `${day} days`}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {renderLastUpdated(p)}
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-muted-foreground">Cost</div>
                                    <div className="font-semibold">{formatINR(p.cost)}</div>
                                </div>
                            </CardContent>
                            <CardFooter className="p-4">
                                {p.isPaid ? (
                                    <Badge variant="default" className="w-full justify-center gap-1.5 py-2 text-sm"><CheckCircle className="h-4 w-4" /> Paid</Badge>
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full h-10"
                                        onClick={() => handleMarkAsPaid(p.id)}
                                        disabled={!(user as User)?.isAdmin}
                                    >
                                        Mark as Paid
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </TooltipProvider>
        );
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
                            <TableHead>Payment Status</TableHead>
                            <TableHead className="hidden md:table-cell">Last Updated</TableHead>
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
                                    {renderLastUpdated(p)}
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
