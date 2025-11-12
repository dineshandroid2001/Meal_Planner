"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, UtensilsCrossed, Receipt, Settings, History } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { User } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';


const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/dashboard/reimbursement', label: 'Reimbursement', icon: Receipt },
    // { href: '/dashboard/history', label: 'History', icon: History },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { user } = useUser();
    const isMobile = useIsMobile();
  
    // On mobile, sidebar is handled by header component, so we don't render anything
    if (isMobile) {
        return null;
    }
  
    return (
        <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
            <TooltipProvider>
                <nav className="flex flex-col items-center gap-4 px-2 py-4">
                    <Link
                      href="/dashboard"
                      className="group flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-10 md:w-10 md:text-base hover:bg-primary/90 transition-colors"
                    >
                      <UtensilsCrossed className="h-5 w-5 transition-all group-hover:scale-110" />
                      <span className="sr-only">Roommate Meal Planner</span>
                    </Link>
                    {navItems.map((item) => {
                        if (item.adminOnly && !(user as User)?.isAdmin) {
                            return null;
                        }
                        return (
                            <Tooltip key={item.href}>
                                <TooltipTrigger asChild>
                                    <Link
                                        href={item.href}
                                        className={cn(
                                            'flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground hover:bg-accent md:h-10 md:w-10',
                                            (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))) && 'bg-accent text-accent-foreground'
                                        )}
                                    >
                                        <item.icon className="h-5 w-5" />
                                        <span className="sr-only">{item.label}</span>
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right">{item.label}</TooltipContent>
                            </Tooltip>
                        )
                    })}
                </nav>
            </TooltipProvider>
        </aside>
    );
}
