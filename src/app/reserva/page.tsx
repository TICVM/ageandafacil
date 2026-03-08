
'use client';

import { useState, useEffect } from 'react';
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
import { CalendarIcon, Clock, MapPin, Sparkles, Loader2, CheckCircle2, Camera, User as UserIcon, Building2, Hash, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, serverTimestamp, addDoc, doc, query, where, getDocs, limit } from 'firebase/firestore';
import { AISessionBriefAssistantOutput, TimeSlot, Class, PhotoLocation, Segment, Booking, ScheduleBlock, User } from '@/lib/types';
import { aiSessionBriefAssistant } from '@/ai/flows/ai-session-brief-assistant-flow';
import { toast } from '@/hooks/use-toast';

export default function PublicBookingPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user: authUser } = useUser();
  
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
  
  // Estado para o perfil do professor logado
  const [profile, setProfile] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Queries base
  const classesQuery = useMemoFirebase(() => db ? collection(db, 'school_classes') : null, [db]);
  const locationsQuery = useMemoFirebase(() => db ? collection(db, 'photo_locations') : null, [db]);
  const slotsQuery = useMemoFirebase(() => db ? collection(db, 'available_time_slots') : null, [db]);
  const segmentsQuery = useMemoFirebase(() => db ? collection(db, 'school_segments') : null, [db]);
  const appointmentsQuery = useMemoFirebase(() => db ? collection(db, 'appointments') : null, [db]);
  const blocksQuery = useMemoFirebase(() => db ? collection(db, 'schedule_blocks') : null, [db]);

  const { data: rawClasses } = useCollection<Class>(classesQuery);
  const { data: rawLocations } = useCollection<PhotoLocation>(locationsQuery);
  const { data: slots } = useCollection<TimeSlot>(slotsQuery);
  const { data: rawSegments } = useCollection<Segment>(segmentsQuery);
  const { data: allAppointments } = useCollection<Booking>(appointmentsQuery);
  const { data: allBlocks } = useCollection<ScheduleBlock>(blocksQuery);

  // Carregar perfil para identificar turmas permitidas
  useEffect(() => {
    async function fetchProfile() {
      if (!db || !authUser) {
        setLoadingProfile(false);
        return;
      }
      
      try {
        const userEmail = authUser.email?.toLowerCase().trim();
        const userDocRef = doc(db, 'users', authUser.uid);
        const userDoc = await doc(db, 'users', authUser.uid);
        
        // Tentativa 1: Pelo UID
        const { data: pData } = await import('firebase/firestore').then(f => f.getDoc(userDocRef));
        
        if (pData.exists()) {
          const profileData = pData.data() as User;
          setProfile(profileData);
          setTeacherName(profileData.name || '');
        } else if (userEmail) {
          // Tentativa 2: Pelo e-mail (fallback robusto)
          const q = query(collection(db, 'users'), where('email', '==', userEmail), limit(1));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const profileData = snapshot.docs[0].data() as User;
            setProfile(profileData);
            setTeacherName(profileData.name || '');
          }
        }
      } catch (err) {
        console.error("Erro ao carregar perfil na reserva:", err);
      } finally {
        setLoadingProfile(false);
      }
    }
    fetchProfile();
  }, [db, authUser]);

  const segments = rawSegments ? [...rawSegments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];
  const locations = rawLocations || [];

  // FILTRAGEM DE TURMAS: Exibe apenas as turmas permitidas para o professor
  const filteredClasses = rawClasses?.filter(c => {
    // Se não houver perfil ou for ADMIN, vê tudo
    if (!profile || profile.role === 'ADMIN') return true;
    // Se for TEACHER, verifica a lista de Turmas Atribuídas (classIds)
    if (profile.role === 'TEACHER') {
      return profile.classIds?.includes(c.id);
    }
    return true;
  }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) || [];

  const selectedClass = filteredClasses?.find(c => c.id === selectedClassId);
  const selectedSegment = segments?.find(s => s.id === selectedClass?.schoolSegmentId);
  const selectedLocation = locations?.find(l => l.id === selectedLocationId);

  const filteredLocations = locations?.filter(l => {
    if (!l.isActive) return false;
    if (!selectedSegment || !selectedSegment.unit) return true;
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
    if (isTaken) return false;

    const isBlocked = allBlocks?.some(block => {
      if (block.date !== dateStr) return false;
      const timeToMin = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };
      const slotStart = timeToMin(s.startTime);
      const slotEnd = slotStart + (s.durationMinutes || 60);
      const blockStart = timeToMin(block.startTime);
      const blockEnd = timeToMin(block.endTime);
      return slotStart < blockEnd && slotEnd > blockStart;
    });

    return !isBlocked;
  }).sort((a, b) => a.startTime.localeCompare(b.startTime)) || [];

  const dayBlock = allBlocks?.find(b => date && b.date === format(date, 'yyyy-MM-dd'));

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
      teacherId: authUser?.uid || null,
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

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ECF1FA]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

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
            {dayBlock && (
              <div className="bg-destructive/10 border-2 border-destructive/20 p-6 rounded-3xl flex items-center gap-4 animate-in slide-in-from-top-2 duration-500">
                <div className="bg-destructive p-3 rounded-2xl">
                  <ShieldAlert className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-destructive">Dia com Restrições</h4>
                  <p className="text-sm text-destructive/80 font-medium">Atenção: Existem períodos bloqueados pela direção neste dia: <span className="underline">{dayBlock.reason}</span>.</p>
                </div>
              </div>
            )}

            <Card className="shadow-xl border-none overflow-hidden rounded-3xl">
              <CardHeader className="bg-primary text-primary-foreground p-6">
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Dados da Reserva
                </CardTitle>
                <CardDescription className="text-primary-foreground/80">
                  {profile?.role === 'TEACHER' ? 'Selecione uma de suas turmas atribuídas.' : 'Selecione a turma e o local da sessão.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6 bg-white">
                <div className="space-y-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <UserIcon className="w-4 h-4" /> Nome do Professor(a)
                  </label>
                  <Input 
                    placeholder="Seu nome completo" 
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    className="rounded-xl h-11"
                    readOnly={!!profile}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Turma</label>
                    <Select onValueChange={(val) => {
                      setSelectedClassId(val);
                      setSelectedLocationId('');
                    }} value={selectedClassId}>
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue placeholder="Selecione a turma" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredClasses.length > 0 ? (
                          filteredClasses.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))
                        ) : (
                          <div className="p-4 text-xs text-center text-muted-foreground">
                            Nenhuma turma atribuída ao seu perfil.
                          </div>
                        )}
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
                            {!date ? "Selecione uma data primeiro." : "Nenhum horário disponível para este dia."}
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
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 px-4 border-2 border-dashed border-accent/20 rounded-2xl">
                    <p className="text-xs text-muted-foreground italic">Escreva nas notas e clique em "Assistente IA" para detalhar sua ideia.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
