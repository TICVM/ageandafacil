
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserCog, Plus, Trash2, Search, Loader2, User as UserIcon, Eye, EyeOff, Layers, Edit2, ShieldCheck, GraduationCap } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { toast } from '@/hooks/use-toast';
import { User, UserRole, Class, Segment } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';

export default function UsersAdminPage() {
  const db = useFirestore();
  const usersRef = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const classesRef = useMemoFirebase(() => db ? collection(db, 'school_classes') : null, [db]);
  const segmentsRef = useMemoFirebase(() => db ? collection(db, 'school_segments') : null, [db]);
  
  const { data: users, isLoading } = useCollection<User>(usersRef);
  const { data: schoolClasses } = useCollection<Class>(classesRef);
  const { data: segments } = useCollection<Segment>(segmentsRef);

  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Estado para Novo Usuário
  const [newUser, setNewUser] = useState<{
    name: string;
    email: string;
    password: string;
    role: UserRole;
    classIds: string[];
    segmentIds: string[];
  }>({ name: '', email: '', password: '', role: 'TEACHER', classIds: [], segmentIds: [] });

  // Estado para Edição
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const handleAdd = async () => {
    if (!newUser.name || !newUser.email || !newUser.password || !db) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }
    
    setIsCreating(true);
    const normalizedEmail = newUser.email.toLowerCase().trim();
    let secondaryApp;

    try {
      const secondaryAppName = `Admin-Creation-${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, newUser.password);
      const uid = userCredential.user.uid;
      
      await setDoc(doc(db, 'users', uid), {
        name: newUser.name,
        email: normalizedEmail,
        role: newUser.role,
        classIds: newUser.role === 'TEACHER' ? newUser.classIds : [],
        segmentIds: newUser.role === 'COORDINATOR' ? newUser.segmentIds : [],
        isActive: true,
        createdAt: new Date().toISOString()
      }, { merge: true });

      setNewUser({ name: '', email: '', password: '', role: 'TEACHER', classIds: [], segmentIds: [] });
      setIsDialogOpen(false);
      toast({ title: "Usuário Cadastrado" });
    } catch (error: any) {
      let errorMsg = "Não foi possível criar o usuário.";
      if (error.code === 'auth/email-already-in-use') errorMsg = "Este e-mail já possui uma conta.";
      toast({ title: "Erro no cadastro", description: errorMsg, variant: "destructive" });
    } finally {
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (e) {
          console.error("Erro ao deletar app secundário:", e);
        }
      }
      setIsCreating(false);
    }
  };

  const handleUpdate = () => {
    if (!editingUser || !db) return;

    updateDocumentNonBlocking(doc(db, 'users', editingUser.id), {
      name: editingUser.name,
      role: editingUser.role,
      classIds: editingUser.role === 'TEACHER' ? (editingUser.classIds || []) : [],
      segmentIds: editingUser.role === 'COORDINATOR' ? (editingUser.segmentIds || []) : []
    });

    setIsEditDialogOpen(false);
    setEditingUser(null);
    toast({ title: "Usuário Atualizado" });
  };

  const handleToggleClass = (classId: string, isEditing = false) => {
    if (isEditing && editingUser) {
      setEditingUser(prev => {
        if (!prev) return null;
        const currentIds = prev.classIds || [];
        const isSelected = currentIds.includes(classId);
        return { ...prev, classIds: isSelected ? currentIds.filter(id => id !== classId) : [...currentIds, classId] };
      });
    } else {
      setNewUser(prev => {
        const isSelected = prev.classIds.includes(classId);
        return { ...prev, classIds: isSelected ? prev.classIds.filter(id => id !== classId) : [...prev.classIds, classId] };
      });
    }
  };

  const handleToggleSegment = (segmentId: string, isEditing = false) => {
    if (isEditing && editingUser) {
      setEditingUser(prev => {
        if (!prev) return null;
        const currentIds = prev.segmentIds || [];
        const isSelected = currentIds.includes(segmentId);
        return { ...prev, segmentIds: isSelected ? currentIds.filter(id => id !== segmentId) : [...currentIds, segmentId] };
      });
    } else {
      setNewUser(prev => {
        const isSelected = prev.segmentIds.includes(segmentId);
        return { ...prev, segmentIds: isSelected ? prev.segmentIds.filter(id => id !== segmentId) : [...prev.segmentIds, segmentId] };
      });
    }
  };

  const handleRemove = (id: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'users', id));
    toast({ title: "Usuário Removido" });
  };

  const filtered = users?.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN': return <Badge className="rounded-lg bg-blue-600">Admin</Badge>;
      case 'COORDINATOR': return <Badge className="rounded-lg bg-purple-600">Coordenação</Badge>;
      case 'TEACHER': return <Badge variant="secondary" className="rounded-lg">Professor</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Gestão de Equipe</h1>
          <p className="text-muted-foreground">Administradores, Coordenadores e Professores.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl h-11 gap-2 shadow-lg">
              <Plus className="w-4 h-4" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-2xl">
            <DialogHeader>
              <DialogTitle>Adicionar Membro</DialogTitle>
              <DialogDescription>Defina o papel e as permissões de acesso.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Nome Completo</label>
                  <Input placeholder="Ex: Maria Silva" value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">E-mail</label>
                  <Input type="email" placeholder="maria@escola.com" value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Senha Inicial</label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} className="rounded-xl pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Papel no Sistema</label>
                  <Select value={newUser.role} onValueChange={(val) => setNewUser({...newUser, role: val as UserRole})}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Selecione o papel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEACHER">Professor(a)</SelectItem>
                      <SelectItem value="COORDINATOR">Coordenação</SelectItem>
                      <SelectItem value="ADMIN">Administrador(a)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4 border-l pl-6">
                {newUser.role === 'COORDINATOR' && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-primary" />
                      Vincular Segmentos
                    </label>
                    <ScrollArea className="h-[250px] rounded-xl border p-4 bg-muted/20">
                      <div className="space-y-3">
                        {segments?.sort((a,b) => (a.order || 0) - (b.order || 0)).map(seg => (
                          <div key={seg.id} className="flex items-center space-x-3 bg-white p-2 rounded-lg shadow-sm border border-transparent hover:border-primary/20">
                            <Checkbox id={`seg-${seg.id}`} checked={newUser.segmentIds.includes(seg.id)} onCheckedChange={() => handleToggleSegment(seg.id)} />
                            <label htmlFor={`seg-${seg.id}`} className="text-xs font-medium cursor-pointer flex-1">{seg.name} {seg.unit ? `(${seg.unit})` : ''}</label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {newUser.role === 'TEACHER' && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary" />
                      Vincular Turmas
                    </label>
                    <ScrollArea className="h-[250px] rounded-xl border p-4 bg-muted/20">
                      <div className="space-y-3">
                        {schoolClasses?.sort((a,b) => (a.order || 0) - (b.order || 0)).map(cls => (
                          <div key={cls.id} className="flex items-center space-x-3 bg-white p-2 rounded-lg shadow-sm border border-transparent hover:border-primary/20">
                            <Checkbox id={`cls-${cls.id}`} checked={newUser.classIds.includes(cls.id)} onCheckedChange={() => handleToggleClass(cls.id)} />
                            <label htmlFor={`cls-${cls.id}`} className="text-xs font-medium cursor-pointer flex-1">{cls.name}</label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {newUser.role === 'ADMIN' && (
                  <div className="h-full flex items-center justify-center p-6 text-center text-muted-foreground bg-blue-50/50 rounded-2xl border border-blue-100">
                    <div className="space-y-2">
                      <ShieldCheck className="w-10 h-10 text-blue-600 mx-auto" />
                      <p className="text-xs font-bold text-blue-800">Acesso Total</p>
                      <p className="text-[10px]">Administradores gerenciam todos os segmentos, locais e usuários.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl" disabled={isCreating}>Cancelar</Button>
              <Button onClick={handleAdd} className="rounded-xl min-w-[120px]" disabled={isCreating}>{isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Usuário"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-white">
        <div className="p-4 border-b bg-muted/10">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou e-mail..." className="pl-9 rounded-xl bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>
        {isLoading ? (
          <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/5">
              <TableRow>
                <TableHead className="font-bold">Nome</TableHead>
                <TableHead className="font-bold">E-mail</TableHead>
                <TableHead className="font-bold">Papel / Vínculo</TableHead>
                <TableHead className="text-right font-bold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-bold">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary"><UserIcon className="w-4 h-4" /></div>
                      {u.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                      {getRoleBadge(u.role)}
                      {u.role === 'COORDINATOR' && (
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {u.segmentIds?.length || 0} segmentos vinculados
                        </span>
                      )}
                      {u.role === 'TEACHER' && (
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {u.classIds?.length || 0} turmas vinculadas
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="rounded-full text-primary" onClick={() => { setEditingUser(u); setIsEditDialogOpen(true); }}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="rounded-full text-destructive" onClick={() => handleRemove(u.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Modal de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="rounded-2xl max-w-2xl">
          <DialogHeader><DialogTitle>Editar Perfil</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Nome Completo</label>
                <Input value={editingUser?.name || ''} onChange={(e) => setEditingUser(prev => prev ? {...prev, name: e.target.value} : null)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Papel no Sistema</label>
                <Select value={editingUser?.role} onValueChange={(val) => setEditingUser(prev => prev ? {...prev, role: val as UserRole} : null)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEACHER">Professor(a)</SelectItem>
                    <SelectItem value="COORDINATOR">Coordenação</SelectItem>
                    <SelectItem value="ADMIN">Administrador(a)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-4 border-l pl-6">
              {editingUser?.role === 'COORDINATOR' && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Vincular Segmentos</label>
                  <ScrollArea className="h-[250px] rounded-xl border p-4 bg-muted/20">
                    <div className="space-y-3">
                      {segments?.sort((a,b) => (a.order || 0) - (b.order || 0)).map(seg => (
                        <div key={seg.id} className="flex items-center space-x-3 bg-white p-2 rounded-lg border">
                          <Checkbox id={`edit-seg-${seg.id}`} checked={editingUser.segmentIds?.includes(seg.id) || false} onCheckedChange={() => handleToggleSegment(seg.id, true)} />
                          <label htmlFor={`edit-seg-${seg.id}`} className="text-xs font-medium cursor-pointer flex-1">{seg.name} {seg.unit ? `(${seg.unit})` : ''}</label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              {editingUser?.role === 'TEACHER' && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Turmas do Professor</label>
                  <ScrollArea className="h-[250px] rounded-xl border p-4 bg-muted/20">
                    <div className="space-y-3">
                      {schoolClasses?.map(cls => (
                        <div key={cls.id} className="flex items-center space-x-3 bg-white p-2 rounded-lg border">
                          <Checkbox id={`edit-cls-${cls.id}`} checked={editingUser.classIds?.includes(cls.id) || false} onCheckedChange={() => handleToggleClass(cls.id, true)} />
                          <label htmlFor={`edit-cls-${cls.id}`} className="text-xs font-medium cursor-pointer flex-1">{cls.name}</label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleUpdate} className="rounded-xl">Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
