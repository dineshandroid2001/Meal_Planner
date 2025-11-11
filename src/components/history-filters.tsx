"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Search, X, Filter } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface FilterState {
  search: string;
  userId: string;
  status: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

interface HistoryFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  users: Array<{ id: string; name: string }>;
  isLoading?: boolean;
}

export function HistoryFilters({ filters, onFiltersChange, users, isLoading = false }: HistoryFiltersProps) {
  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' }
  ];

  const updateFilter = (key: keyof FilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      userId: 'all',
      status: 'all',
      dateFrom: undefined,
      dateTo: undefined,
    });
  };

  const hasActiveFilters = 
    filters.search || 
    filters.userId !== 'all' || 
    filters.status !== 'all' || 
    filters.dateFrom || 
    filters.dateTo;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <CardTitle className="text-lg">Filters</CardTitle>
          </div>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="h-8 px-3"
            >
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>
        <CardDescription>
          Filter reimbursement requests by user, status, date range, or search terms
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="search">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search by user, description, amount, or AI summary..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="pl-9"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  updateFilter('search', '');
                }
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* User Filter */}
          <div className="space-y-2">
            <Label>User</Label>
            <Select 
              value={filters.userId} 
              onValueChange={(value) => updateFilter('userId', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select 
              value={filters.status} 
              onValueChange={(value) => updateFilter('status', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label>Date Range</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !filters.dateFrom && "text-muted-foreground"
                    )}
                    disabled={isLoading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateFrom ? (
                      format(filters.dateFrom, "MMM dd")
                    ) : (
                      <span>From</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={(date) => updateFilter('dateFrom', date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !filters.dateTo && "text-muted-foreground"
                    )}
                    disabled={isLoading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateTo ? (
                      format(filters.dateTo, "MMM dd")
                    ) : (
                      <span>To</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={(date) => updateFilter('dateTo', date)}
                    initialFocus
                    disabled={(date) => filters.dateFrom ? date < filters.dateFrom : false}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-muted">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-1 pt-2">
              <Filter className="h-3 w-3" />
              Active filters:
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              {filters.search && (
                <Badge variant="secondary" className="gap-1 hover:bg-secondary/80 transition-colors">
                  Search: "{filters.search.slice(0, 20)}{filters.search.length > 20 ? '...' : ''}"
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={() => updateFilter('search', '')} 
                  />
                </Badge>
              )}
              {filters.userId !== 'all' && (
                <Badge variant="secondary" className="gap-1 hover:bg-secondary/80 transition-colors">
                  User: {users.find(u => u.id === filters.userId)?.name || 'Unknown'}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={() => updateFilter('userId', 'all')} 
                  />
                </Badge>
              )}
              {filters.status !== 'all' && (
                <Badge variant="secondary" className="gap-1 hover:bg-secondary/80 transition-colors">
                  Status: {statusOptions.find(s => s.value === filters.status)?.label || 'Unknown'}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={() => updateFilter('status', 'all')} 
                  />
                </Badge>
              )}
              {(filters.dateFrom || filters.dateTo) && (
                <Badge variant="secondary" className="gap-1 hover:bg-secondary/80 transition-colors">
                  Date: {filters.dateFrom ? format(filters.dateFrom, "MMM dd") : '...'} - {filters.dateTo ? format(filters.dateTo, "MMM dd") : '...'}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={() => {
                      updateFilter('dateFrom', undefined);
                      updateFilter('dateTo', undefined);
                    }} 
                  />
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Hook for filter logic
export function useHistoryFilters<T extends {
  roommateId: string;
  status: string;
  submittedAt: any;
  description?: string;
  amount?: number;
  userName?: string;
}>(data: T[] | undefined, filters: FilterState, roommatesMap?: Map<string, string>) {
  return React.useMemo(() => {
    if (!data) return [];

    return data.filter((item) => {
      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const userName = roommatesMap?.get(item.roommateId) || item.userName || '';
        const searchableText = [
          item.description?.toLowerCase() || '',
          item.amount?.toString() || '',
          userName.toLowerCase()
        ].join(' ');
        
        if (!searchableText.includes(searchTerm)) {
          return false;
        }
      }

      // User filter
      if (filters.userId !== 'all' && item.roommateId !== filters.userId) {
        return false;
      }

      // Status filter
      if (filters.status !== 'all' && item.status !== filters.status) {
        return false;
      }

      // Date range filter
      if (filters.dateFrom || filters.dateTo) {
        let itemDate: Date;
        
        // Handle different timestamp formats
        if (item.submittedAt && typeof item.submittedAt.toDate === 'function') {
          itemDate = item.submittedAt.toDate();
        } else if (item.submittedAt instanceof Date) {
          itemDate = item.submittedAt;
        } else {
          itemDate = new Date(item.submittedAt);
        }

        if (filters.dateFrom && itemDate < filters.dateFrom) {
          return false;
        }

        if (filters.dateTo) {
          const endOfDay = new Date(filters.dateTo);
          endOfDay.setHours(23, 59, 59, 999);
          if (itemDate > endOfDay) {
            return false;
          }
        }
      }

      return true;
    });
  }, [data, filters]);
}

// Export filter utilities
export const createDefaultFilters = (): FilterState => ({
  search: '',
  userId: 'all',
  status: 'all',
  dateFrom: undefined,
  dateTo: undefined,
});

export const getFilterCount = (filters: FilterState): number => {
  let count = 0;
  if (filters.search) count++;
  if (filters.userId !== 'all') count++;
  if (filters.status !== 'all') count++;
  if (filters.dateFrom || filters.dateTo) count++;
  return count;
};