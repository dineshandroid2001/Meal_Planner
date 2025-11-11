
"use client";

import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { useAuth, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import GoogleSignInButton from '@/components/google-signin-button';

export default function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authAction, setAuthAction] = useState<'signIn' | 'signUp' | null>(null);

  const handleAuthAction = async (action: 'signIn' | 'signUp') => {
    if (!email || !password) {
      toast({
        title: 'Missing Fields',
        description: 'Please enter both email and password.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    setAuthAction(action);

    try {
      let userCredential;
      if (action === 'signIn') {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create user profile on sign up
        const userDocRef = doc(firestore, 'roommates', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            const appConfigDoc = await getDoc(doc(firestore, 'app-config', 'admin'));
            const isAdmin = !appConfigDoc.exists();

            const displayName = user.email?.split('@')[0] || 'New User';

            await setDocumentNonBlocking(userDocRef, {
                id: user.uid,
                name: displayName,
                email: user.email,
                photoURL: `https://api.dicebear.com/8.x/initials/svg?seed=${displayName}`,
                isAdmin: isAdmin,
            }, { merge: true });

            if (isAdmin) {
                await setDocumentNonBlocking(doc(firestore, 'app-config', 'admin'), { uid: user.uid }, { merge: true });
            }
        }
      }
      

      toast({
        title: 'Success!',
        description: `You have been ${action === 'signIn' ? 'signed in' : 'signed up'}.`,
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error(`Error during ${action}:`, error);
      toast({
        title: 'Authentication Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setAuthAction(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Google Sign In */}
      <GoogleSignInButton disabled={isSubmitting} />
      
      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with email
          </span>
        </div>
      </div>

      {/* Email/Password Form */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input 
          id="email" 
          type="email" 
          placeholder="m@example.com" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required 
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input 
            id="password" 
            type={showPassword ? "text" : "password"} 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 hover:opacity-75"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-gray-500" />
            ) : (
              <Eye className="h-4 w-4 text-gray-500" />
            )}
          </button>
        </div>
      </div>
      <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:gap-2">
        <Button onClick={() => handleAuthAction('signIn')} disabled={isSubmitting} className="w-full">
          {isSubmitting && authAction === 'signIn' ? 'Signing In...' : 'Sign In'}
        </Button>
        <Button onClick={() => handleAuthAction('signUp')} disabled={isSubmitting} variant="secondary" className="w-full">
          {isSubmitting && authAction === 'signUp' ? 'Signing Up...' : 'Sign Up'}
        </Button>
      </div>
    </div>
  );
}
