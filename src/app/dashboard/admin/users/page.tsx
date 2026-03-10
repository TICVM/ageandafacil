
'use client';

import { useState, useMemo } from 'react';
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
  
  const [newUser, setNewUser] = useState<{ name: string; email: string; password: string; roleId: string; classIds: string[]; segmentIds: string[]; }>({ name: '', email: '', password: '', roleId: '', classIds: [], segmentIds: [] });
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const handleSelectAllSegments = (isEditing = false) => {
    const all = segments?.map(s => s.id) || [];
    if (isEditing && editingUser) setEditingUser(prev => prev ? { ...prev, segmentIds: all } : null);
    else setNewUser(prev => ({ ...prev, segmentIds: all }));
  };

  const handleClearSegments = (isEditing = false) => {
    if (isEditing && editingUser) setEditingUser(prev => prev ? { ...prev, segmentIds: [] } : null);
    else setNewUser(prev => ({ ...prev, segmentIds: [] }));
  };

  const handleSelectAllClasses = (isEditing = false) => {
    const all = schoolClasses?.map(c => c.id) || [];
    if (isEditing && editingUser) setEditingUser(prev => prev ? { ...prev, classIds: all } : null);
    else setNewUser(prev => ({ ...prev, classIds: all }));
  };

  const handleClearClasses = (isEditing = false) => {
    if (isEditing && editingUser) setEditingUser(prev => prev ? { ...prev, classIds: [] } : null);
    else setNewUser(prev => ({ ...prev, classIds: [] }));
  };

  const handleAdd = async () => {
    if (!newUser.name || !newUser.email || !newUser.password || !newUser.roleId || !db) return;
    setIsCreating(true);
    let secApp;
    try {
      secApp = initializeApp(firebaseConfig, `Admin-${Date.now()}`);
      const cred = await createUserWithEmailAndPassword(getAuth(secApp), newUser.email.toLowerCase(), newUser.password);
      await setDoc(doc(db, 'users', cred.user.uid), { name: newUser.name, email: newUser.email.toLowerCase(), roleId: newUser.roleId, classIds: newUser.roleId === 'ADMIN' ? [] : newUser.classIds, segmentIds: newUser.roleId === 'ADMIN' ? [] : newUser.segmentIds, isActive: true, createdAt: new Date().toISOString() }, { merge: true });
      setIsDialogOpen(false); toast({ title: "Usuário Criado!" });
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); } finally { if (secApp) await deleteApp(secApp); setIsCreating(false); }
  };

  const handleUpdate = () => {
    if (!editingUser || !db) return;
    updateDocumentNonBlocking(doc(db, 'users', editingUser.id), { name: editingUser.name, roleId: editingUser.roleId, classIds: editingUser.roleId === 'ADMIN' ? [] : editingUser.classIds, segmentIds: editingUser.roleId === 'ADMIN' ? [] : editingUser.segmentIds });
    setIsEditDialogOpen(false); toast({ title: "Perfil Atualizado" });
  };

  const filtered = users?.filter(u => u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h1 className="text-3xl font-bold tracking-tight text-primary">Gestão de Equipe</h1><p className="text-muted-foreground">Administre os perfis de acesso da unidade.</p></div>
        <Button onClick={() => setIsDialogOpen(true)} className="rounded-xl h-11 gap-2 shadow-lg"><Plus className="w-4 h-4" /> Novo Usuário</Button>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-white rounded-2xl">
        <div className="p-4 border-b bg-muted/10"><div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar..." className="pl-9 rounded-xl h-11" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></div>
        {isLoading ? <div className="p-24 flex justify-center"><Loader2 className="animate-spin text-primary" /></div> : (
          <Table>
            <TableHeader className="bg-muted/5"><TableRow><TableHead className="font-bold">Nome</TableHead><TableHead className="font-bold">E-mail</TableHead><TableHead className="font-bold">Papel</TableHead><TableHead className="text-right font-bold">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-bold"><div className="flex items-center gap-3"><div className="p-2.5 bg-primary/10 rounded-xl text-primary"><UserIcon className="w-4 h-4" /></div>{u.name}</div></TableCell>
                  <TableCell className="text-slate-500">{u.email}</TableCell>
                  <TableCell><Badge variant={u.roleId === 'ADMIN' ? 'default' : 'outline'}>{u.roleId === 'ADMIN' ? 'Admin' : availableRoles?.find(r => r.id === u.roleId)?.name || u.roleId}</Badge></TableCell>
                  <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => { setEditingUser(u); setIsEditDialogOpen(true); }}><Edit2 className="w-4 h-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteDocumentNonBlocking(doc(db, 'users', u.id))}><Trash2 className="w-4 h-4" /></Button></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader><DialogTitle>Novo Membro</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2"><Label htmlFor="name-new">Nome Completo</Label><Input id="name-new" value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} className="rounded-xl" /></div>
              <div className="space-y-2"><Label htmlFor="email-new">E-mail</Label><Input id="email-new" type="email" value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} className="rounded-xl" /></div>
              <div className="space-y-2"><Label htmlFor="pass-new">Senha</Label><div className="relative"><Input id="pass-new" type={showPassword ? "text" : "password"} value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} className="rounded-xl" /><button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>
              <div className="space-y-2"><Label htmlFor="role-new">Papel</Label><Select value={newUser.roleId} onValueChange={(v) => setNewUser({...newUser, roleId: v})}><SelectTrigger id="role-new" className="rounded-xl"><SelectValue placeholder="Papel" /></SelectTrigger><SelectContent><SelectItem value="ADMIN">Administrador</SelectItem>{availableRoles?.filter(r => r.id !== 'ADMIN').map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            {newUser.roleId !== 'ADMIN' && (
              <div className="space-y-4 border-l pl-6">
                <div className="space-y-2"><div className="flex justify-between items-center"><Label className="text-sm font-bold">Segmentos</Label><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => handleSelectAllSegments()} className="h-6 text-[10px] text-primary">Todos</Button><Button variant="ghost" size="sm" onClick={() => handleClearSegments()} className="h-6 text-[10px]">Limpar</Button></div></div><ScrollArea className="h-24 border rounded-xl p-2">{segments?.map(s => <div key={s.id} className="flex items-center gap-2 text-xs"><Checkbox checked={newUser.segmentIds.includes(s.id)} onCheckedChange={(c) => setNewUser(p => ({...p, segmentIds: c ? [...p.segmentIds, s.id] : p.segmentIds.filter(id => id !== s.id)}))} />{s.name}</div>)}</ScrollArea></div>
                <div className="space-y-2"><div className="flex justify-between items-center"><Label className="text-sm font-bold">Turmas</Label><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => handleSelectAllClasses()} className="h-6 text-[10px] text-primary">Todas</Button><Button variant="ghost" size="sm" onClick={() => handleClearClasses()} className="h-6 text-[10px]">Limpar</Button></div></div><ScrollArea className="h-24 border rounded-xl p-2">{schoolClasses?.map(c => <div key={c.id} className="flex items-center gap-2 text-xs"><Checkbox checked={newUser.classIds.includes(c.id)} onCheckedChange={(ch) => setNewUser(p => ({...p, classIds: ch ? [...p.classIds, c.id] : p.classIds.filter(id => id !== c.id)}))} />{c.name}</div>)}</ScrollArea></div>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={handleAdd} disabled={isCreating} className="rounded-xl px-10">{isCreating ? <Loader2 className="animate-spin" /> : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader><DialogTitle>Editar Perfil</DialogTitle></DialogHeader>
          {editingUser && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div className="space-y-4">
                <div className="space-y-2"><Label htmlFor="name-edit">Nome</Label><Input id="name-edit" value={editingUser.name} onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} className="rounded-xl" /></div>
                <div className="space-y-2"><Label htmlFor="role-edit">Papel</Label><Select value={editingUser.roleId} onValueChange={(v) => setEditingUser({...editingUser, roleId: v})}><SelectTrigger id="role-edit" className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ADMIN">Administrador</SelectItem>{availableRoles?.filter(r => r.id !== 'ADMIN').map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
              {editingUser.roleId !== 'ADMIN' && (
                <div className="space-y-4 border-l pl-6">
                  <div className="space-y-2"><div className="flex justify-between items-center"><Label className="text-sm font-bold">Segmentos</Label><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => handleSelectAllSegments(true)} className="h-6 text-[10px] text-primary">Todos</Button><Button variant="ghost" size="sm" onClick={() => handleClearSegments(true)} className="h-6 text-[10px]">Limpar</Button></div></div><ScrollArea className="h-24 border rounded-xl p-2">{segments?.map(s => <div key={s.id} className="flex items-center gap-2 text-xs"><Checkbox checked={editingUser.segmentIds?.includes(s.id)} onCheckedChange={(c) => setEditingUser(p => p ? ({...p, segmentIds: c ? [...(p.segmentIds || []), s.id] : (p.segmentIds || []).filter(id => id !== s.id)}) : null)} />{s.name}</div>)}</ScrollArea></div>
                  <div className="space-y-2"><div className="flex justify-between items-center"><Label className="text-sm font-bold">Turmas</Label><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => handleSelectAllClasses(true)} className="h-6 text-[10px] text-primary">Todas</Button><Button variant="ghost" size="sm" onClick={() => handleClearClasses(true)} className="h-6 text-[10px]">Limpar</Button></div></div><ScrollArea className="h-24 border rounded-xl p-2">{schoolClasses?.map(c => <div key={c.id} className="flex items-center gap-2 text-xs"><Checkbox checked={editingUser.classIds?.includes(c.id)} onCheckedChange={(ch) => setEditingUser(p => p ? ({...p, classIds: ch ? [...(p.classIds || []), c.id] : (p.classIds || []).filter(id => id !== c.id)}) : null)} />{c.name}</div>)}</ScrollArea></div>
                </div>
              )}
            </div>
          )}
          <DialogFooter><Button onClick={handleUpdate} className="rounded-xl px-10">Salvar Alterações</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
