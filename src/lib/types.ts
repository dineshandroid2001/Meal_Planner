
import type { User as FirebaseUser } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';

export interface User extends FirebaseUser {
  id?: string;
  name?: string;
  isAdmin?: boolean;
}

export type Participant = {
  id: string;
  name: string | null;
  photoURL: string | null;
  days: number;
  cost: number;
  lastUpdatedBy: string;
  lastUpdatedAt: Date;
};

export type AuditLog = {
  id: string;
  editorId: string;
  editorName: string;
  timestamp: Date;
  field: string;
  oldValue: any;
  newValue: any;
};

export type MonthlyPlan = {
  id: string; // e.g., '2024-07'
  monthlyExpense: number;
  lastUpdatedBy: string;
  lastUpdatedAt: Date;
};

export type ReimbursementRequest = {
  id: string;
  roommateId: string;
  userName: string;
  amount: number;
  description: string;
  receiptUrl?: string;
  paymentUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
  aiSummary: string;
  aiAlignment: string;
  aiDiscrepancies: string;
};


    