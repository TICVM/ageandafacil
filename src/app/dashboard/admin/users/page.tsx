
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { User, Class, Segment, RoleConfig } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';

export default function UsersAdminPage() {
  const db = useFirestore();
  const usersRef = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const classesRef = useMemoFirebase(() => db ? collection(db, 'school_classes') : null, [db]);
  const segmentsRef = useMemoFirebase(() => db ? collection(db, 'school_segments') : null, [db]);
  const rolesRef = useMemoFirebase(() => db ? collection(db, 'roles_config') : null, [db]);
  
  const { data: users, isLoading } = useCollection<User>(usersRef);
  const { data: schoolClasses } = useCollection<Class>(classesRef);
  const { data: segments } = useCollection<Segment>(segmentsRef);
  const { data: availableRoles } = useCollection<RoleConfig>(rolesRef);

  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const [newUser, setNewUser] = useState<{
    name: string;
    email: string;
    password: string;
    roleId: string;
    classIds: string[];
    segmentIds: string[];
  }>({ name: '', email: '', password: '', roleId: '', classIds: [], segmentIds: [] });

  const [editingUser, setEditingUser] = useState<User | null>(null);

  const handleAdd = async () => {
    if (!newUser.name || !newUser.email || !newUser.password || !newUser.roleId || !db) {
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
      
      const isAdmin = newUser.roleId === 'ADMIN';

      await setDoc(doc(db, 'users', uid), {
        name: newUser.name,
        email: normalizedEmail,
        roleId: newUser.roleId,
        classIds: isAdmin ? [] : newUser.classIds,
        segmentIds: isAdmin ? [] : newUser.segmentIds,
        isActive: true,
        createdAt: new Date().toISOString()
      }, { merge: true });

      setNewUser({ name: '', email: '', password: '', roleId: '', classIds: [], segmentIds: [] });
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

    const isAdmin = editingUser.roleId === 'ADMIN';

    updateDocumentNonBlocking(doc(db, 'users', editingUser.id), {
      name: editingUser.name,
      roleId: editingUser.roleId,
      classIds: isAdmin ? [] : (editingUser.classIds || []),
      segmentIds: isAdmin ? [] : (editingUser.segmentIds || [])
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

  const getRoleName = (roleId: string) => {
    if (roleId === 'ADMIN') return 'Administrador';
    const role = availableRoles?.find(r => r.id === roleId);
    return role?.name || roleId;
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
          <DialogContent className="rounded-2xl max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Adicionar Membro</DialogTitle>
              <DialogDescription>Defina o papel e as permissões de acesso.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-user-name-input" className="text-sm font-semibold">Nome Completo</Label>
                  <Input id="new-user-name-input" name="name" placeholder="Ex: Maria Silva" value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-user-email-input" className="text-sm font-semibold">E-mail</Label>
                  <Input id="new-user-email-input" name="email" type="email" placeholder="maria@escola.com" value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-user-password-input" className="text-sm font-semibold">Senha Inicial</Label>
                  <div className="relative">
                    <Input id="new-user-password-input" name="password" type={showPassword ? "text" : "password"} value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} className="rounded-xl pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-user-role-trigger" className="text-sm font-semibold">Papel no Sistema</Label>
                  <Select value={newUser.roleId} onValueChange={(val) => setNewUser({...newUser, roleId: val})} modal={false}>
                    <SelectTrigger id="new-user-role-trigger" name="role" className="rounded-xl">
                      <SelectValue placeholder="Selecione o papel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN" className="font-bold text-primary">Administrador (Total)</SelectItem>
                      {availableRoles?.filter(r => r.id !== 'ADMIN').map(role => (
                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {newUser.roleId !== 'ADMIN' ? (
                <div className="space-y-4 border-l pl-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-primary" />
                      Vincular Segmentos
                    </Label>
                    <ScrollArea className="h-[120px] rounded-xl border p-4 bg-muted/20">
                      <div className="space-y-3">
                        {segments?.sort((a,b) => (a.order || 0) - (b.order || 0)).map(seg => (
                          <div key={seg.id} className="flex items-center space-x-3 bg-white p-2 rounded-lg shadow-sm border border-transparent hover:border-primary/20">
                            <Checkbox id={`new-seg-chk-${seg.id}`} name={`new-seg-${seg.id}`} checked={newUser.segmentIds.includes(seg.id)} onCheckedChange={() => handleToggleSegment(seg.id)} />
                            <Label htmlFor={`new-seg-chk-${seg.id}`} className="text-xs font-medium cursor-pointer flex-1">{seg.name} {seg.unit ? `(${seg.unit})` : ''}</Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary" />
                      Vincular Turmas
                    </Label>
                    <ScrollArea className="h-[120px] rounded-xl border p-4 bg-muted/20">
                      <div className="space-y-3">
                        {schoolClasses?.sort((a,b) => (a.order || 0) - (b.order || 0)).map(cls => (
                          <div key={cls.id} className="flex items-center space-x-3 bg-white p-2 rounded-lg shadow-sm border border-transparent hover:border-primary/20">
                            <Checkbox id={`new-cls-chk-${cls.id}`} name={`new-cls-${cls.id}`} checked={newUser.classIds.includes(cls.id)} onCheckedChange={() => handleToggleClass(cls.id)} />
                            <Label htmlFor={`new-cls-chk-${cls.id}`} className="text-xs font-medium cursor-pointer flex-1">{cls.name}</Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center border-l pl-6 bg-primary/5 rounded-r-2xl text-center p-6 space-y-3">
                  <ShieldCheck className="w-12 h-12 text-primary opacity-50" />
                  <p className="text-xs font-bold text-primary uppercase">Administrador Master</p>
                  <p className="text-[10px] text-muted-foreground italic">Este perfil possui acesso automático a todos os segmentos e turmas da escola.</p>
                </div>
              )}
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
            <Label htmlFor="search-users-input" className="sr-only">Buscar usuários</Label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="search-users-input" name="search" placeholder="Buscar por nome ou e-mail..." className="pl-9 rounded-xl h-11 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                      <Badge variant={u.roleId === 'ADMIN' ? 'default' : 'outline'} className="rounded-lg">
                        {getRoleName(u.roleId)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {u.roleId === 'ADMIN' ? 'Acesso Total' : `${u.segmentIds?.length || 0} segmentos / ${u.classIds?.length || 0} turmas`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="rounded-full text-primary" onClick={() => { setEditingUser(u); setIsEditDialogOpen(true); }} aria-label="Editar usuário">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="rounded-full text-destructive" onClick={() => handleRemove(u.id)} aria-label="Remover usuário">
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

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="rounded-2xl max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Editar Perfil</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-user-name-input" className="text-sm font-semibold">Nome Completo</Label>
                <Input id="edit-user-name-input" name="name" value={editingUser?.name || ''} onChange={(e) => setEditingUser(prev => prev ? {...prev, name: e.target.value} : null)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-role-trigger" className="text-sm font-semibold">Papel no Sistema</Label>
                <Select value={editingUser?.roleId} onValueChange={(val) => setEditingUser(prev => prev ? {...prev, roleId: val} : null)} modal={false}>
                  <SelectTrigger id="edit-user-role-trigger" name="role" className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN" className="font-bold text-primary">Administrador (Total)</SelectItem>
                    {availableRoles?.filter(r => r.id !== 'ADMIN').map(role => (
                      <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {editingUser?.roleId !== 'ADMIN' ? (
              <div className="space-y-4 border-l pl-6">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Vincular Segmentos</Label>
                  <ScrollArea className="h-[120px] rounded-xl border p-4 bg-muted/20">
                    <div className="space-y-3">
                      {segments?.sort((a,b) => (a.order || 0) - (b.order || 0)).map(seg => (
                        <div key={seg.id} className="flex items-center space-x-3 bg-white p-2 rounded-lg border">
                          <Checkbox id={`edit-seg-chk-${seg.id}`} name={`edit-seg-${seg.id}`} checked={editingUser?.segmentIds?.includes(seg.id) || false} onCheckedChange={() => handleToggleSegment(seg.id, true)} />
                          <Label htmlFor={`edit-seg-chk-${seg.id}`} className="text-xs font-medium cursor-pointer flex-1">{seg.name} {seg.unit ? `(${seg.unit})` : ''}</Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Turmas do Docente</Label>
                  <ScrollArea className="h-[120px] rounded-xl border p-4 bg-muted/20">
                    <div className="space-y-3">
                      {schoolClasses?.sort((a,b) => (a.order || 0) - (b.order || 0)).map(cls => (
                        <div key={cls.id} className="flex items-center space-x-3 bg-white p-2 rounded-lg border">
                          <Checkbox id={`edit-cls-chk-${cls.id}`} name={`edit-cls-${cls.id}`} checked={editingUser?.classIds?.includes(cls.id) || false} onCheckedChange={() => handleToggleClass(cls.id, true)} />
                          <Label htmlFor={`edit-cls-chk-${cls.id}`} className="text-xs font-medium cursor-pointer flex-1">{cls.name}</Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center border-l pl-6 bg-primary/5 rounded-r-2xl text-center p-6 space-y-3">
                <ShieldCheck className="w-12 h-12 text-primary opacity-50" />
                <p className="text-xs font-bold text-primary uppercase">Administrador Master</p>
                <p className="text-[10px] text-muted-foreground italic">Este perfil possui acesso automático a todos os segmentos e turmas da escola.</p>
              </div>
            )}
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
