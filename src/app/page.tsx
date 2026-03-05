
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Camera, LogIn, GraduationCap, Loader2 } from 'lucide-react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';
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
    // Se já estiver logado (mesmo que anonimamente) e tivermos o e-mail salvo, redireciona
    if (user && !isUserLoading && localStorage.getItem('loggedUserEmail')) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // 1. Validar as credenciais diretamente no Firestore (como solicitado)
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email), where('password', '==', password));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('Usuário ou senha inválidos no banco de dados.');
      }

      // 2. Realizar login anônimo no Firebase Auth para manter a sessão técnica ativa
      await signInAnonymously(auth);

      // 3. Salvar o e-mail localmente para que o dashboard saiba quem carregar
      localStorage.setItem('loggedUserEmail', email);
      
      toast({
        title: "Login realizado",
        description: "Acesso validado pelo banco de dados com sucesso.",
      });

      router.push('/dashboard');
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
            Validação direta pelo cadastro de usuários
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
