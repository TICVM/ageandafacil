
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Camera, LogIn, GraduationCap, Loader2 } from 'lucide-react';
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
      // 1. Tenta login oficial via Firebase Auth (Administradores)
      await signInWithEmailAndPassword(auth, email, password);
      localStorage.removeItem('school_lens_teacher_email');
      // Redirecionamento via useEffect
    } catch (authErr: any) {
      // 2. Se falhar, tenta login manual via Firestore (Professores)
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email), where('password', '==', password));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          // Salva e-mail localmente para o Dashboard reconhecer o perfil
          localStorage.setItem('school_lens_teacher_email', email);
          // Usa login anônimo como ponte para ter uma sessão ativa no app
          await signInAnonymously(auth);
          // Redirecionamento via useEffect
        } else {
          setIsSubmitting(false);
          toast({
            title: "Credenciais inválidas",
            description: "E-mail ou senha incorretos.",
            variant: "destructive"
          });
        }
      } catch (dbErr: any) {
        setIsSubmitting(false);
        toast({
          title: "Erro de conexão",
          description: "Não foi possível validar seu acesso agora.",
          variant: "destructive"
        });
      }
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
      <div className="flex items-center gap-2 mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
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
            Entre como Administrador ou Professor
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
                className="bg-muted/30"
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
                className="bg-muted/30"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" disabled={isSubmitting} className="w-full h-11 text-lg font-semibold group">
              {isSubmitting ? <Loader2 className="mr-2 w-5 h-5 animate-spin" /> : 'Entrar'}
              {!isSubmitting && <LogIn className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            </Button>
            <div className="text-center text-xs text-muted-foreground mt-2">
              <p>Login híbrido: Administradores e Professores</p>
            </div>
          </CardFooter>
        </form>
      </Card>

      <div className="mt-8 flex gap-8 text-muted-foreground animate-in fade-in duration-1000">
        <div className="flex items-center gap-1.5">
          <GraduationCap className="w-4 h-4" />
          <span className="text-sm">Para Professores</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Camera className="w-4 h-4" />
          <span className="text-sm">Equipe Marketing</span>
        </div>
      </div>
    </div>
  );
}
