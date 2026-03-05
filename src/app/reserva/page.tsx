'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock, MapPin, Sparkles, Loader2, CheckCircle2, Camera, User, Building2, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, addDoc } from 'firebase/firestore';
import { AISessionBriefAssistantOutput, TimeSlot, Class, PhotoLocation, Segment, Booking } from '@/lib/types';
import { aiSessionBriefAssistant } from '@/ai/flows/ai-session-brief-assistant-flow';
import { toast } from '@/hooks/use-toast';

export default function PublicBookingPage() {
  const router = useRouter();
  const db = useFirestore();
  
  const [date, setDate] = useState<Date>();
  const [teacherName, setTeacherName] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [locationIdentifier, setLocationIdentifier] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiBrief, setAiBrief] = useState<AISessionBriefAssistantOutput | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const classesQuery = useMemoFirebase(() => db ? collection(db, 'school_classes') : null, [db]);
  const locationsQuery = useMemoFirebase(() => db ? collection(db, 'photo_locations') : null, [db]);
  const slotsQuery = useMemoFirebase(() => db ? collection(db, 'available_time_slots') : null, [db]);
  const segmentsQuery = useMemoFirebase(() => db ? collection(db, 'school_segments') : null, [db]);
  const appointmentsQuery = useMemoFirebase(() => db ? collection(db, 'appointments') : null, [db]);

  const { data: rawClasses } = useCollection<Class>(classesQuery);
  const { data: rawLocations } = useCollection<PhotoLocation>(locationsQuery);
  const { data: slots } = useCollection<TimeSlot>(slotsQuery);
  const { data: rawSegments } = useCollection<Segment>(segmentsQuery);
  const { data: allAppointments } = useCollection<Booking>(appointmentsQuery);

  const classes = rawClasses ? [...rawClasses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];
  const segments = rawSegments ? [...rawSegments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];
  const locations = rawLocations || [];

  const selectedClass = classes?.find(c => c.id === selectedClassId);
  const selectedSegment = segments?.find(s => s.id === selectedClass?.schoolSegmentId);
  
  const selectedLocation = locations?.find(l => l.id === selectedLocationId);

  // Filtro de locais baseado na unidade do segmento da turma
  const filteredLocations = locations?.filter(l => {
    if (!l.isActive) return false;
    
    // Se a turma não foi selecionada, mostra todos os locais ativos
    if (!selectedSegment || !selectedSegment.unit) return true;
    
    // Se o segmento tem unidade, filtra locais pela mesma unidade
    // Se o local não tem unidade definida, ele é considerado "global" e aparece para todos
    return !l.unit || l.unit.toLowerCase() === selectedSegment.unit.toLowerCase();
  }) || [];

  const availableSlots = slots?.filter(s => {
    if (!date) return false;
    
    const dayMatches = s.dayOfWeek === date.getDay().toString();
    if (!dayMatches) return false;

    const targetMatches = s.schoolClassId 
      ? s.schoolClassId === selectedClassId
      : s.schoolSegmentId 
        ? s.schoolSegmentId === selectedClass?.schoolSegmentId
        : !s.schoolClassId && !s.schoolSegmentId;
    
    if (!targetMatches) return false;

    const dateStr = format(date, 'yyyy-MM-dd');
    const isTaken = allAppointments?.some(app => 
      app.appointmentDate === dateStr && 
      app.startTime === s.startTime && 
      app.status === 'CONFIRMED'
    );

    return !isTaken;
  }).sort((a, b) => a.startTime.localeCompare(b.startTime)) || [];

  const handleGenerateAiBrief = async () => {
    if (!notes || !selectedClassId || !selectedLocationId) {
      toast({ title: "Dados incompletos", description: "Preencha a turma, local e suas notas primeiro.", variant: "destructive" });
      return;
    }
    setIsAiLoading(true);
    try {
      const result = await aiSessionBriefAssistant({
        briefNotes: notes,
        className: selectedClass?.name || 'Turma não identificada',
        segmentName: selectedSegment?.name || 'Geral',
        locationName: selectedLocation?.name || 'Local não identificado',
      });
      setAiBrief(result);
      toast({ title: "Briefing gerado com sucesso!" });
    } catch (error) {
      toast({ title: "Erro ao gerar briefing", variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSchedule = () => {
    if (!date || !selectedClassId || !selectedLocationId || !selectedSlotId || !teacherName || !db) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }
    
    if (selectedLocation?.requiresIdentifier && !locationIdentifier) {
      toast({ title: "Campo faltante", description: "Por favor, identifique qual sala ou laboratório será usado.", variant: "destructive" });
      return;
    }

    const slot = slots?.find(s => s.id === selectedSlotId);
    if (!slot) return;

    const [h, m] = slot.startTime.split(':').map(Number);
    const endTotal = h * 60 + m + (slot.durationMinutes || 60);
    const endH = Math.floor(endTotal / 60).toString().padStart(2, '0');
    const endM = (endTotal % 60).toString().padStart(2, '0');

    const appointmentData = {
      schoolClassId: selectedClassId,
      teacherName: teacherName,
      photoLocationId: selectedLocationId,
      locationIdentifier: locationIdentifier || null,
      appointmentDate: format(date, 'yyyy-MM-dd'),
      startTime: slot.startTime,
      endTime: `${endH}:${endM}`,
      sessionDurationMinutes: slot.durationMinutes || 60,
      status: 'CONFIRMED',
      observations: notes,
      aiBrief: aiBrief || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    addDoc(collection(db, 'appointments'), appointmentData).then(() => {
      setIsSuccess(true);
      toast({ title: "Reserva Confirmada!" });
    }).catch((e) => {
      toast({ title: "Erro ao reservar", description: e.message, variant: "destructive" });
    });
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#ECF1FA] flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-2xl border-none rounded-3xl overflow-hidden animate-in zoom-in-95 duration-500">
          <div className="bg-primary p-8 text-center text-primary-foreground">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-3xl font-bold">Sucesso!</h2>
            <p className="opacity-90">Sua reserva foi concluída e enviada para o marketing.</p>
          </div>
          <CardContent className="p-8 space-y-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Professor:</span>
              <span className="font-bold">{teacherName}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Turma:</span>
              <span className="font-bold">{selectedClass?.name}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Local:</span>
              <div className="flex flex-col items-end">
                <span className="font-bold">{selectedLocation?.name}</span>
                {locationIdentifier && <span className="text-xs text-primary font-bold">({locationIdentifier})</span>}
              </div>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Data:</span>
              <span className="font-bold">{date && format(date, 'dd/MM/yyyy')}</span>
            </div>
            <Button onClick={() => window.location.reload()} className="w-full rounded-xl h-12 mt-4">
              Fazer outra reserva
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#ECF1FA] py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="bg-primary p-4 rounded-2xl shadow-lg mb-2">
            <Camera className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-primary">SchoolLens</h1>
          <p className="text-muted-foreground text-lg">Agendamento de Fotos Escolares</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <Card className="shadow-xl border-none overflow-hidden rounded-3xl">
              <CardHeader className="bg-primary text-primary-foreground p-6">
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Dados da Reserva
                </CardTitle>
                <CardDescription className="text-primary-foreground/80">Selecione sua turma e o melhor horário.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6 bg-white">
                <div className="space-y-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <User className="w-4 h-4" /> Nome do Professor(a)
                  </label>
                  <Input 
                    placeholder="Seu nome completo" 
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    className="rounded-xl h-11"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Turma</label>
                    <Select onValueChange={(val) => {
                      setSelectedClassId(val);
                      setSelectedLocationId(''); // Reseta o local ao trocar de turma para re-filtrar
                    }} value={selectedClassId}>
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue placeholder="Selecione a turma" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes?.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Local da Foto</label>
                    <Select onValueChange={setSelectedLocationId} value={selectedLocationId} disabled={!selectedClassId}>
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue placeholder={!selectedClassId ? "Escolha a turma primeiro" : "Selecione o local"} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredLocations.length > 0 ? (
                          filteredLocations.map(l => (
                            <SelectItem key={l.id} value={l.id}>
                              <div className="flex flex-col items-start leading-none">
                                <span>{l.name}</span>
                                {l.unit && <span className="text-[10px] text-muted-foreground mt-0.5">{l.unit}</span>}
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-4 text-xs text-center text-muted-foreground">Nenhum local disponível para esta unidade.</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedLocation?.requiresIdentifier && (
                  <div className="space-y-2 bg-primary/5 p-4 rounded-2xl border border-primary/10 animate-in slide-in-from-left-2 duration-300">
                    <label className="text-sm font-bold flex items-center gap-2 text-primary">
                      <Hash className="w-4 h-4" /> Qual sala ou número?
                    </label>
                    <Input 
                      placeholder="Ex: Sala 12, Lab 2, Sala do Infantil..." 
                      value={locationIdentifier}
                      onChange={(e) => setLocationIdentifier(e.target.value)}
                      className="rounded-xl h-11 bg-white"
                    />
                    <p className="text-[10px] text-muted-foreground">Este local possui múltiplas unidades. Por favor, especifique qual usará.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Data</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full h-11 justify-start text-left font-normal rounded-xl",
                            !date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {date ? format(date, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={date}
                          onSelect={setDate}
                          locale={ptBR}
                          initialFocus
                          disabled={(d) => d < new Date() || d > new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Horário Disponível</label>
                    <Select onValueChange={setSelectedSlotId} value={selectedSlotId} disabled={!date || !selectedClassId}>
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue placeholder={!selectedClassId ? "Escolha a turma primeiro" : date ? "Selecione o horário" : "Escolha a data"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSlots.length > 0 ? (
                          availableSlots.map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                {s.startTime} ({s.durationMinutes} min)
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-4 text-xs text-center text-muted-foreground">
                            {!date ? "Selecione uma data primeiro." : "Todos os horários ocupados ou não disponíveis para este dia."}
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold">Observações (Opcional)</label>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="text-primary hover:text-primary/80 gap-1 rounded-lg"
                      onClick={handleGenerateAiBrief}
                      disabled={isAiLoading || !notes}
                    >
                      {isAiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Assistente IA
                    </Button>
                  </div>
                  <Textarea 
                    placeholder="Ex: Alunos estarão fantasiados..."
                    className="rounded-xl min-h-[120px] bg-muted/20"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 p-8 flex justify-center">
                <Button onClick={handleSchedule} className="w-full max-w-sm rounded-2xl h-14 bg-primary text-xl font-bold shadow-lg hover:scale-105 transition-transform">
                  CONCLUIR RESERVA
                </Button>
              </CardFooter>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-xl bg-accent/5 overflow-hidden rounded-3xl">
              <CardHeader className="p-6">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent-foreground" />
                  Briefing Automático
                </CardTitle>
                <CardDescription>Gerado pela nossa IA para o Marketing.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                {aiBrief ? (
                  <div className="space-y-4 animate-in zoom-in-95 duration-300">
                    <div className="p-4 bg-white rounded-2xl border border-accent/20 shadow-sm space-y-3">
                      <h4 className="font-bold text-accent-foreground text-sm">Contexto:</h4>
                      <p className="text-xs leading-relaxed text-muted-foreground">{aiBrief.detailedBrief}</p>
                      <h4 className="font-bold text-accent-foreground text-sm">Atividades:</h4>
                      <ul className="text-xs space-y-1">
                        {aiBrief.keyActivities.slice(0, 3).map((act, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3 text-green-500" /> {act}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 px-4 border-2 border-dashed border-accent/20 rounded-2xl">
                    <p className="text-xs text-muted-foreground italic">Escreva nas notas e clique em "Assistente IA" para detalhar sua ideia.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-primary/5 rounded-3xl">
              <CardContent className="p-6 space-y-3">
                <h3 className="font-bold text-primary flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Dica do Local
                </h3>
                {selectedLocation && (
                  <div className="flex flex-col gap-1 mb-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                      <Building2 className="w-3 h-3" />
                      {selectedLocation.unit || 'Unidade não informada'}
                    </div>
                    {selectedLocation.requiresIdentifier && (
                      <Badge variant="secondary" className="w-fit text-[9px] h-4">Requer Identificação</Badge>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {selectedLocationId 
                    ? locations?.find(l => l.id === selectedLocationId)?.description 
                    : "Escolha um local para ver dicas importantes."}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
