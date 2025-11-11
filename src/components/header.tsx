"use client";

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, UtensilsCrossed } from 'lucide-react';
import UserNav from '@/components/user-nav';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { User } from '@/lib/types';


const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/dashboard/reimbursement', label: 'Reimbursement' },
    { href: '/dashboard/settings', label: 'Settings', adminOnly: true },
];

export default function Header() {
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs">
          <nav className="grid gap-6 text-lg font-medium">
            <Link
              href="/dashboard"
              className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
            >
              <UtensilsCrossed className="h-5 w-5 transition-all group-hover:scale-110" />
              <span className="sr-only">Roommate Meal Planner</span>
            </Link>
            {navItems.map((item) => {
              if (item.adminOnly && !(user as User)?.isAdmin) {
                return null;
              }
              return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground',
                  pathname === item.href && 'text-foreground'
                )}
              >
                {item.label}
              </Link>
            )})}
          </nav>
        </SheetContent>
      </Sheet>
      
      <div className="ml-auto flex items-center gap-2">
        <UserNav />
      </div>
    </header>
  );
}
