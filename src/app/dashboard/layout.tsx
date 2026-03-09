
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { DashboardLayout as DashboardContainer } from '@/components/layout/dashboard-layout';
import { Loader2 } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { User } from '@/lib/types';

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();

  const [profile, setProfile] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchProfile() {
      if (!db || !user || !mounted) {
        if (mounted && !isUserLoading && !user) setLoadingProfile(false);
        return;
      }
      
      setLoadingProfile(true);
      
      try {
        const userEmail = user.email?.toLowerCase().trim();
        
        // Verificação Master Admin por E-mail (Garante acesso absoluto)
        if (userEmail === 'herbertpacheco@cvmsp.com.br') {
          setProfile({
            id: user.uid,
            email: userEmail,
            name: 'Herbert Pacheco',
            roleId: 'ADMIN'
          });
          setLoadingProfile(false);
          return;
        }

        // 1. Tenta buscar pelo UID
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          setProfile({ ...userDoc.data() as User, id: user.uid });
        } else if (userEmail) {
          // 2. Fallback: Busca pelo e-mail
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', userEmail), limit(1));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const docData = querySnapshot.docs[0];
            setProfile({ ...docData.data() as User, id: docData.id });
          }
        }
      } catch (err) {
        console.error("Erro ao carregar perfil no layout:", err);
      } finally {
        setLoadingProfile(false);
      }
    }

    if (user && mounted) {
      fetchProfile();
    } else if (mounted && !isUserLoading && !user) {
      setLoadingProfile(false);
    }
  }, [db, user, isUserLoading, mounted]);

  useEffect(() => {
    if (mounted && !isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router, mounted]);

  if (!mounted || isUserLoading || (user && loadingProfile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ECF1FA]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Sincronizando perfil...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <DashboardContainer>{children}</DashboardContainer>;
}
