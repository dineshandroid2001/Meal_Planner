
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { Participant, MonthlyPlan, User } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';
import { useUser, useFirestore, setDocumentNonBlocking, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, collection, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Info, UserPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const dayOptions = [0, 10, 15, 20, 30];

function InviteRoommateDialog({ onInvite }: { onInvite: () => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const handleInvite = async () => {
        if (!name || !email || !firestore) {
            toast({ title: "Missing fields", description: "Please enter name and email.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);

        const tempId = `placeholder_${email.replace(/[^a-zA-Z0-9]/g, '')}`;
        const userDocRef = doc(firestore, 'roommates', tempId);

        
        setDocumentNonBlocking(userDocRef, {
            name: name,
            email: email,
            photoURL: `https://api.dicebear.com/8.x/initials/svg?seed=${name}`,
            isAdmin: false,
        }, { merge: true });

        toast({ title: "Roommate Invited", description: `${name} has been added. They will need to sign up with this email.` });
        onInvite();
        setName('');
        setEmail('');
        setIsOpen(false);
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Invite a New Roommate</DialogTitle>
                    <DialogDescription>
                        Add a new roommate to the meal plan. They will need to sign up with the same email to log in.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Name
                        </Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="Jane Doe" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">
                            Email
                        </Label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="col-span-3" placeholder="jane.doe@example.com" />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleInvite} disabled={isSubmitting}>
                        {isSubmitting ? "Inviting..." : "Invite Roommate"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function MembersList() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    const today = new Date();
    const monthId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const planDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'monthlyPlans', monthId) : null, [firestore, monthId]);
    const { data: monthlyPlan, isLoading: isPlanLoading } = useDoc<MonthlyPlan>(planDocRef);

    const participantsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, `monthlyPlans/${monthId}/participations`) : null, [firestore, monthId]);
    const { data: participantsData, isLoading: areParticipantsLoading } = useCollection<Omit<Participant, 'name' | 'photoURL' | 'cost'>>(participantsCollectionRef);

    const roommatesCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'roommates') : null, [firestore, refreshKey]);
    const { data: allRoommates, isLoading: areRoommatesLoading } = useCollection<User & {id: string}>(roommatesCollectionRef);

    useEffect(() => {
        if (areRoommatesLoading || areParticipantsLoading || isPlanLoading || !firestore) {
            setIsLoading(true);
            return;
        }

        const costPerDay = (monthlyPlan?.monthlyExpense || 0) / 30;

        const currentParticipantsData = participantsData || [];

        const combinedList = allRoommates?.map(roommate => {
            const participation = currentParticipantsData.find(p => p.id === roommate.id);
            
            const days = participation?.days || 0;
            
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
                cost: days * costPerDay,
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
                ? { ...p, days: days, cost: days * costPerDay }
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

    const canEdit = (participantId: string) => {
        if (!user) return false;
        return (user as User).isAdmin || user.uid === participantId;
    }

    return (
        <>
            {(user as User)?.isAdmin && (
                <div className="flex justify-end mb-4">
                    <InviteRoommateDialog onInvite={() => setRefreshKey(k => k + 1)} />
                </div>
            )}
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
                                        {p.isAdmin && <Badge>Admin</Badge>}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Select
                                        value={String(p.days)}
                                        onValueChange={(value) => handleDaysChange(p.id, value)}
                                        disabled={!canEdit(p.id)}
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
                                    {p.days > 0 && p.lastUpdatedAt && (
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
                                        disabled={isSubmitting || !canEdit(p.id)}
                                    >
                                        Save
                                    </Button>
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

    