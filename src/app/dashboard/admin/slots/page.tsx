
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, Plus, Trash2, Loader2, ListPlus, Save, Timer, AlertCircle, CalendarIcon, ShieldAlert } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp, setDoc } from 'firebase/firestore';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { toast } from '@/hooks/use-toast';
import { TimeSlot, Class, Segment, ScheduleBlock, AppSettings } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
  const settingsRef = useMemoFirebase(() => db ? doc(db, 'app_settings', 'general') : null, [db]);

  const { data: slots, isLoading: loadingSlots } = useCollection<TimeSlot>(slotsRef);
  const { data: rawClasses } = useCollection<Class>(classesRef);
  const { data: rawSegments } = useCollection<Segment>(segmentsRef);
  const { data: blocks, isLoading: loadingBlocks } = useCollection<ScheduleBlock>(blocksRef);
  const { data: appSettings } = useDoc<AppSettings>(settingsRef);

  const sortedSegments = rawSegments ? [...rawSegments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];
  const sortedClasses = rawClasses ? [...rawClasses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];

  const [selectedDays, setSelectedDays] = useState<string[]>(['1', '2', '3', '4', '5']);
  const [startTime, setStartTime] = useState('08:00');
  const [duration, setDuration] = useState('60');
  const [targetType, setTargetType] = useState<'global' | 'segment' | 'class'>('global');
  const [targetId, setTargetId] = useState('');
  
  const [blockDate, setBlockDate] = useState<Date>();
  const [blockMultipleDates, setBlockMultipleDates] = useState<Date[]>([]);
  const [blockStart, setBlockStart] = useState('07:00');
  const [blockEnd, setBlockEnd] = useState('18:00');
  const [blockReason, setBlockReason] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkDatesText, setBulkDatesText] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isSavingRules, setIsSavingRules] = useState(false);

  // Advance Rules State
  const [bookingDays, setBookingDays] = useState(1);
  const [bookingHours, setBookingHours] = useState(0);

  useEffect(() => {
    if (appSettings) {
      setBookingDays(appSettings.minAdvanceBookingDays ?? 1);
      setBookingHours(appSettings.minAdvanceBookingHours ?? 0);
    }
  }, [appSettings]);

  const handleSaveRules = async () => {
    if (!db || !settingsRef) return;
    setIsSavingRules(true);
    try {
      await setDoc(settingsRef, {
        minAdvanceBookingDays: bookingDays,
        minAdvanceBookingHours: bookingHours,
      }, { merge: true });
      toast({ title: "Regras Atualizadas" });
    } catch (e) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsSavingRules(false);
    }
  };

  const handleToggleDay = (dayId: string) => {
    setSelectedDays(prev => 
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
    );
  };

  const handleBatchAdd = async () => {
    if (!db || selectedDays.length === 0) {
      toast({ title: "Selecione ao menos um dia", variant: "destructive" });
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

  const handleAddBlock = async () => {
    if (!db || !blockReason) {
      toast({ title: "Preencha o motivo", variant: "destructive" });
      return;
    }

    const datesToBlock = isBulkMode ? blockMultipleDates : (blockDate ? [blockDate] : []);

    if (datesToBlock.length === 0) {
      toast({ title: "Escolha as datas", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const blocksCol = collection(db, 'schedule_blocks');

      datesToBlock.forEach(d => {
        const newRef = doc(blocksCol);
        batch.set(newRef, {
          date: format(d, 'yyyy-MM-dd'),
          startTime: blockStart,
          endTime: blockEnd,
          reason: blockReason,
          createdAt: serverTimestamp()
        });
      });

      await batch.commit();
      toast({ title: "Bloqueio Realizado" });
      setBlockReason('');
      setBlockDate(undefined);
      setBlockMultipleDates([]);
    } catch (e) {
      toast({ title: "Erro ao bloquear", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleProcessBulkText = () => {
    if (!bulkDatesText.trim()) return;
    const lines = bulkDatesText.split('\n');
    const parsedDates: Date[] = [];
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        let d: Date;
        if (trimmed.includes('/')) d = parse(trimmed, 'dd/MM/yyyy', new Date());
        else d = parse(trimmed, 'yyyy-MM-dd', new Date());
        if (!isNaN(d.getTime())) parsedDates.push(d);
      } catch (e) {}
    });

    if (parsedDates.length > 0) {
      setBlockMultipleDates(prev => [...prev, ...parsedDates]);
      setIsBulkMode(true);
      setIsBulkImportOpen(false);
      setBulkDatesText('');
      toast({ title: `${parsedDates.length} datas identificadas.` });
    }
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Grade e Bloqueios</h1>
          <p className="text-muted-foreground">Gerencie a estrutura de horários e as regras de antecedência.</p>
        </div>
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
                <CardHeader><CardTitle className="text-lg">Gerar Grade</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-4 gap-1">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day.id} className="flex flex-col items-center p-2 rounded-lg border bg-muted/10">
                        <Checkbox 
                          id={`day-chk-${day.id}`} 
                          name={`day-${day.id}`}
                          checked={selectedDays.includes(day.id)}
                          onCheckedChange={() => handleToggleDay(day.id)}
                        />
                        <Label htmlFor={`day-chk-${day.id}`} className="text-[9px] mt-1 font-bold cursor-pointer">{day.short}</Label>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="slot-start-input" className="text-xs font-bold">Início</Label>
                      <Input id="slot-start-input" name="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-xl h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slot-duration-input" className="text-xs font-bold">Duração (min)</Label>
                      <Input id="slot-duration-input" name="duration" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="rounded-xl h-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Alvo</Label>
                    <div className="flex gap-1 mb-2">
                      <Button variant={targetType === 'global' ? 'default' : 'outline'} size="sm" onClick={() => { setTargetType('global'); setTargetId(''); }} className="text-[10px] h-8 flex-1">Global</Button>
                      <Button variant={targetType === 'segment' ? 'default' : 'outline'} size="sm" onClick={() => { setTargetType('segment'); setTargetId(''); }} className="text-[10px] h-8 flex-1">Segmento</Button>
                      <Button variant={targetType === 'class' ? 'default' : 'outline'} size="sm" onClick={() => { setTargetType('class'); setTargetId(''); }} className="text-[10px] h-8 flex-1">Turma</Button>
                    </div>
                    {targetType !== 'global' && (
                      <Select onValueChange={setTargetId} value={targetId}>
                        <SelectTrigger id="slot-target-select" name="target" className="rounded-xl h-10">
                          <SelectValue placeholder={targetType === 'segment' ? "Escolha o Segmento" : "Escolha a Turma"} />
                        </SelectTrigger>
                        <SelectContent>
                          {targetType === 'segment' ? sortedSegments.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>) : sortedClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-destructive" /> Travar Período</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setIsBulkImportOpen(true)} className="h-8 rounded-lg text-primary text-[10px] font-bold"><ListPlus className="w-3 h-3 mr-1" /> Importar Lista</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={isBulkMode ? "default" : "outline"} className="cursor-pointer rounded-lg text-[10px]" onClick={() => { setIsBulkMode(p => !p); if (!isBulkMode) setBlockDate(undefined); else setBlockMultipleDates([]); }}>{isBulkMode ? "Múltiplas Datas Ativado" : "Clique para selecionar várias"}</Badge>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="block-date-popover-trigger" className="text-xs font-bold">Data(s) do Evento</Label>
                    <Popover modal={false}>
                      <PopoverTrigger asChild>
                        <Button id="block-date-popover-trigger" name="blockDate" variant="outline" className={cn("w-full h-10 justify-start rounded-xl", ((!isBulkMode && !blockDate) || (isBulkMode && blockMultipleDates.length === 0)) && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {isBulkMode ? (blockMultipleDates.length > 0 ? `${blockMultipleDates.length} datas` : "Escolha as datas") : (blockDate ? format(blockDate, "dd/MM/yyyy") : "Escolha a data")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        {isBulkMode ? <Calendar mode="multiple" selected={blockMultipleDates} onSelect={setBlockMultipleDates} locale={ptBR} /> : <Calendar mode="single" selected={blockDate} onSelect={setBlockDate} locale={ptBR} />}
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="block-start-input" className="text-xs font-bold">Bloquear De:</Label>
                      <Input id="block-start-input" name="blockStart" type="time" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} className="rounded-xl h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="block-end-input" className="text-xs font-bold">Até:</Label>
                      <Input id="block-end-input" name="blockEnd" type="time" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} className="rounded-xl h-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="block-reason-input" className="text-xs font-bold">Motivo do Bloqueio</Label>
                    <Input id="block-reason-input" name="reason" placeholder="Ex: Feriado, Reunião..." value={blockReason} onChange={(e) => setBlockReason(e.target.value)} className="rounded-xl h-10" />
                  </div>
                  <Button onClick={handleAddBlock} variant="destructive" className="w-full rounded-xl gap-2" disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                    {isBulkMode ? `Bloquear ${blockMultipleDates.length} Dias` : "Ativar Bloqueio"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card className="shadow-md border-none overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 py-4"><CardTitle className="text-sm font-bold flex items-center gap-2"><Timer className="w-4 h-4 text-primary" /> Regras de Antecedência</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest border-b pb-1">Novas Reservas</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="booking-days-input" className="text-[10px] font-bold">Dias</Label>
                    <Input id="booking-days-input" name="bookingDays" type="number" value={bookingDays} onChange={(e) => setBookingDays(parseInt(e.target.value) || 0)} className="h-9 rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="booking-hours-input" className="text-[10px] font-bold">Horas</Label>
                    <Input id="booking-hours-input" name="bookingHours" type="number" value={bookingHours} onChange={(e) => setBookingHours(parseInt(e.target.value) || 0)} className="h-9 rounded-lg" />
                  </div>
                </div>
              </div>
              <Button onClick={handleSaveRules} className="w-full rounded-xl gap-2 h-11" disabled={isSavingRules}>
                {isSavingRules ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                Salvar Regras
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2 shadow-md border-none overflow-hidden bg-white">
          <CardHeader className="bg-muted/10">
            <CardTitle className="text-xl">Gestão da Agenda</CardTitle>
            <CardDescription>Visualize a grade padrão e as datas bloqueadas.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Tabs defaultValue="slots" className="w-full">
              <TabsList className="flex gap-1 bg-muted/20 p-1 mb-6 rounded-xl border w-full sm:w-fit">
                <TabsTrigger value="slots" className="rounded-lg px-6"><Clock className="w-4 h-4 mr-2" /> Grade Padrão</TabsTrigger>
                <TabsTrigger value="blocks" className="rounded-lg px-6"><ShieldAlert className="w-4 h-4 mr-2" /> Datas Bloqueadas</TabsTrigger>
              </TabsList>

              <TabsContent value="slots" className="space-y-6">
                {loadingSlots ? <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-primary" /></div> : (
                  <Tabs defaultValue="1" className="w-full">
                    <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/5 p-1 mb-6 rounded-xl border">
                      {DAYS_OF_WEEK.map(d => <TabsTrigger key={d.id} value={d.id} className="rounded-lg flex-1 text-xs py-2">{d.short}</TabsTrigger>)}
                    </TabsList>
                    {DAYS_OF_WEEK.map(d => {
                      const daySlots = slots?.filter(s => s.dayOfWeek === d.id) || [];
                      return (
                        <TabsContent key={d.id} value={d.id}>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {daySlots.length > 0 ? daySlots.sort((a,b) => a.startTime.localeCompare(b.startTime)).map(s => (
                              <div key={s.id} className="bg-muted/10 p-4 rounded-xl border flex justify-between items-center group hover:bg-white transition-all shadow-sm">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-muted-foreground" /><span className="font-bold">{s.startTime}</span><span className="text-xs text-muted-foreground">({s.durationMinutes} min)</span></div>
                                  <div className="mt-2"><Badge variant="outline" className="text-[10px] bg-white border-primary/20 text-primary">{getTargetName(s)}</Badge></div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleRemoveSlot(s.id)} aria-label="Remover horário"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            )) : <div className="p-10 text-center text-muted-foreground border-2 border-dashed rounded-2xl col-span-2">Nenhum horário padrão para este dia.</div>}
                          </div>
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                )}
              </TabsContent>

              <TabsContent value="blocks">
                {loadingBlocks ? <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-primary" /></div> : (
                  <div className="space-y-4">
                    {blocks && blocks.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="font-bold">Data</TableHead>
                            <TableHead className="font-bold">Horário</TableHead>
                            <TableHead className="font-bold">Motivo</TableHead>
                            <TableHead className="text-right font-bold">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {blocks.sort((a,b) => b.date.localeCompare(a.date)).map(b => (
                            <TableRow key={b.id} className="hover:bg-muted/5">
                              <TableCell className="font-medium">{format(new Date(b.date + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                              <TableCell className="text-xs font-mono">{b.startTime} - {b.endTime}</TableCell>
                              <TableCell><Badge variant="secondary" className="font-normal">{b.reason}</Badge></TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="text-destructive rounded-full hover:bg-destructive/10" onClick={() => handleRemoveBlock(b.id)} aria-label="Remover bloqueio"><Trash2 className="w-4 h-4" /></Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="p-20 text-center text-muted-foreground border-2 border-dashed rounded-3xl flex flex-col items-center gap-3">
                        <AlertCircle className="w-8 h-8 opacity-20" />
                        <p>Nenhuma data bloqueada no momento.</p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Importar Lista de Datas</DialogTitle>
            <DialogDescription>Cole datas separadas por linha para bloquear em massa no sistema.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="bulk-dates-input">Lista de Datas</Label>
            <Textarea id="bulk-dates-input" name="bulkDates" placeholder="01/01/2025&#10;02/01/2025" className="rounded-xl min-h-[200px] mt-2" value={bulkDatesText} onChange={(e) => setBulkDatesText(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkImportOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleProcessBulkText} className="rounded-xl">Identificar Datas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
