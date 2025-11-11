"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import Header from '@/components/header';
import Sidebar from '@/components/sidebar';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading: loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                <Skeleton className="h-8 w-8 rounded-full sm:hidden"/>
                <div className="relative ml-auto flex-1 md:grow-0">
                    <Skeleton className="h-8 w-full" />
                </div>
                <Skeleton className="h-8 w-8 rounded-full" />
            </header>
            <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                <Skeleton className="h-96 w-full rounded-lg" />
            </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Sidebar />
      <div className="flex flex-col sm:pl-14">
        <Header />
        <main className="flex-1 p-4 sm:p-6 bg-muted/40 min-h-[calc(100vh-3.5rem)]">
            {children}
        </main>
      </div>
    </div>
  );
}
