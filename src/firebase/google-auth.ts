
'use client';

import { GoogleAuthProvider, signInWithPopup, UserCredential, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase';
import { allowedEmails } from '@/lib/allowed-emails';

export const googleProvider = new GoogleAuthProvider();

// Configure the Google provider to request additional scopes if needed
googleProvider.addScope('email');
googleProvider.addScope('profile');

const isEmailAllowed = (email: string | null) => {
  if (allowedEmails.length === 0) return true; // If list is empty, allow all
  if (!email) return false;
  return allowedEmails.includes(email.toLowerCase());
};

export const signInWithGoogle = async (auth: Auth, firestore: Firestore): Promise<UserCredential> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Check if the signed-in user's email is on the whitelist
    if (!isEmailAllowed(user.email)) {
      // If not allowed, immediately sign them out and throw an error
      await signOut(auth);
      throw new Error("This email address is not authorized to use this application.");
    }

    // Check if user profile exists in Firestore
    const userDocRef = doc(firestore, 'roommates', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      // Create user profile for new Google sign-in users
      const appConfigDoc = await getDoc(doc(firestore, 'app-config', 'admin'));
      const isAdmin = !appConfigDoc.exists();

      const displayName = user.displayName || user.email?.split('@')[0] || 'New User';

      await setDocumentNonBlocking(userDocRef, {
        id: user.uid,
        name: displayName,
        email: user.email,
        photoURL: user.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${displayName}`,
        isAdmin: isAdmin,
      }, { merge: true });

      if (isAdmin) {
        await setDocumentNonBlocking(doc(firestore, 'app-config', 'admin'), { uid: user.uid }, { merge: true });
      }
    }

    return result;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};
