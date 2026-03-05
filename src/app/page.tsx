
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Camera, LogIn, GraduationCap } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple mock auth
    if (email.includes('admin')) {
      localStorage.setItem('user', JSON.stringify({ id: 'admin-1', role: 'ADMIN', name: 'Admin User' }));
    } else {
      localStorage.setItem('user', JSON.stringify({ id: 'teacher-1', role: 'TEACHER', name: 'Prof. Helena' }));
    }
    router.push('/dashboard');
  };

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
            Entre com suas credenciais para gerenciar sessões de fotos
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
            <Button type="submit" className="w-full h-11 text-lg font-semibold group">
              Entrar
              <LogIn className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <div className="text-center text-xs text-muted-foreground mt-2">
              <p>Dica: Use "admin@school.com" para visão Administrativa</p>
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
