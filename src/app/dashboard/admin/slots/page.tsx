
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, Plus, Trash2, CalendarDays, Loader2, Users, Layers, Globe, Copy, ShieldAlert, CalendarIcon } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { toast } from '@/hooks/use-toast';
import { TimeSlot, Class, Segment, ScheduleBlock } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

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
  const blocksRef = useMemoFirebase(() => db ? collection(db, 'schedule_blocks') : null, [db]);

  const { data: slots, isLoading: loadingSlots } = useCollection<TimeSlot>(slotsRef);
  const { data: rawClasses } = useCollection<Class>(classesRef);
  const { data: rawSegments } = useCollection<Segment>(segmentsRef);
  const { data: blocks, isLoading: loadingBlocks } = useCollection<ScheduleBlock>(blocksRef);

  const sortedSegments = rawSegments ? [...rawSegments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];
  const sortedClasses = rawClasses ? [...rawClasses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];

  // Estado do Criador Individual/Lote
  const [selectedDays, setSelectedDays] = useState<string[]>(['1', '2', '3', '4', '5']);
  const [startTime, setStartTime] = useState('08:00');
  const [duration, setDuration] = useState('60');
  const [targetType, setTargetType] = useState<'global' | 'segment' | 'class'>('global');
  const [targetId, setTargetId] = useState('');
  
  // Estado do Bloqueio
  const [blockDate, setBlockDate] = useState<Date>();
  const [blockStart, setBlockStart] = useState('07:00');
  const [blockEnd, setBlockEnd] = useState('18:00');
  const [blockReason, setBlockReason] = useState('');

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

  const handleAddBlock = () => {
    if (!db || !blockDate || !blockReason) {
      toast({ title: "Erro", description: "Preencha a data e o motivo do bloqueio.", variant: "destructive" });
      return;
    }

    addDocumentNonBlocking(collection(db, 'schedule_blocks'), {
      date: format(blockDate, 'yyyy-MM-dd'),
      startTime: blockStart,
      endTime: blockEnd,
      reason: blockReason,
      createdAt: serverTimestamp()
    });

    setBlockReason('');
    toast({ title: "Período Bloqueado", description: "Ninguém poderá reservar fotos neste intervalo." });
  };

  const handleRemoveBlock = (id: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'schedule_blocks', id));
    toast({ title: "Bloqueio Removido" });
  };

  const handleRemoveSlot = (id: string) => {
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
        <h1 className="text-3xl font-bold tracking-tight">Grade e Bloqueios</h1>
        <p className="text-muted-foreground">Gerencie a estrutura de horários e eventos que impedem fotos.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-white p-1 border shadow-sm">
              <TabsTrigger value="create" className="rounded-lg">Novo Horário</TabsTrigger>
              <TabsTrigger value="block" className="rounded-lg">Bloquear Data</TabsTrigger>
            </TabsList>
            
            <TabsContent value="create">
              <Card className="shadow-md border-none">
                <CardHeader>
                  <CardTitle className="text-lg">Gerar Grade</CardTitle>
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
                    Adicionar à Grade
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="block">
              <Card className="shadow-md border-none border-t-4 border-t-destructive">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-destructive" />
                    Travar Período
                  </CardTitle>
                  <CardDescription>Crie uma reserva administrativa para bloquear o dia/hora.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold">Data do Evento</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full h-10 justify-start text-left font-normal rounded-xl",
                            !blockDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {blockDate ? format(blockDate, "dd/MM/yyyy") : <span>Escolha a data</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={blockDate}
                          onSelect={setBlockDate}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold">Bloquear De:</label>
                      <Input type="time" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} className="rounded-xl h-10" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold">Até:</label>
                      <Input type="time" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} className="rounded-xl h-10" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold">Motivo do Bloqueio</label>
                    <Input 
                      placeholder="Ex: Reunião Pedagógica, Feriado..." 
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      className="rounded-xl h-10"
                    />
                  </div>

                  <Button onClick={handleAddBlock} variant="destructive" className="w-full rounded-xl gap-2 shadow-lg">
                    <ShieldAlert className="w-4 h-4" />
                    Ativar Bloqueio
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card className="shadow-md border-none overflow-hidden bg-white">
            <CardHeader className="bg-destructive/5 py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-destructive" />
                Bloqueios Ativos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingBlocks ? (
                <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-destructive" /></div>
              ) : blocks && blocks.length > 0 ? (
                <div className="divide-y max-h-[300px] overflow-auto">
                  {blocks.sort((a,b) => a.date.localeCompare(b.date)).map(b => (
                    <div key={b.id} className="p-4 flex justify-between items-center hover:bg-muted/10 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{format(new Date(b.date + 'T00:00:00'), 'dd/MM/yy')}</span>
                        <span className="text-[10px] text-muted-foreground">{b.startTime} - {b.endTime}</span>
                        <span className="text-xs font-medium text-destructive mt-1">{b.reason}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveBlock(b.id)} className="text-destructive rounded-full hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center text-xs text-muted-foreground">Nenhum bloqueio cadastrado.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2 shadow-md border-none overflow-hidden bg-white">
          <CardHeader className="bg-muted/10">
            <CardTitle className="text-xl">Grade de Horários</CardTitle>
            <CardDescription>Visualize e remova horários padrão por dia.</CardDescription>
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
                                onClick={() => handleRemoveSlot(s.id)}
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
