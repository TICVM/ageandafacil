
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, Plus, Trash2, CalendarDays, Loader2, Users, Layers, Globe, Copy } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { toast } from '@/hooks/use-toast';
import { TimeSlot, Class, Segment } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DAYS_OF_WEEK = [
  { id: '1', label: 'Segunda', short: 'Seg' },
  { id: '2', label: 'Terça', short: 'Ter' },
  { id: '3', label: 'Quarta', short: 'Qua' },
  { id: '4', label: 'Quinta', short: 'Qui' },
  { id: '5', label: 'Sexta', short: 'Sex' },
  { id: '6', label: 'Sábado', short: 'Sáb' },
  { id: '0', label: 'Domingo', short: 'Dom' },
];

export default function SlotAdminPage() {
  const db = useFirestore();
  
  const slotsRef = useMemoFirebase(() => db ? collection(db, 'available_time_slots') : null, [db]);
  const classesRef = useMemoFirebase(() => db ? collection(db, 'school_classes') : null, [db]);
  const segmentsRef = useMemoFirebase(() => db ? collection(db, 'school_segments') : null, [db]);

  const { data: slots, isLoading: loadingSlots } = useCollection<TimeSlot>(slotsRef);
  const { data: rawClasses } = useCollection<Class>(classesRef);
  const { data: rawSegments } = useCollection<Segment>(segmentsRef);

  const sortedSegments = rawSegments ? [...rawSegments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];
  const sortedClasses = rawClasses ? [...rawClasses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];

  // Estado do Criador Individual/Lote
  const [selectedDays, setSelectedDays] = useState<string[]>(['1', '2', '3', '4', '5']);
  const [startTime, setStartTime] = useState('08:00');
  const [duration, setDuration] = useState('60');
  const [targetType, setTargetType] = useState<'global' | 'segment' | 'class'>('global');
  const [targetId, setTargetId] = useState('');
  
  // Estado do Copiador
  const [sourceType, setSourceType] = useState<'global' | 'segment' | 'class'>('global');
  const [sourceId, setSourceId] = useState('');
  const [destType, setDestType] = useState<'segment' | 'class'>('segment');
  const [destId, setDestId] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  const handleToggleDay = (dayId: string) => {
    setSelectedDays(prev => 
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
    );
  };

  const handleBatchAdd = async () => {
    if (!db || selectedDays.length === 0) {
      toast({ title: "Erro", description: "Selecione pelo menos um dia.", variant: "destructive" });
      return;
    }
    if ((targetType === 'segment' || targetType === 'class') && !targetId) {
      toast({ title: "Erro", description: "Selecione o destino.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const slotsCol = collection(db, 'available_time_slots');
      selectedDays.forEach(day => {
        const newSlotRef = doc(slotsCol);
        batch.set(newSlotRef, {
          dayOfWeek: day,
          startTime: startTime,
          durationMinutes: parseInt(duration),
          schoolSegmentId: targetType === 'segment' ? targetId : null,
          schoolClassId: targetType === 'class' ? targetId : null,
          isActive: true
        });
      });
      await batch.commit();
      toast({ title: "Horários Criados" });
    } catch (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopySlots = async () => {
    if (!db || !slots) return;
    if ((sourceType !== 'global' && !sourceId) || !destId) {
      toast({ title: "Erro", description: "Selecione origem e destino corretamente.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const sourceSlots = slots.filter(s => {
        if (sourceType === 'global') return !s.schoolClassId && !s.schoolSegmentId;
        if (sourceType === 'segment') return s.schoolSegmentId === sourceId;
        if (sourceType === 'class') return s.schoolClassId === sourceId;
        return false;
      });

      if (sourceSlots.length === 0) {
        toast({ title: "Aviso", description: "A origem selecionada não possui horários para copiar.", variant: "secondary" });
        return;
      }

      const batch = writeBatch(db);
      const slotsCol = collection(db, 'available_time_slots');

      sourceSlots.forEach(s => {
        const newSlotRef = doc(slotsCol);
        batch.set(newSlotRef, {
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          durationMinutes: s.durationMinutes,
          schoolSegmentId: destType === 'segment' ? destId : null,
          schoolClassId: destType === 'class' ? destId : null,
          isActive: true
        });
      });

      await batch.commit();
      toast({ title: "Grade Copiada!", description: `${sourceSlots.length} horários foram replicados.` });
    } catch (error) {
      toast({ title: "Erro na cópia", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = (id: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'available_time_slots', id));
    toast({ title: "Horário Removido" });
  };

  const getTargetName = (slot: TimeSlot) => {
    if (slot.schoolClassId) {
      const cls = sortedClasses.find(c => c.id === slot.schoolClassId);
      return `Turma: ${cls?.name || '...'}`;
    }
    if (slot.schoolSegmentId) {
      const seg = sortedSegments.find(s => s.id === slot.schoolSegmentId);
      return `Seg: ${seg?.name || '...'}`;
    }
    return 'Global';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Grade de Horários</h1>
        <p className="text-muted-foreground">Configure e replique os horários de fotos da escola.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-white p-1 border shadow-sm">
              <TabsTrigger value="create" className="rounded-lg">Novo Horário</TabsTrigger>
              <TabsTrigger value="copy" className="rounded-lg">Copiar Grade</TabsTrigger>
            </TabsList>
            
            <TabsContent value="create">
              <Card className="shadow-md border-none">
                <CardHeader>
                  <CardTitle className="text-lg">Gerar em Lote</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-4 gap-1">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day.id} className="flex flex-col items-center p-2 rounded-lg border bg-muted/10">
                        <Checkbox 
                          id={`day-${day.id}`} 
                          checked={selectedDays.includes(day.id)}
                          onCheckedChange={() => handleToggleDay(day.id)}
                        />
                        <label htmlFor={`day-${day.id}`} className="text-[9px] mt-1 font-bold">{day.label.slice(0,3)}</label>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold">Início</label>
                      <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-xl h-10" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold">Duração (min)</label>
                      <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="rounded-xl h-10" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold">Alvo</label>
                    <div className="flex gap-1 mb-2">
                      <Button variant={targetType === 'global' ? 'default' : 'outline'} size="sm" onClick={() => { setTargetType('global'); setTargetId(''); }} className="text-[10px] h-8 flex-1">Global</Button>
                      <Button variant={targetType === 'segment' ? 'default' : 'outline'} size="sm" onClick={() => { setTargetType('segment'); setTargetId(''); }} className="text-[10px] h-8 flex-1">Segmento</Button>
                      <Button variant={targetType === 'class' ? 'default' : 'outline'} size="sm" onClick={() => { setTargetType('class'); setTargetId(''); }} className="text-[10px] h-8 flex-1">Turma</Button>
                    </div>
                    {targetType !== 'global' && (
                      <Select onValueChange={setTargetId} value={targetId}>
                        <SelectTrigger className="rounded-xl h-10">
                          <SelectValue placeholder={targetType === 'segment' ? "Escolha o Segmento" : "Escolha a Turma"} />
                        </SelectTrigger>
                        <SelectContent>
                          {targetType === 'segment' ? 
                            sortedSegments.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>) :
                            sortedClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                          }
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <Button onClick={handleBatchAdd} className="w-full rounded-xl gap-2 shadow-lg" disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    Adicionar Horários
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="copy">
              <Card className="shadow-md border-none">
                <CardHeader>
                  <CardTitle className="text-lg">Replicar Grade</CardTitle>
                  <CardDescription className="text-xs">Copie todos os horários de um local para outro.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 p-3 bg-primary/5 rounded-xl border border-primary/10">
                    <label className="text-xs font-bold flex items-center gap-1 text-primary">
                      <Globe className="w-3 h-3" /> Origem (De onde copiar)
                    </label>
                    <div className="flex gap-1 mb-2">
                      <Button variant={sourceType === 'global' ? 'default' : 'outline'} size="sm" onClick={() => { setSourceType('global'); setSourceId(''); }} className="text-[10px] h-7 flex-1">Global</Button>
                      <Button variant={sourceType === 'segment' ? 'default' : 'outline'} size="sm" onClick={() => { setSourceType('segment'); setSourceId(''); }} className="text-[10px] h-7 flex-1">Segmento</Button>
                      <Button variant={sourceType === 'class' ? 'default' : 'outline'} size="sm" onClick={() => { setSourceType('class'); setSourceId(''); }} className="text-[10px] h-7 flex-1">Turma</Button>
                    </div>
                    {sourceType !== 'global' && (
                      <Select onValueChange={setSourceId} value={sourceId}>
                        <SelectTrigger className="rounded-xl h-9 bg-white">
                          <SelectValue placeholder="Selecione a origem" />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceType === 'segment' ? 
                            sortedSegments.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>) :
                            sortedClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                          }
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="space-y-2 p-3 bg-accent/5 rounded-xl border border-accent/10">
                    <label className="text-xs font-bold flex items-center gap-1 text-accent-foreground">
                      <Copy className="w-3 h-3" /> Destino (Para onde copiar)
                    </label>
                    <div className="flex gap-1 mb-2">
                      <Button variant={destType === 'segment' ? 'default' : 'outline'} size="sm" onClick={() => { setDestType('segment'); setDestId(''); }} className="text-[10px] h-7 flex-1">Segmento</Button>
                      <Button variant={destType === 'class' ? 'default' : 'outline'} size="sm" onClick={() => { setDestType('class'); setDestId(''); }} className="text-[10px] h-7 flex-1">Turma</Button>
                    </div>
                    <Select onValueChange={setDestId} value={destId}>
                      <SelectTrigger className="rounded-xl h-9 bg-white">
                        <SelectValue placeholder="Selecione o destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {destType === 'segment' ? 
                          sortedSegments.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>) :
                          sortedClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                        }
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={handleCopySlots} variant="secondary" className="w-full rounded-xl gap-2 shadow-sm border" disabled={isSaving || !destId}>
                    {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    Copiar Agora
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <Card className="lg:col-span-2 shadow-md border-none overflow-hidden bg-white">
          <CardHeader className="bg-muted/10">
            <CardTitle className="text-xl">Grade Atual</CardTitle>
            <CardDescription>Visualize os horários configurados por dia.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {loadingSlots ? (
              <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
            ) : (
              <Tabs defaultValue="1" className="w-full">
                <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/20 p-1 mb-6 rounded-xl border">
                  {DAYS_OF_WEEK.map((day) => (
                    <TabsTrigger 
                      key={day.id} 
                      value={day.id} 
                      className="rounded-lg flex-1 min-w-[60px] text-xs py-2 data-[state=active]:bg-primary data-[state=active]:text-white"
                    >
                      {day.short}
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                {DAYS_OF_WEEK.map((day) => {
                  const daySlots = slots?.filter(s => s.dayOfWeek === day.id) || [];
                  
                  return (
                    <TabsContent key={day.id} value={day.id} className="mt-0 focus-visible:outline-none">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary">
                          <CalendarDays className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg">{day.label}</h3>
                        <Badge variant="secondary" className="ml-2 rounded-lg">{daySlots.length} horários</Badge>
                      </div>

                      {daySlots.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {daySlots.sort((a,b) => a.startTime.localeCompare(b.startTime)).map(s => (
                            <div key={s.id} className="bg-muted/10 p-4 rounded-xl border flex justify-between items-center group hover:bg-white transition-all shadow-sm hover:shadow-md">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-3 h-3 text-muted-foreground" />
                                  <span className="font-bold text-base">{s.startTime}</span>
                                  <span className="text-xs text-muted-foreground">({s.durationMinutes} min)</span>
                                </div>
                                <div className="mt-2">
                                  <Badge variant="outline" className="text-[10px] h-5 font-normal bg-white border-primary/20 text-primary">
                                    {getTargetName(s)}
                                  </Badge>
                                </div>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 text-destructive opacity-0 md:group-hover:opacity-100 hover:bg-destructive/10 rounded-full transition-all"
                                onClick={() => handleRemove(s.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-20 text-center text-muted-foreground border-2 border-dashed rounded-3xl">
                          Nenhum horário configurado para {day.label}.
                        </div>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
