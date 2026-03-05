
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GraduationCap, Plus, Trash2, Users, Layers } from 'lucide-react';
import { classes as initialClasses, segments as initialSegments, users } from '@/lib/db';
import { Class, Segment } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

export default function ClassesAdminPage() {
  const [classes, setClasses] = useState<Class[]>(initialClasses);
  const [segments, setSegments] = useState<Segment[]>(initialSegments);
  const [newClassName, setNewClassName] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [newSegmentName, setNewSegmentName] = useState('');

  const handleAddClass = () => {
    if (!newClassName || !selectedSegment || !selectedTeacher) {
      toast({ title: "Erro", description: "Preencha todos os campos da turma.", variant: "destructive" });
      return;
    }
    const cls: Class = {
      id: Math.random().toString(36).substr(2, 9),
      name: newClassName,
      segmentId: selectedSegment,
      teacherId: selectedTeacher
    };
    setClasses([...classes, cls]);
    setNewClassName('');
    toast({ title: "Turma Cadastrada" });
  };

  const handleAddSegment = () => {
    if (!newSegmentName) return;
    const seg: Segment = {
      id: Math.random().toString(36).substr(2, 9),
      name: newSegmentName
    };
    setSegments([...segments, seg]);
    setNewSegmentName('');
    toast({ title: "Segmento Adicionado" });
  };

  const teachers = users.filter(u => u.role === 'TEACHER');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Estrutura Escolar</h1>
        <p className="text-muted-foreground">Gerencie as turmas, professores e segmentos educacionais.</p>
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
                  <Select onValueChange={setSelectedSegment} value={selectedSegment}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {segments.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Professor(a)</label>
                  <Select onValueChange={setSelectedTeacher} value={selectedTeacher}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddClass} className="w-full rounded-xl gap-2">
                  <Plus className="w-4 h-4" />
                  Salvar Turma
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3 shadow-md border-none overflow-hidden">
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
                  {classes.map((c) => {
                    const seg = segments.find(s => s.id === c.segmentId);
                    const teacher = users.find(u => u.id === c.teacherId);
                    return (
                      <TableRow key={c.id} className="bg-white">
                        <TableCell className="font-bold">{c.name}</TableCell>
                        <TableCell>{seg?.name}</TableCell>
                        <TableCell className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent-foreground text-xs font-bold">
                            {teacher?.name.charAt(0)}
                          </div>
                          {teacher?.name}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full">
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
          <div className="max-w-2xl space-y-6">
            <Card className="shadow-md border-none">
              <CardHeader>
                <CardTitle className="text-lg">Adicionar Segmento</CardTitle>
                <CardDescription>Defina as grandes divisões da escola (ex: Infantil, Médio).</CardDescription>
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
                    <TableHead className="font-bold text-center w-32">Turmas</TableHead>
                    <TableHead className="text-right font-bold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {segments.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-bold flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-primary" />
                        {s.name}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="rounded-lg">
                          {classes.filter(c => c.segmentId === s.id).length}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full">
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
