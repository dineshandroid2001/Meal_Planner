"use client";

import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, UtensilsCrossed, Home, Receipt, History, Settings } from 'lucide-react';
import UserNav from '@/components/user-nav';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { User } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';


const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/dashboard/reimbursement', label: 'Reimbursement', icon: Receipt },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export default function Header() {
  const pathname = usePathname();
  const { user } = useUser();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleLinkClick = () => {
    setIsSheetOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      {/* Mobile Navigation */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <Button 
            size="icon" 
            variant="outline" 
            className="sm:hidden h-11 w-11 hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs w-[280px]">
          <nav className="grid gap-6 text-lg font-medium">
            <Link
              href="/dashboard"
              onClick={handleLinkClick}
              className="group flex h-12 w-12 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <UtensilsCrossed className="h-6 w-6 transition-all group-hover:scale-110" />
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
                onClick={handleLinkClick}
                className={cn(
                  'flex items-center gap-4 px-3 py-3 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors min-h-[48px]',
                  (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))) && 'text-foreground bg-accent'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            )})}
          </nav>
        </SheetContent>
      </Sheet>
      
      {/* Desktop Title - Only show on mobile */}
      {isMobile && (
        <div className="flex-1 flex items-center">
          <h1 className="text-lg font-semibold">Meal Planner</h1>
        </div>
      )}
      
      <div className="ml-auto flex items-center gap-2">
        <UserNav />
      </div>
    </header>
  );
}
