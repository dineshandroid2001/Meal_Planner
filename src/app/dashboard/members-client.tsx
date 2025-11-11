"use client";

import React, { useState, useMemo, useEffect } from 'react';
import type { Participant, MonthlyPlan } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"

type MembersClientProps = {
    initialParticipants: Participant[];
    monthlyPlan: MonthlyPlan;
}

const dayOptions = [0, 10, 15, 20, 30]; // Assuming 30 days in a month for simplicity

export default function MembersClient({ initialParticipants, monthlyPlan }: MembersClientProps) {
    const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const costPerDay = monthlyPlan.monthlyExpense / 30;

    useEffect(() => {
        const updatedParticipants = initialParticipants.map(p => ({
            ...p,
            cost: p.days * costPerDay,
        }));
        setParticipants(updatedParticipants);
    }, [initialParticipants, monthlyPlan.monthlyExpense, costPerDay]);

    const handleDaysChange = (participantId: string, newDays: string) => {
        const days = parseInt(newDays, 10);
        setParticipants(prev => prev.map(p => 
            p.id === participantId 
            ? { ...p, days: days, cost: days * costPerDay } 
            : p
        ));
    };

    const handleSaveChanges = async (participant: Participant) => {
        if (!user) {
            toast({ title: "Not authenticated", description: "You must be logged in.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            const today = new Date();
            const monthId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            const participantDocRef = doc(db, `monthlyPlans/${monthId}/participants`, participant.id);

            const updatedParticipant = {
                ...participant,
                lastUpdatedAt: new Date(),
                lastUpdatedBy: user.displayName || user.email || 'Unknown User',
            };
            
            await setDoc(participantDocRef, updatedParticipant, { merge: true });

            toast({ title: "Success", description: `${participant.name}'s plan updated.` });
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getInitials = (name: string | null | undefined) => {
        if (!name) return "U";
        const names = name.split(' ');
        if (names.length > 1) {
            return names[0][0] + names[names.length - 1][0];
        }
        return name[0];
      };

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
                                    disabled={user?.id !== p.id && !user?.isAdmin}
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
                                <div className="flex items-center gap-2">
                                    {format(new Date(p.lastUpdatedAt), 'PPp')}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Updated by: {p.lastUpdatedBy}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <Button 
                                    size="sm" 
                                    onClick={() => handleSaveChanges(p)}
                                    disabled={isSubmitting || (user?.id !== p.id && !user?.isAdmin)}
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
