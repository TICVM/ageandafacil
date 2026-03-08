
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
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, serverTimestamp, addDoc, doc, query, where, getDocs, limit, getDoc } from 'firebase/firestore';
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
  
  const [profile, setProfile] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

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

  useEffect(() => {
    async function fetchProfile() {
      if (!db || !authUser) {
        setLoadingProfile(false);
        return;
      }
      try {
        const userDocRef = doc(db, 'users', authUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const profileData = userDoc.data() as User;
          setProfile(profileData);
          setTeacherName(profileData.name || '');
        } else if (authUser.email) {
          const q = query(collection(db, 'users'), where('email', '==', authUser.email.toLowerCase().trim()), limit(1));
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

  // LÓGICA DE FILTRAGEM DE TURMAS POR PAPEL
  const filteredClasses = rawClasses?.filter(c => {
    if (!profile || profile.role === 'ADMIN') return true;
    
    // Coordenador: Vê turmas do seu segmento
    if (profile.role === 'COORDINATOR') {
      return c.schoolSegmentId === profile.segmentId;
    }
    
    // Professor: Vê suas turmas atribuídas
    if (profile.role === 'TEACHER') {
      return profile.classIds?.includes(c.id);
    }
    
    return false;
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
      toast({ title: "Dados incompletos", variant: "destructive" });
      return;
    }
    setIsAiLoading(true);
    try {
      const result = await aiSessionBriefAssistant({
        briefNotes: notes,
        className: selectedClass?.name || 'Turma',
        segmentName: selectedSegment?.name || 'Geral',
        locationName: selectedLocation?.name || 'Local',
      });
      setAiBrief(result);
      toast({ title: "Briefing gerado!" });
    } catch (error) {
      toast({ title: "Erro na IA", variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSchedule = () => {
    if (!date || !selectedClassId || !selectedLocationId || !selectedSlotId || !teacherName || !db) {
      toast({ title: "Erro", description: "Preencha tudo.", variant: "destructive" });
      return;
    }
    
    const slot = slots?.find(s => s.id === selectedSlotId);
    if (!slot) return;

    const [h, m] = slot.startTime.split(':').map(Number);
    const endTotal = h * 60 + m + (slot.durationMinutes || 60);
    const endH = Math.floor(endTotal / 60).toString().padStart(2, '0');
    const endM = (endTotal % 60).toString().padStart(2, '0');

    addDoc(collection(db, 'appointments'), {
      schoolClassId: selectedClassId,
      teacherId: authUser?.uid || null,
      teacherName: teacherName,
      photoLocationId: selectedLocationId,
      locationIdentifier: locationIdentifier || null,
      appointmentDate: format(date, 'yyyy-MM-dd'),
      startTime: slot.startTime,
      endTime: `${endH}:${endM}`,
      status: 'CONFIRMED',
      observations: notes,
      aiBrief: aiBrief || null,
      createdAt: serverTimestamp(),
    }).then(() => {
      setIsSuccess(true);
    });
  };

  if (loadingProfile) return <div className="min-h-screen flex items-center justify-center bg-[#ECF1FA]"><Loader2 className="animate-spin text-primary" /></div>;

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#ECF1FA] flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-2xl rounded-3xl overflow-hidden">
          <div className="bg-primary p-8 text-center text-primary-foreground">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-3xl font-bold">Reserva Concluída!</h2>
          </div>
          <CardContent className="p-8 space-y-4">
            <div className="flex justify-between border-b pb-2"><span>Turma:</span><span className="font-bold">{selectedClass?.name}</span></div>
            <div className="flex justify-between border-b pb-2"><span>Data:</span><span className="font-bold">{date && format(date, 'dd/MM/yyyy')}</span></div>
            <Button onClick={() => window.location.reload()} className="w-full rounded-xl h-12 mt-4">Fazer outra reserva</Button>
            <Button variant="ghost" onClick={() => router.push('/dashboard')} className="w-full">Ir para o Painel</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#ECF1FA] py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="bg-primary p-4 rounded-2xl shadow-lg mb-2"><Camera className="w-10 h-10 text-primary-foreground" /></div>
          <h1 className="text-4xl font-bold text-primary">SchoolLens</h1>
          <p className="text-muted-foreground">{profile?.role === 'TEACHER' ? 'Minhas Turmas Atribuídas' : profile?.role === 'COORDINATOR' ? `Coordenação: ${segments?.find(s => s.id === profile.segmentId)?.name}` : 'Painel de Reserva Master'}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {dayBlock && (
              <div className="bg-destructive/10 border-2 border-destructive/20 p-6 rounded-3xl flex items-center gap-4">
                <ShieldAlert className="w-6 h-6 text-destructive" />
                <p className="text-sm text-destructive font-medium">Bloqueio Administrativo: {dayBlock.reason}</p>
              </div>
            )}

            <Card className="shadow-xl border-none rounded-3xl overflow-hidden">
              <CardHeader className="bg-primary text-primary-foreground p-6">
                <CardTitle className="flex items-center gap-2"><CalendarIcon className="w-5 h-5" /> Reserva de Sessão</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6 bg-white">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Nome do Responsável</label>
                  <Input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} className="rounded-xl h-11" readOnly={!!profile} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Turma</label>
                    <Select onValueChange={(val) => { setSelectedClassId(val); setSelectedLocationId(''); }} value={selectedClassId}>
                      <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
                      <SelectContent>
                        {filteredClasses.length > 0 ? filteredClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>) : <div className="p-4 text-xs text-center">Nenhuma turma disponível.</div>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Local da Foto</label>
                    <Select onValueChange={setSelectedLocationId} value={selectedLocationId} disabled={!selectedClassId}>
                      <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione o local" /></SelectTrigger>
                      <SelectContent>
                        {filteredLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedLocation?.requiresIdentifier && (
                  <div className="space-y-2 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                    <label className="text-sm font-bold flex items-center gap-2 text-primary"><Hash className="w-4 h-4" /> Qual sala ou número?</label>
                    <Input placeholder="Ex: Sala 12, Laboratório..." value={locationIdentifier} onChange={(e) => setLocationIdentifier(e.target.value)} className="rounded-xl h-11 bg-white" />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Data</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full h-11 justify-start rounded-xl">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {date ? format(date, "PPP", { locale: ptBR }) : <span>Escolha a data</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={date} onSelect={setDate} locale={ptBR} disabled={(d) => d < new Date()} />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Horário</label>
                    <Select onValueChange={setSelectedSlotId} value={selectedSlotId} disabled={!date || !selectedClassId}>
                      <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Escolha o horário" /></SelectTrigger>
                      <SelectContent>
                        {availableSlots.map(s => <SelectItem key={s.id} value={s.id}>{s.startTime} ({s.durationMinutes} min)</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold">Observações</label>
                    <Button type="button" variant="ghost" size="sm" className="text-primary gap-1" onClick={handleGenerateAiBrief} disabled={isAiLoading || !notes}>
                      {isAiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Assistente IA
                    </Button>
                  </div>
                  <Textarea placeholder="Alunos estarão fazendo atividade X..." className="rounded-xl min-h-[120px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 p-8 flex justify-center">
                <Button onClick={handleSchedule} className="w-full max-w-sm rounded-2xl h-14 bg-primary text-xl font-bold shadow-lg">CONCLUIR RESERVA</Button>
              </CardFooter>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-xl bg-accent/5 rounded-3xl">
              <CardHeader className="p-6"><CardTitle className="text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-accent-foreground" /> Briefing IA</CardTitle></CardHeader>
              <CardContent className="p-6 pt-0">
                {aiBrief ? <div className="p-4 bg-white rounded-2xl border text-xs text-muted-foreground">{aiBrief.detailedBrief}</div> : <div className="text-center py-10 px-4 border-2 border-dashed rounded-2xl text-xs text-muted-foreground italic">Escreva suas notas para gerar um briefing detalhado.</div>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
