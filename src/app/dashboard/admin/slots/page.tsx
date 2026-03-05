
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
  { id: '1', label: 'Segunda' },
  { id: '2', label: 'Terça' },
  { id: '3', label: 'Quarta' },
  { id: '4', label: 'Quinta' },
  { id: '5', label: 'Sexta' },
  { id: '6', label: 'Sábado' },
  { id: '0', label: 'Domingo' },
];

export default function SlotAdminPage() {
  const db = useFirestore();
  
  const slotsRef = useMemoFirebase(() => db ? collection(db, 'available_time_slots') : null, [db]);
  const classesRef = useMemoFirebase(() => db ? collection(db, 'school_classes') : null, [db]);
  const segmentsRef = useMemoFirebase(() => db ? collection(db, 'school_segments') : null, [db]);

  const { data: slots, isLoading: loadingSlots } = useCollection<TimeSlot>(slotsRef);
  const { data: classes } = useCollection<Class>(classesRef);
  const { data: segments } = useCollection<Segment>(segmentsRef);

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
      // Filtrar slots de origem
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
      const cls = classes?.find(c => c.id === slot.schoolClassId);
      return `Turma: ${cls?.name || '...'}`;
    }
    if (slot.schoolSegmentId) {
      const seg = segments?.find(s => s.id === slot.schoolSegmentId);
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
                            segments?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>) :
                            classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
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
                            segments?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>) :
                            classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
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
                          segments?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>) :
                          classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
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
            <CardDescription>Horários ativos no banco de dados.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loadingSlots ? (
              <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
            ) : (
              <div className="divide-y">
                {DAYS_OF_WEEK.map((day) => {
                  const daySlots = slots?.filter(s => s.dayOfWeek === day.id) || [];
                  if (daySlots.length === 0) return null;

                  return (
                    <div key={day.id} className="p-6">
                      <h3 className="font-bold text-primary flex items-center gap-2 mb-4">
                        <CalendarDays className="w-5 h-5" />
                        {day.label}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {daySlots.sort((a,b) => a.startTime.localeCompare(b.startTime)).map(s => (
                          <div key={s.id} className="bg-muted/10 p-3 rounded-xl border flex justify-between items-center group hover:bg-white transition-colors">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <Clock className="w-3 h-3 text-muted-foreground" />
                                <span className="font-bold text-sm">{s.startTime}</span>
                                <span className="text-[10px] text-muted-foreground">({s.durationMinutes} min)</span>
                              </div>
                              <div className="mt-1">
                                <Badge variant="outline" className="text-[9px] h-4 font-normal bg-white">
                                  {getTargetName(s)}
                                </Badge>
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded-full transition-all"
                              onClick={() => handleRemove(s.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {slots?.length === 0 && (
                  <div className="p-20 text-center text-muted-foreground">
                    Nenhum horário configurado. Comece adicionando um lote ao lado.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
