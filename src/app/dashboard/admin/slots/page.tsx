'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, Plus, Trash2, CalendarDays, Loader2, Users, Layers, Globe } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { toast } from '@/hooks/use-toast';
import { TimeSlot, Class, Segment } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

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
  
  // Dados do Firestore
  const slotsRef = useMemoFirebase(() => db ? collection(db, 'available_time_slots') : null, [db]);
  const classesRef = useMemoFirebase(() => db ? collection(db, 'school_classes') : null, [db]);
  const segmentsRef = useMemoFirebase(() => db ? collection(db, 'school_segments') : null, [db]);

  const { data: slots, isLoading: loadingSlots } = useCollection<TimeSlot>(slotsRef);
  const { data: classes } = useCollection<Class>(classesRef);
  const { data: segments } = useCollection<Segment>(segmentsRef);

  // Estado do Formulário
  const [selectedDays, setSelectedDays] = useState<string[]>(['1', '2', '3', '4', '5']);
  const [startTime, setStartTime] = useState('08:00');
  const [duration, setDuration] = useState('60');
  const [targetType, setTargetType] = useState<'global' | 'segment' | 'class'>('global');
  const [targetId, setTargetId] = useState('');
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
      toast({ title: "Erro", description: "Selecione o segmento ou turma alvo.", variant: "destructive" });
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
          isActive: true,
          createdAt: new Date().toISOString()
        });
      });

      await batch.commit();
      toast({ title: "Horários Criados", description: `${selectedDays.length} horários configurados com sucesso.` });
    } catch (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
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
        <p className="text-muted-foreground">Configure os intervalos de fotos para cada turma ou segmento.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulário de Configuração em Lote */}
        <Card className="lg:col-span-1 shadow-md border-none h-fit">
          <CardHeader>
            <CardTitle className="text-xl">Configurar em Lote</CardTitle>
            <CardDescription>Adicione o mesmo horário para vários dias.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-semibold">Dias da Semana</label>
              <div className="grid grid-cols-2 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day.id} className="flex items-center space-x-2 bg-muted/30 p-2 rounded-lg">
                    <Checkbox 
                      id={`day-${day.id}`} 
                      checked={selectedDays.includes(day.id)}
                      onCheckedChange={() => handleToggleDay(day.id)}
                    />
                    <label htmlFor={`day-${day.id}`} className="text-xs cursor-pointer">{day.label}</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Início</label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Duração (min)</label>
                <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-sm font-semibold">Aplicar para:</label>
              <div className="grid grid-cols-3 gap-2">
                <Button 
                  variant={targetType === 'global' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => { setTargetType('global'); setTargetId(''); }}
                  className="rounded-lg text-[10px]"
                >
                  <Globe className="w-3 h-3 mr-1" /> Global
                </Button>
                <Button 
                  variant={targetType === 'segment' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => { setTargetType('segment'); setTargetId(''); }}
                  className="rounded-lg text-[10px]"
                >
                  <Layers className="w-3 h-3 mr-1" /> Segmento
                </Button>
                <Button 
                  variant={targetType === 'class' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => { setTargetType('class'); setTargetId(''); }}
                  className="rounded-lg text-[10px]"
                >
                  <Users className="w-3 h-3 mr-1" /> Turma
                </Button>
              </div>

              {targetType === 'segment' && (
                <Select onValueChange={setTargetId} value={targetId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Escolha o Segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    {segments?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              {targetType === 'class' && (
                <Select onValueChange={setTargetId} value={targetId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Escolha a Turma" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button onClick={handleBatchAdd} className="w-full rounded-xl gap-2 h-11 shadow-lg" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4" />}
              Gerar Grade
            </Button>
          </CardContent>
        </Card>

        {/* Visualização da Grade Atual */}
        <Card className="lg:col-span-2 shadow-md border-none overflow-hidden bg-white">
          <CardHeader className="bg-muted/10">
            <CardTitle className="text-xl">Grade Atual</CardTitle>
            <CardDescription>Horários ativos no sistema.</CardDescription>
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
                          <div key={s.id} className="bg-muted/20 p-3 rounded-xl border flex justify-between items-center group hover:bg-white transition-colors">
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
