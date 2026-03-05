
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Plus, Trash2, Users, Layers, Loader2, Edit2, ArrowUpDown, Building2 } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { toast } from '@/hooks/use-toast';
import { Class, Segment } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function ClassesAdminPage() {
  const db = useFirestore();

  const classesRef = useMemoFirebase(() => db ? collection(db, 'school_classes') : null, [db]);
  const segmentsRef = useMemoFirebase(() => db ? collection(db, 'school_segments') : null, [db]);

  const { data: rawClasses, isLoading: loadingClasses } = useCollection<Class>(classesRef);
  const { data: rawSegments, isLoading: loadingSegments } = useCollection<Segment>(segmentsRef);

  // Ordenação no cliente
  const classes = rawClasses ? [...rawClasses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];
  const segments = rawSegments ? [...rawSegments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];

  const [newClassName, setNewClassName] = useState('');
  const [newClassOrder, setNewClassOrder] = useState('1');
  const [selectedSegment, setSelectedSegment] = useState('');
  
  const [newSegmentName, setNewSegmentName] = useState('');
  const [newSegmentUnit, setNewSegmentUnit] = useState('');
  const [newSegmentOrder, setNewSegmentOrder] = useState('1');

  // Estado para Edição
  const [editingItem, setEditingItem] = useState<{ id: string; name: string; unit?: string; order: number; type: 'class' | 'segment' } | null>(null);

  // Efeito para sugerir automaticamente a próxima ordem ao carregar ou cadastrar
  useEffect(() => {
    if (classes.length > 0) {
      const maxOrder = Math.max(...classes.map(c => c.order ?? 0));
      setNewClassOrder((maxOrder + 1).toString());
    } else {
      setNewClassOrder('1');
    }
  }, [rawClasses]);

  useEffect(() => {
    if (segments.length > 0) {
      const maxOrder = Math.max(...segments.map(s => s.order ?? 0));
      setNewSegmentOrder((maxOrder + 1).toString());
    } else {
      setNewSegmentOrder('1');
    }
  }, [rawSegments]);

  const handleAddClass = () => {
    if (!newClassName || !selectedSegment || !db) {
      toast({ title: "Erro", description: "Preencha o nome e o segmento da turma.", variant: "destructive" });
      return;
    }
    
    const orderVal = parseInt(newClassOrder) || 0;
    addDocumentNonBlocking(collection(db, 'school_classes'), {
      name: newClassName,
      schoolSegmentId: selectedSegment,
      order: orderVal,
      isActive: true
    });

    setNewClassName('');
    setNewClassOrder((orderVal + 1).toString());
    toast({ title: "Turma Cadastrada" });
  };

  const handleAddSegment = () => {
    if (!newSegmentName || !db) return;
    
    const orderVal = parseInt(newSegmentOrder) || 0;
    addDocumentNonBlocking(collection(db, 'school_segments'), {
      name: newSegmentName,
      unit: newSegmentUnit,
      order: orderVal,
      isActive: true
    });

    setNewSegmentName('');
    setNewSegmentUnit('');
    setNewSegmentOrder((orderVal + 1).toString());
    toast({ title: "Segmento Adicionado" });
  };

  const handleSaveEdit = () => {
    if (!editingItem || !db) return;
    
    const collectionName = editingItem.type === 'class' ? 'school_classes' : 'school_segments';
    const updateData: any = {
      name: editingItem.name,
      order: editingItem.order
    };
    
    if (editingItem.type === 'segment') {
      updateData.unit = editingItem.unit || '';
    }

    updateDocumentNonBlocking(doc(db, collectionName, editingItem.id), updateData);

    setEditingItem(null);
    toast({ title: "Alterações Salvas" });
  };

  const handleRemoveClass = (id: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'school_classes', id));
    toast({ title: "Turma Removida" });
  };

  const handleRemoveSegment = (id: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'school_segments', id));
    toast({ title: "Segmento Removido" });
  };

  const isLoading = loadingClasses || loadingSegments;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Estrutura Escolar</h1>
        <p className="text-muted-foreground">Gerencie as turmas, segmentos e a ordem de exibição.</p>
      </div>

      <Tabs defaultValue="classes" className="w-full">
        <TabsList className="bg-white p-1 rounded-2xl shadow-sm border mb-6">
          <TabsTrigger value="classes" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white">
            <Users className="w-4 h-4 mr-2" />
            Turmas
          </TabsTrigger>
          <TabsTrigger value="segments" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white">
            <Layers className="w-4 h-4 mr-2" />
            Segmentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-1 shadow-md border-none h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Nova Turma</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Nome da Turma</label>
                  <Input 
                    placeholder="Ex: 3º Ano C" 
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Ordem de Exibição</label>
                  <Input 
                    type="number"
                    value={newClassOrder}
                    onChange={(e) => setNewClassOrder(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Segmento</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onChange={(e) => setSelectedSegment(e.target.value)} 
                    value={selectedSegment}
                  >
                    <option value="">Selecione um segmento</option>
                    {segments?.map(s => (
                      <option key={s.id} value={s.id}>{s.name} {s.unit ? `(${s.unit})` : ''}</option>
                    ))}
                  </select>
                </div>
                <Button onClick={handleAddClass} className="w-full rounded-xl gap-2">
                  <Plus className="w-4 h-4" />
                  Salvar Turma
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3 shadow-md border-none overflow-hidden bg-white">
              {isLoading ? (
                <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow>
                      <TableHead className="w-16 text-center"><ArrowUpDown className="w-3 h-3 mx-auto" /></TableHead>
                      <TableHead className="font-bold">Turma</TableHead>
                      <TableHead className="font-bold">Segmento</TableHead>
                      <TableHead className="text-right font-bold">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes?.map((c) => {
                      const seg = segments?.find(s => s.id === c.schoolSegmentId);
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="text-center font-mono text-xs text-muted-foreground">{c.order || 0}</TableCell>
                          <TableCell className="font-bold">{c.name}</TableCell>
                          <TableCell>{seg?.name || '---'} {seg?.unit ? `(${seg.unit})` : ''}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="rounded-full hover:bg-primary/10 text-primary"
                                onClick={() => setEditingItem({ id: c.id, name: c.name, order: c.order || 0, type: 'class' })}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive hover:bg-destructive/10 rounded-full"
                                onClick={() => handleRemoveClass(c.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="segments" className="space-y-6">
          <div className="max-w-4xl space-y-6">
            <Card className="shadow-md border-none">
              <CardHeader>
                <CardTitle className="text-lg">Adicionar Segmento</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-1 space-y-2">
                   <label className="text-xs font-bold">Nome do Segmento</label>
                   <Input 
                    placeholder="Ex: Educação Infantil" 
                    value={newSegmentName}
                    onChange={(e) => setNewSegmentName(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="md:col-span-1 space-y-2">
                   <label className="text-xs font-bold">Unidade</label>
                   <Input 
                    placeholder="Ex: Unidade I" 
                    value={newSegmentUnit}
                    onChange={(e) => setNewSegmentUnit(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="w-24 space-y-2">
                   <label className="text-xs font-bold">Ordem</label>
                   <Input 
                    type="number"
                    value={newSegmentOrder}
                    onChange={(e) => setNewSegmentOrder(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <Button onClick={handleAddSegment} className="rounded-xl gap-2 shrink-0 h-10 mb-0.5">
                  <Plus className="w-4 h-4" />
                  Adicionar
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-md border-none overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="w-16 text-center"><ArrowUpDown className="w-3 h-3 mx-auto" /></TableHead>
                    <TableHead className="font-bold">Nome do Segmento</TableHead>
                    <TableHead className="font-bold">Unidade</TableHead>
                    <TableHead className="text-center font-bold">Turmas</TableHead>
                    <TableHead className="text-right font-bold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {segments?.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">{s.order || 0}</TableCell>
                      <TableCell className="font-bold flex items-center gap-2 py-4">
                        <GraduationCap className="w-4 h-4 text-primary" />
                        {s.name}
                      </TableCell>
                      <TableCell>
                        {s.unit ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Building2 className="w-3 h-3" />
                            {s.unit}
                          </div>
                        ) : '---'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="rounded-lg">
                          {classes?.filter(c => c.schoolSegmentId === s.id).length || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full hover:bg-primary/10 text-primary"
                            onClick={() => setEditingItem({ id: s.id, name: s.name, unit: s.unit || '', order: s.order || 0, type: 'segment' })}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:bg-destructive/10 rounded-full"
                            onClick={() => handleRemoveSegment(s.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

      {/* Modal de Edição */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Editar {editingItem?.type === 'class' ? 'Turma' : 'Segmento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Nome</label>
              <Input 
                value={editingItem?.name || ''} 
                onChange={(e) => setEditingItem(prev => prev ? {...prev, name: e.target.value} : null)}
                className="rounded-xl"
              />
            </div>
            {editingItem?.type === 'segment' && (
              <div className="space-y-2">
                <label className="text-sm font-semibold">Unidade</label>
                <Input 
                  value={editingItem?.unit || ''} 
                  onChange={(e) => setEditingItem(prev => prev ? {...prev, unit: e.target.value} : null)}
                  className="rounded-xl"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Ordem de Exibição</label>
              <Input 
                type="number"
                value={editingItem?.order || 0} 
                onChange={(e) => setEditingItem(prev => prev ? {...prev, order: parseInt(e.target.value) || 0} : null)}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSaveEdit} className="rounded-xl">Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
