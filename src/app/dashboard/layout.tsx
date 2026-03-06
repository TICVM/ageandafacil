
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { DashboardLayout as DashboardContainer } from '@/components/layout/dashboard-layout';
import { Loader2 } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { User } from '@/lib/types';

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const auth = useAuth();

  const [profile, setProfile] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    async function fetchProfile() {
      if (!db || !user) {
        if (!isUserLoading && !user) setLoadingProfile(false);
        return;
      }
      
      setLoadingProfile(true);
      
      try {
        const emailToSearch = user.email?.toLowerCase().trim();
        
        // 1. Tenta buscar pelo UID
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          setProfile({ ...userDoc.data() as User, id: user.uid });
        } else if (emailToSearch) {
          // 2. Fallback: Busca pelo e-mail
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', emailToSearch), limit(1));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const docData = querySnapshot.docs[0];
            setProfile({ ...docData.data() as User, id: docData.id });
          }
        }
      } catch (err) {
        console.error("Erro ao carregar perfil:", err);
      } finally {
        setLoadingProfile(false);
      }
    }

    if (user) {
      fetchProfile();
    }
  }, [db, user, isUserLoading]);

  if (isUserLoading || (user && loadingProfile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ECF1FA]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Sincronizando acesso...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <DashboardContainer>{children}</DashboardContainer>;
}
