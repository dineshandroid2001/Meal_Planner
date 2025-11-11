"use client";

import { useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { useAuth, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    
    setIsSubmitting(true);

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // Create user profile on sign up
      const userDocRef = doc(firestore, 'roommates', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
          const appConfigDoc = await getDoc(doc(firestore, 'app-config', 'admin'));
          const isAdmin = !appConfigDoc.exists();

          const displayName = user.displayName || user.email?.split('@')[0] || 'New User';

          setDocumentNonBlocking(userDocRef, {
              id: user.uid,
              name: displayName,
              email: user.email,
              photoURL: user.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${displayName}`,
              isAdmin: isAdmin,
          }, { merge: true });

          if (isAdmin) {
              setDocumentNonBlocking(doc(firestore, 'app-config', 'admin'), { uid: user.uid }, { merge: true });
          }
      }
      

      toast({
        title: 'Success!',
        description: `You have been signed in.`,
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error(`Error during sign in:`, error);
      toast({
        title: 'Authentication Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button onClick={handleGoogleSignIn} disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Signing In...' : 'Sign In with Google'}
      </Button>
    </div>
  );
}
