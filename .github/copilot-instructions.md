# Roommate Meal Planner - Copilot Instructions

## Architecture Overview

This is a **Next.js 15 + Firebase + Tailwind** meal planning app for roommates. Key architectural patterns:

- **Firebase App Hosting integration**: Uses automatic initialization in production (`initializeApp()` without config) with fallback to local config in development
- **Client-side authentication flow**: Protected dashboard routes with automatic redirect to `/login` via `useUser()` hook
- **Real-time Firestore subscriptions**: All data fetching uses `useCollection`/`useDoc` hooks with Firebase listeners
- **Non-blocking writes**: Uses `*NonBlocking` functions that handle errors via global error emitter instead of throwing

## Critical Firebase Patterns

### Query Memoization (Required)
```tsx
// ALWAYS use useMemoFirebase for Firestore refs/queries
const reimbursementsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "reimbursements"), orderBy("submittedAt", "desc"));
}, [firestore]);

const { data, isLoading } = useCollection<ReimbursementRequest>(reimbursementsQuery);
```

### Firebase Service Access
```tsx
// Get Firebase services from context
const { user } = useUser();           // Auth state + user doc data
const firestore = useFirestore();     // Firestore instance
// For Firebase storage: import { getStorage } from 'firebase/storage'
```

### Non-blocking Operations
```tsx
// Use these for writes that shouldn't block UI
addDocumentNonBlocking(collection(firestore, "reimbursements"), data);
setDocumentNonBlocking(doc(firestore, "users", userId), userData);
deleteDocumentNonBlocking(docRef);

// Errors are handled globally via FirebaseErrorListener component
```

## Key Data Models

Core types in `src/lib/types.ts`:
- **User**: Extended Firebase user with `isAdmin`, `name` properties
- **Participant**: Monthly food plan participation with days/cost calculations
- **ReimbursementRequest**: Grocery purchase reimbursements with approval workflow
- **MonthlyPlan**: Monthly expense budget set by admins

## Development Workflow

```bash
# Development server (uses Turbopack on port 9002)
npm run dev

# Production build
npm run build

# Type checking
npm run typecheck
```

## UI/Styling Conventions

- **Design system**: Tailwind CSS + shadcn/ui components in `src/components/ui/`
- **Color palette**: Soft teal primary (`#A0D2EB`), light beige background (`#F5F5DC`), muted orange accent (`#E59866`)
- **Typography**: PT Sans font family loaded from Google Fonts
- **Layout pattern**: Dashboard uses `Sidebar` + `Header` with protected route wrapper in `src/app/dashboard/layout.tsx`

## Component Patterns

### Data Loading States
```tsx
if (loading || !user) {
    return <Skeleton className="h-96 w-full rounded-lg" />;
}
```

### Error Handling
- Global Firebase errors handled by `FirebaseErrorListener` component (included in root layout)
- Use `useToast()` for user-facing success/error messages
- Form validation typically uses react-hook-form + zod

### Route Protection
Dashboard routes automatically redirect unauthenticated users to `/login` via the layout wrapper.

## File Organization

- `src/app/`: Next.js App Router pages and layouts
- `src/firebase/`: Firebase initialization, hooks, and utilities  
- `src/components/`: Reusable UI components (shadcn/ui in `/ui` subfolder)
- `src/lib/`: Shared utilities, types, and helper functions
- `docs/blueprint.md`: Product requirements and design specifications

## Important Notes

- All Firestore queries MUST be memoized with `useMemoFirebase` to prevent infinite re-renders
- Authentication state is managed globally through Firebase context providers
- Firebase App Hosting handles production environment variables automatically
- The app uses month-based data partitioning (e.g., `monthlyPlans/2024-07`)