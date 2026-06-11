import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db, logAuditEvent } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'user' | null;
  loading: boolean;
  userData: any | null;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true, userData: null });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const isInitialAuthCheck = useRef(true);
  const prevAuthRef = useRef<{ uid: string | null; role: 'admin' | 'user' | null; email: string | null }>({
    uid: null,
    role: null,
    email: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          let finalRole: 'admin' | 'user' = 'user';
          let finalData = null;

          if (userDoc.exists()) {
            finalData = userDoc.data();
            finalRole = finalData.role;

            const adminEmails = ['newroskoto@gmail.com', 'mkamangahas@tip.edu.ph'];
            if (adminEmails.includes(currentUser.email!) && finalRole !== 'admin') {
              finalRole = 'admin';
              await updateDoc(userDocRef, { role: 'admin' });
              finalData.role = 'admin';
            }
          } else {
            const adminEmails = ['newroskoto@gmail.com', 'mkamangahas@tip.edu.ph'];
            if (adminEmails.includes(currentUser.email!)) {
              finalRole = 'admin';
            } else {
              finalRole = 'user';
            }
            
            const initialData = {
              role: finalRole,
              email: currentUser.email,
              createdAt: serverTimestamp(),
              name: '',
              phone: ''
            };
            await setDoc(userDocRef, initialData);
            finalData = initialData;
          }
          if (
            finalRole === 'admin' &&
            !isInitialAuthCheck.current &&
            prevAuthRef.current.uid !== currentUser.uid
          ) {
            await logAuditEvent(
              currentUser.email ?? 'unknown',
              'Admin Login',
              'Administrator signed in'
            );
          }

          setRole(finalRole);
          setUserData(finalData);
          setUser(currentUser);
          prevAuthRef.current = {
            uid: currentUser.uid,
            role: finalRole,
            email: currentUser.email,
          };
        } catch (error) {
          console.error("AuthContext Firestore Error:", error);
          const adminEmails = ['newroskoto@gmail.com', 'mkamangahas@tip.edu.ph'];
          const fallbackRole = adminEmails.includes(currentUser.email ?? '') ? 'admin' : 'user';
          setRole(fallbackRole);
          setUser(currentUser);
          prevAuthRef.current = {
            uid: currentUser.uid,
            role: fallbackRole,
            email: currentUser.email,
          };
        }
      } else {
        if (prevAuthRef.current.role === 'admin' && prevAuthRef.current.email) {
          await logAuditEvent(
            prevAuthRef.current.email,
            'Admin Logout',
            'Administrator signed out'
          );
        }
        setUser(null);
        setRole(null);
        setUserData(null);
        prevAuthRef.current = { uid: null, role: null, email: null };
      }
      isInitialAuthCheck.current = false;
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading, userData }}>
      {children}
    </AuthContext.Provider>
  );
};
