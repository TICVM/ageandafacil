
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Camera, LogIn, Loader2, Zap, UserPlus, ArrowLeft, Check, ChevronRight } from 'lucide-react';
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, collection } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Segment, Class } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();
  const segmentsRef = useMemoFirebase(() => db ? collection(db, 'school_segments') : null, [db]);
  const classesRef = useMemoFirebase(() => db ? collection(db, 'school_classes') : null, [db]);
  const { data: segments } = useCollection<Segment>(segmentsRef);
  const { data: schoolClasses } = useCollection<Class>(classesRef);

  const { user, isUserLoading } = useUser();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && user && !isUserLoading) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router, mounted]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const normalizedEmail = email.toLowerCase().trim();
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
      
      toast({
        title: "Login realizado",
        description: "Bem-vindo ao SchoolLens."
      });
      
      router.push('/dashboard');
    } catch (error: any) {
      setIsSubmitting(false);
      let message = "E-mail ou senha incorretos.";
      if (error.code === 'auth/user-not-found') message = "Usuário não encontrado.";
      if (error.code === 'auth/wrong-password') message = "Senha incorreta.";
      if (error.code === 'auth/invalid-email') message = "E-mail inválido.";
      
      toast({
        title: "Erro de acesso",
        description: message,
        variant: "destructive"
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Erro no cadastro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }

    if (selectedSegmentIds.length === 0 && selectedClassIds.length === 0) {
      toast({ title: "Dados incompletos", description: "Selecione pelo menos um segmento ou turma para continuar.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      // 1. Criar usuário no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const firebaseUser = userCredential.user;
      
      // 2. Atualizar nome no perfil do Auth
      await updateProfile(firebaseUser, { displayName: name });
      
      // 3. Buscar Perfil Padrão das configurações
      let defaultRoleId = 'PROFESSOR'; // Fallback
      if (db) {
        const settingsSnap = await getDoc(doc(db, 'app_settings', 'general'));
        if (settingsSnap.exists()) {
          defaultRoleId = settingsSnap.data().defaultRoleId || 'PROFESSOR';
        }
        
        // 4. Criar documento do usuário no Firestore
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          id: firebaseUser.uid,
          name: name,
          email: normalizedEmail,
          roleId: defaultRoleId,
          isActive: true,
          createdAt: new Date().toISOString(),
          classIds: selectedClassIds,
          segmentIds: selectedSegmentIds
        });
      }

      toast({
        title: "Conta criada com sucesso!",
        description: "Bem-vindo ao SchoolLens."
      });
      
      router.push('/dashboard');
    } catch (error: any) {
      setIsSubmitting(false);
      let message = "Ocorreu um erro ao criar sua conta.";
      if (error.code === 'auth/email-already-in-use') message = "Este e-mail já está em uso.";
      if (error.code === 'auth/weak-password') message = "A senha deve ter pelo menos 6 caracteres.";
      
      toast({
        title: "Erro no cadastro",
        description: message,
        variant: "destructive"
      });
    }
  };

  if (!mounted || isUserLoading || (user && mode === 'login')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ECF1FA]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Iniciando sistema...</p>
        </div>
      </div>
    );
  }

  const sortedSegments = segments?.slice().sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name)) || [];

  const filteredClasses = schoolClasses?.filter(c => selectedSegmentIds.includes(c.schoolSegmentId))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name)) || [];

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

      <Card className={`w-full ${mode === 'register' ? 'max-w-xl' : 'max-w-md'} shadow-xl border-t-4 border-t-primary rounded-2xl transition-all duration-300 overflow-hidden`}>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {mode === 'login' ? 'Acesso ao Sistema' : 'Criar Nova Conta'}
          </CardTitle>
          <CardDescription className="text-center">
            {mode === 'login' ? 'Entre com suas credenciais oficiais' : 'Preencha os dados e selecione seus grupos'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
          <CardContent className="space-y-5">
            {mode === 'register' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold" htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      placeholder="Seu nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="bg-muted/30 h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold" htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="nome@escola.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-muted/30 h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold" htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-muted/30 h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold" htmlFor="confirmPassword">Confirmar Senha</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="bg-muted/30 h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-4 bg-muted/20 p-4 rounded-2xl border border-muted/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" /> Configuração de Acesso
                  </p>
                  
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase text-slate-500">Seus Segmentos</Label>
                    <ScrollArea className="h-28 border rounded-xl bg-white p-2">
                      {sortedSegments.map(s => (
                        <div key={s.id} className="flex items-center gap-2 mb-1.5 px-1 py-1 hover:bg-slate-50 rounded-lg transition-colors">
                          <Checkbox 
                            id={`seg-${s.id}`} 
                            checked={selectedSegmentIds.includes(s.id)}
                            onCheckedChange={(c) => {
                              setSelectedSegmentIds(p => c ? [...p, s.id] : p.filter(id => id !== s.id));
                              // Limpar turmas do segmento removido
                              if (!c) {
                                const targetClasses = schoolClasses?.filter(cls => cls.schoolSegmentId === s.id).map(cls => cls.id) || [];
                                setSelectedClassIds(p => p.filter(id => !targetClasses.includes(id)));
                              }
                            }}
                          />
                          <Label htmlFor={`seg-${s.id}`} className="text-xs font-medium cursor-pointer flex-1">{s.name}</Label>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase text-slate-500">Suas Turmas</Label>
                    <ScrollArea className="h-28 border rounded-xl bg-white p-2">
                      {selectedSegmentIds.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic text-center py-4">Selecione um segmento primeiro</p>
                      ) : filteredClasses.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic text-center py-4">Nenhuma turma encontrada</p>
                      ) : (
                        filteredClasses.map(c => (
                          <div key={c.id} className="flex items-center gap-2 mb-1.5 px-1 py-1 hover:bg-slate-50 rounded-lg transition-colors">
                            <Checkbox 
                              id={`cls-${c.id}`} 
                              checked={selectedClassIds.includes(c.id)}
                              onCheckedChange={(ch) => setSelectedClassIds(p => ch ? [...p, c.id] : p.filter(id => id !== c.id))}
                            />
                            <Label htmlFor={`cls-${c.id}`} className="text-xs font-medium cursor-pointer flex-1">{c.name}</Label>
                          </div>
                        ))
                      )}
                    </ScrollArea>
                  </div>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="email">Email</label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nome@escola.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-muted/30 h-11 rounded-xl"
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
                    className="bg-muted/30 h-11 rounded-xl"
                  />
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" disabled={isSubmitting} className="w-full h-11 text-lg font-semibold group rounded-xl shadow-lg">
              {isSubmitting ? (
                <Loader2 className="mr-2 w-5 h-5 animate-spin" />
              ) : (
                mode === 'login' ? 'Entrar' : 'Concluir Cadastro'
              )}
              {!isSubmitting && (
                mode === 'login' ? (
                  <LogIn className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                ) : (
                  <Check className="ml-2 w-5 h-5" />
                )
              )}
            </Button>
            
            <div className="relative w-full py-2">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
              <div className="relative flex justify-center text-xs uppercase text-muted-foreground"><span className="bg-white px-3">Ou</span></div>
            </div>

            {mode === 'login' ? (
              <div className="w-full space-y-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full h-11 rounded-xl border-primary text-primary font-bold gap-2 hover:bg-primary/5"
                  onClick={() => setMode('register')}
                >
                  <UserPlus className="w-4 h-4" />
                  Criar uma conta
                </Button>
                <div className="w-full h-[1px] bg-slate-100 mt-2" />
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full h-11 rounded-xl text-muted-foreground font-medium gap-2 hover:bg-slate-50"
                  onClick={() => router.push('/reserva')}
                >
                  <Zap className="w-4 h-4 fill-muted-foreground text-muted-foreground" />
                  Agendamento Rápido
                </Button>
              </div>
            ) : (
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full h-11 rounded-xl text-primary font-bold gap-2"
                onClick={() => setMode('login')}
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para o Login
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
