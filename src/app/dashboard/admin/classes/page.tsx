'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Plus, Trash2, Users, Layers, Loader2 } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { toast } from '@/hooks/use-toast';
import { Class, Segment, User } from '@/lib/types';

export default function ClassesAdminPage() {
  const db = useFirestore();

  // Referências do Firestore
  const classesRef = useMemoFirebase(() => db ? collection(db, 'school_classes') : null, [db]);
  const segmentsRef = useMemoFirebase(() => db ? collection(db, 'school_segments') : null, [db]);
  const usersRef = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);

  const { data: classes, isLoading: loadingClasses } = useCollection<Class>(classesRef);
  const { data: segments, isLoading: loadingSegments } = useCollection<Segment>(segmentsRef);
  const { data: allUsers } = useCollection<User>(usersRef);

  const [newClassName, setNewClassName] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [newSegmentName, setNewSegmentName] = useState('');

  const teachers = allUsers?.filter(u => u.role === 'TEACHER') || [];

  const handleAddClass = () => {
    if (!newClassName || !selectedSegment || !selectedTeacher || !db) {
      toast({ title: "Erro", description: "Preencha todos os campos da turma.", variant: "destructive" });
      return;
    }
    
    addDocumentNonBlocking(collection(db, 'school_classes'), {
      name: newClassName,
      schoolSegmentId: selectedSegment,
      responsibleTeacherId: selectedTeacher,
      isActive: true
    });

    setNewClassName('');
    toast({ title: "Turma Cadastrada no Firestore" });
  };

  const handleAddSegment = () => {
    if (!newSegmentName || !db) return;
    
    addDocumentNonBlocking(collection(db, 'school_segments'), {
      name: newSegmentName,
      isActive: true
    });

    setNewSegmentName('');
    toast({ title: "Segmento Adicionado no Firestore" });
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
        <p className="text-muted-foreground">Gerencie as turmas e segmentos diretamente no banco de dados.</p>
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
                  <label className="text-sm font-semibold">Segmento</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onChange={(e) => setSelectedSegment(e.target.value)} 
                    value={selectedSegment}
                  >
                    <option value="">Selecione um segmento</option>
                    {segments?.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Professor(a)</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onChange={(e) => setSelectedTeacher(e.target.value)} 
                    value={selectedTeacher}
                  >
                    <option value="">Selecione um professor</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
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
                      <TableHead className="font-bold">Turma</TableHead>
                      <TableHead className="font-bold">Segmento</TableHead>
                      <TableHead className="font-bold">Professor(a)</TableHead>
                      <TableHead className="text-right font-bold">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes?.map((c) => {
                      const seg = segments?.find(s => s.id === (c as any).schoolSegmentId);
                      const teacher = teachers.find(t => t.id === (c as any).responsibleTeacherId);
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-bold">{c.name}</TableCell>
                          <TableCell>{seg?.name || '---'}</TableCell>
                          <TableCell>{teacher?.name || '---'}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive hover:bg-destructive/10 rounded-full"
                              onClick={() => handleRemoveClass(c.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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
          <div className="max-w-2xl space-y-6">
            <Card className="shadow-md border-none">
              <CardHeader>
                <CardTitle className="text-lg">Adicionar Segmento</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-4">
                <Input 
                  placeholder="Nome do segmento..." 
                  value={newSegmentName}
                  onChange={(e) => setNewSegmentName(e.target.value)}
                  className="rounded-xl"
                />
                <Button onClick={handleAddSegment} className="rounded-xl gap-2 shrink-0">
                  <Plus className="w-4 h-4" />
                  Adicionar
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-md border-none overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="font-bold">Nome do Segmento</TableHead>
                    <TableHead className="text-right font-bold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {segments?.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-bold flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-primary" />
                        {s.name}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:bg-destructive/10 rounded-full"
                          onClick={() => handleRemoveSegment(s.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
