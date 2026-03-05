
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCog, Plus, Trash2, Search, Loader2, Mail, User as UserIcon, Lock, Eye, EyeOff } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { toast } from '@/hooks/use-toast';
import { User, UserRole } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';

export default function UsersAdminPage() {
  const db = useFirestore();
  const usersRef = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const { data: users, isLoading } = useCollection<User>(usersRef);

  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'TEACHER' as UserRole });

  const handleAdd = async () => {
    if (!newUser.name || !newUser.email || !newUser.password || !db) {
      toast({ title: "Erro", description: "Preencha todos os campos, incluindo a senha.", variant: "destructive" });
      return;
    }
    
    setIsCreating(true);

    try {
      // 1. Criar o usuário no Firebase Auth usando uma instância secundária 
      // para evitar que o administrador atual seja deslogado.
      const secondaryAppName = `Secondary-${Date.now()}`;
      const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
      const uid = userCredential.user.uid;

      // 2. Salvar os metadados no Firestore usando o mesmo UID do Auth
      setDocumentNonBlocking(doc(db, 'users', uid), {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        isActive: true,
        createdAt: new Date().toISOString()
      }, { merge: true });

      // Limpar instância secundária
      await deleteApp(secondaryApp);

      setNewUser({ name: '', email: '', password: '', role: 'TEACHER' });
      setIsDialogOpen(false);
      toast({ 
        title: "Usuário Cadastrado", 
        description: "A conta de acesso foi criada e o perfil foi salvo com sucesso." 
      });
    } catch (error: any) {
      console.error(error);
      let message = "Ocorreu um erro ao criar a conta.";
      if (error.code === 'auth/email-already-in-use') {
        message = "Este e-mail já está em uso.";
      } else if (error.code === 'auth/weak-password') {
        message = "A senha é muito fraca (mínimo 6 caracteres).";
      }
      
      toast({ 
        title: "Erro no cadastro", 
        description: message, 
        variant: "destructive" 
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRemove = (id: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'users', id));
    toast({ title: "Usuário Removido" });
  };

  const filtered = users?.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Usuários</h1>
          <p className="text-muted-foreground">Gerencie professores e administradores do SchoolLens.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl h-11 gap-2 shadow-lg">
              <Plus className="w-4 h-4" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Adicionar Usuário</DialogTitle>
              <DialogDescription>
                Ao salvar, uma conta de acesso será criada automaticamente no sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Nome Completo</label>
                <Input 
                  placeholder="Ex: Prof. Maria Silva" 
                  value={newUser.name} 
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  className="rounded-xl"
                  disabled={isCreating}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">E-mail</label>
                <Input 
                  type="email"
                  placeholder="maria@escola.com" 
                  value={newUser.email} 
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  className="rounded-xl"
                  disabled={isCreating}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Senha de Acesso</label>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres" 
                    value={newUser.password} 
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="rounded-xl pr-10"
                    disabled={isCreating}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                    disabled={isCreating}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Papel / Função</label>
                <Select 
                  value={newUser.role} 
                  onValueChange={(val) => setNewUser({...newUser, role: val as UserRole})}
                  disabled={isCreating}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecione o papel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEACHER">Professor(a)</SelectItem>
                    <SelectItem value="ADMIN">Administrador(a)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl" disabled={isCreating}>
                Cancelar
              </Button>
              <Button onClick={handleAdd} className="rounded-xl min-w-[120px]" disabled={isCreating}>
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar Perfil
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-white">
        <div className="p-4 border-b bg-muted/10">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou e-mail..." 
              className="pl-9 rounded-xl bg-white border-none shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        {isLoading ? (
          <div className="p-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/5">
                <TableHead className="font-bold">Usuário</TableHead>
                <TableHead className="font-bold">E-mail</TableHead>
                <TableHead className="font-bold">Papel</TableHead>
                <TableHead className="text-right font-bold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id} className="hover:bg-accent/5">
                  <TableCell className="font-bold">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <UserIcon className="w-4 h-4" />
                      </div>
                      {u.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3 h-3" />
                      {u.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={u.role === 'ADMIN' ? 'default' : 'secondary'}
                      className="rounded-lg"
                    >
                      {u.role === 'ADMIN' ? 'Administrador' : 'Professor'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemove(u.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
