
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Plus, Trash2, Users, Layers, Loader2, Edit2, ArrowUpDown, Building2, ShieldAlert } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, getDoc } from 'firebase/firestore';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { toast } from '@/hooks/use-toast';
import { Class, Segment, User, RoleConfig, AppPermissions } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const ADMIN_PERMS: AppPermissions = {
  canManageUsers: true, canConfigureSlots: true, canManageLocations: true,
  canManageClasses: true, canViewReports: true, canViewAllAppointments: true,
  canViewSegmentAppointments: true, canViewClassAppointments: true,
  canEditAppointments: true, canCancelAppointments: true, canDeleteAppointments: true,
  canCreateBookings: true, canChangeStatus: true,
  canStatusPending: true, canStatusConfirmed: true, canStatusCancelled: true, canStatusRescheduled: true, canStatusReScheduleRequest: true, canStatusCompleted: true
};

export default function ClassesAdminPage() {
  const db = useFirestore();
  const { user: authUser } = useUser();
  const [userPerms, setUserPerms] = useState<AppPermissions | null>(null);
  const [loadingPerms, setLoadingPerms] = useState(true);

  const isMaster = useMemo(() => {
    return authUser?.email?.toLowerCase().trim() === 'herbertpacheco@cvmsp.com.br';
  }, [authUser]);

  useEffect(() => {
    async function fetchPermissions() {
      if (!db || !authUser) return;
      
      try {
        if (isMaster) {
          setUserPerms(ADMIN_PERMS);
          setLoadingPerms(false);
          return;
        }

        const userDoc = await getDoc(doc(db, 'users', authUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          if (userData.roleId === 'ADMIN') {
            setUserPerms(ADMIN_PERMS);
          } else {
            const roleDoc = await getDoc(doc(db, 'roles_config', userData.roleId));
            if (roleDoc.exists()) {
              setUserPerms(roleDoc.data() as RoleConfig);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar permissões:", err);
      } finally {
        setLoadingPerms(false);
      }
    }
    fetchPermissions();
  }, [db, authUser, isMaster]);

  const classesRef = useMemoFirebase(() => db ? collection(db, 'school_classes') : null, [db]);
  const segmentsRef = useMemoFirebase(() => db ? collection(db, 'school_segments') : null, [db]);

  const { data: rawClasses, isLoading: loadingClasses } = useCollection<Class>(classesRef);
  const { data: rawSegments, isLoading: loadingSegments } = useCollection<Segment>(segmentsRef);

  const classes = useMemo(() => rawClasses ? [...rawClasses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [], [rawClasses]);
  const segments = useMemo(() => rawSegments ? [...rawSegments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [], [rawSegments]);

  const [newClassName, setNewClassName] = useState('');
  const [newClassOrder, setNewClassOrder] = useState('1');
  const [selectedSegment, setSelectedSegment] = useState('');
  
  const [newSegmentName, setNewSegmentName] = useState('');
  const [newSegmentUnit, setNewSegmentUnit] = useState('');
  const [newSegmentOrder, setNewSegmentOrder] = useState('1');

  const [editingItem, setEditingItem] = useState<{ id: string; name: string; unit?: string; order: number; type: 'class' | 'segment', schoolSegmentId?: string } | null>(null);

  const handleAddClass = () => {
    if (!userPerms?.canManageClasses) return;
    if (!newClassName || !selectedSegment || !db) return;
    addDocumentNonBlocking(collection(db, 'school_classes'), {
      name: newClassName,
      schoolSegmentId: selectedSegment,
      order: parseInt(newClassOrder) || 0,
      isActive: true
    });
    setNewClassName('');
    toast({ title: "Turma Cadastrada" });
  };

  const handleAddSegment = () => {
    if (!userPerms?.canManageClasses) return;
    if (!newSegmentName || !db) return;
    addDocumentNonBlocking(collection(db, 'school_segments'), {
      name: newSegmentName,
      unit: newSegmentUnit,
      order: parseInt(newSegmentOrder) || 0,
      isActive: true
    });
    setNewSegmentName('');
    setNewSegmentUnit('');
    toast({ title: "Segmento Adicionado" });
  };

  const handleSaveEdit = () => {
    if (!userPerms?.canManageClasses || !editingItem || !db) return;
    const collectionName = editingItem.type === 'class' ? 'school_classes' : 'school_segments';
    const updateData: any = {
      name: editingItem.name,
      order: editingItem.order
    };
    if (editingItem.type === 'segment') {
      updateData.unit = editingItem.unit || '';
    } else if (editingItem.type === 'class') {
      updateData.schoolSegmentId = editingItem.schoolSegmentId;
    }
    updateDocumentNonBlocking(doc(db, collectionName, editingItem.id), updateData);
    setEditingItem(null);
    toast({ title: "Alterações Salvas" });
  };

  if (loadingPerms) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  if (!isMaster && userPerms && !userPerms.canManageClasses) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-destructive opacity-50" />
        <h2 className="text-2xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground">Seu perfil não tem permissão para gerenciar a estrutura escolar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Estrutura Escolar</h1>
        <p className="text-muted-foreground">Gerencie as turmas, segmentos e a ordem de exibição.</p>
      </div>

      <Tabs defaultValue="classes" className="w-full">
        <TabsList className="bg-white p-1 rounded-2xl shadow-sm border mb-6">
          <TabsTrigger value="classes" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white"><Users className="w-4 h-4 mr-2" /> Turmas</TabsTrigger>
          <TabsTrigger value="segments" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white"><Layers className="w-4 h-4 mr-2" /> Segmentos</TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-1 shadow-md border-none h-fit">
              <CardHeader><CardTitle className="text-lg">Nova Turma</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-class-name">Nome da Turma</Label>
                  <Input id="new-class-name" name="name" placeholder="Ex: Maternal A" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-class-order">Ordem</Label>
                  <Input id="new-class-order" name="order" type="number" placeholder="Ordem" value={newClassOrder} onChange={(e) => setNewClassOrder(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-class-segment">Segmento</Label>
                  <select 
                    id="new-class-segment"
                    name="segment"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    onChange={(e) => setSelectedSegment(e.target.value)} 
                    value={selectedSegment}
                  >
                    <option value="">Selecione um segmento</option>
                    {segments.map(s => <option key={s.id} value={s.id}>{s.name} {s.unit ? `(${s.unit})` : ''}</option>)}
                  </select>
                </div>
                <Button onClick={handleAddClass} className="w-full rounded-xl gap-2"><Plus className="w-4 h-4" /> Salvar Turma</Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3 shadow-md border-none overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="w-16 text-center">Ordem</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((c) => {
                    const seg = segments.find(s => s.id === c.schoolSegmentId);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-center font-mono text-xs">{c.order || 0}</TableCell>
                        <TableCell className="font-bold">{c.name}</TableCell>
                        <TableCell>{seg?.name || '---'} {seg?.unit ? `(${seg.unit})` : ''}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setEditingItem({ id: c.id, name: c.name, order: c.order || 0, type: 'class', schoolSegmentId: c.schoolSegmentId })}><Edit2 className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteDocumentNonBlocking(doc(db, 'school_classes', c.id))}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="segments" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-1 shadow-md border-none h-fit">
              <CardHeader><CardTitle className="text-lg">Novo Segmento</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-seg-name">Nome do Segmento</Label>
                  <Input id="new-seg-name" name="name" placeholder="Ex: Educação Infantil" value={newSegmentName} onChange={(e) => setNewSegmentName(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-seg-unit">Unidade</Label>
                  <Input id="new-seg-unit" name="unit" placeholder="Ex: Unidade I" value={newSegmentUnit} onChange={(e) => setNewSegmentUnit(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-seg-order">Ordem</Label>
                  <Input id="new-seg-order" name="order" type="number" placeholder="Ordem" value={newSegmentOrder} onChange={(e) => setNewSegmentOrder(e.target.value)} className="rounded-xl" />
                </div>
                <Button onClick={handleAddSegment} className="w-full rounded-xl gap-2"><Plus className="w-4 h-4" /> Salvar Segmento</Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3 shadow-md border-none overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="w-16 text-center">Ordem</TableHead>
                    <TableHead>Nome do Segmento</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {segments.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-center font-mono text-xs">{s.order || 0}</TableCell>
                      <TableCell className="font-bold">{s.name}</TableCell>
                      <TableCell>{s.unit || '---'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditingItem({ id: s.id, name: s.name, unit: s.unit || '', order: s.order || 0, type: 'segment' })}><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteDocumentNonBlocking(doc(db, 'school_segments', s.id))}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="rounded-2xl" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Editar {editingItem?.type === 'class' ? 'Turma' : 'Segmento'}</DialogTitle>
            <DialogDescription>Atualize as informações de cadastro e ordenação desta unidade escolar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-item-name">Nome</Label>
              <Input id="edit-item-name" value={editingItem?.name || ''} onChange={(e) => setEditingItem(prev => prev ? {...prev, name: e.target.value} : null)} className="rounded-xl" />
            </div>
            {editingItem?.type === 'segment' && (
              <div className="space-y-2">
                <Label htmlFor="edit-item-unit">Unidade</Label>
                <Input id="edit-item-unit" value={editingItem?.unit || ''} onChange={(e) => setEditingItem(prev => prev ? {...prev, unit: e.target.value} : null)} className="rounded-xl" />
              </div>
            )}
            {editingItem?.type === 'class' && (
              <div className="space-y-2">
                <Label htmlFor="edit-item-segment">Segmento</Label>
                <select 
                  id="edit-item-segment"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                  value={editingItem.schoolSegmentId} 
                  onChange={(e) => setEditingItem(prev => prev ? {...prev, schoolSegmentId: e.target.value} : null)}
                >
                  {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-item-order">Ordem</Label>
              <Input id="edit-item-order" type="number" value={editingItem?.order || 0} onChange={(e) => setEditingItem(prev => prev ? {...prev, order: parseInt(e.target.value) || 0} : null)} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
