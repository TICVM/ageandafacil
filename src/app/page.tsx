
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Camera, LogIn, GraduationCap, Loader2, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && !isUserLoading) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // 1. TENTATIVA 1: Login via Firebase Auth (ADMINS)
      try {
        await signInWithEmailAndPassword(auth, email, password);
        localStorage.removeItem('school_lens_teacher_email');
        toast({ title: "Login Administrador", description: "Acesso via conta oficial do sistema." });
        router.push('/dashboard');
        return;
      } catch (authErr: any) {
        console.warn("Auth falhou, tentando validação no banco de dados...");
      }

      // 2. TENTATIVA 2: Busca direta no Firestore (PROFESSORES)
      if (db) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email), where('password', '==', password));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          // Usuário encontrado no banco! Entra de forma anônima para manter a sessão
          await signInAnonymously(auth);
          // Guarda o e-mail para que o layout saiba quem é o professor
          localStorage.setItem('school_lens_teacher_email', email);
          
          toast({ title: "Acesso Permitido", description: "Bem-vindo ao SchoolLens." });
          router.push('/dashboard');
        } else {
          throw new Error("E-mail ou senha incorretos.");
        }
      }
    } catch (error: any) {
      setIsSubmitting(false);
      toast({
        title: "Erro no login",
        description: error.message || "Verifique suas credenciais.",
        variant: "destructive"
      });
    }
  };

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="flex items-center gap-2 mb-8">
        <div className="bg-primary p-3 rounded-xl shadow-lg">
          <Camera className="w-8 h-8 text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold tracking-tight text-primary">SchoolLens</h1>
          <p className="text-muted-foreground font-medium">Scheduler</p>
        </div>
      </div>

      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Acesso ao Sistema</CardTitle>
          <CardDescription className="text-center">
            Admins usam conta oficial. Professores usam registro escolar.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="nome@escola.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">Senha</label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" disabled={isSubmitting} className="w-full h-11 text-lg font-semibold">
              {isSubmitting ? <Loader2 className="mr-2 w-5 h-5 animate-spin" /> : 'Entrar'}
              {!isSubmitting && <LogIn className="ml-2 w-5 h-5" />}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <div className="mt-8 flex gap-8 text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <UserCheck className="w-4 h-4 text-accent" />
          <span className="text-xs">Registro Escolar</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span className="text-xs">Acesso Admin</span>
        </div>
      </div>
    </div>
  );
}
