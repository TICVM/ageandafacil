
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock, MapPin, Sparkles, Loader2, CheckCircle2, Camera, User as UserIcon, Building2, Hash, ShieldAlert, ArrowLeft, Mail, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, serverTimestamp, addDoc, doc, getDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { AISessionBriefAssistantOutput, TimeSlot, Class, PhotoLocation, Segment, Booking, ScheduleBlock, User, RoleConfig, AppPermissions, HistoryEntry } from '@/lib/types';
import { aiSessionBriefAssistant } from '@/ai/flows/ai-session-brief-assistant-flow';
import { toast } from '@/hooks/use-toast';

export default function PublicBookingPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user: authUser, isUserLoading } = useUser();
  
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
  const [userPerms, setUserPerms] = useState<AppPermissions | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [guestEmail, setGuestEmail] = useState('');
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [isIdentified, setIsIdentified] = useState(false);

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
      if (isUserLoading) return;

      if (!db || !authUser) {
        setLoadingProfile(false);
        return;
      }
      
      setLoadingProfile(true);
      try {
        const userEmail = authUser.email?.toLowerCase().trim();
        const isMasterEmail = userEmail === 'herbertpacheco@cvmsp.com.br';

        const userDocRef = doc(db, 'users', authUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const profileData = userDoc.data() as User;
          setProfile({ ...profileData, id: authUser.uid });
          setTeacherName(profileData.name || '');
          setIsIdentified(true);
          
          if (profileData.roleId === 'ADMIN' || isMasterEmail) {
            setUserPerms({
              canManageUsers: true, canConfigureSlots: true, canManageLocations: true,
              canManageClasses: true, canViewReports: true, canViewAllAppointments: true,
              canViewSegmentAppointments: true, canViewClassAppointments: true,
              canEditAppointments: true, canCancelAppointments: true, canDeleteAppointments: true,
              canCreateBookings: true, canChangeStatus: true,
              canStatusPending: true, canStatusConfirmed: true, canStatusCancelled: true, canStatusRescheduled: true, canStatusReScheduleRequest: true, canStatusCompleted: true
            });
          } else {
            const roleDoc = await getDoc(doc(db, 'roles_config', profileData.roleId));
            if (roleDoc.exists()) {
              setUserPerms(roleDoc.data() as RoleConfig);
            }
          }
        } else if (isMasterEmail) {
          setProfile({ id: authUser.uid, name: 'Herbert Pacheco', email: userEmail || '', roleId: 'ADMIN' });
          setTeacherName('Herbert Pacheco');
          setIsIdentified(true);
          setUserPerms({
            canManageUsers: true, canConfigureSlots: true, canManageLocations: true,
            canManageClasses: true, canViewReports: true, canViewAllAppointments: true,
            canViewSegmentAppointments: true, canViewClassAppointments: true,
            canEditAppointments: true, canCancelAppointments: true, canDeleteAppointments: true,
            canCreateBookings: true, canChangeStatus: true,
            canStatusPending: true, canStatusConfirmed: true, canStatusCancelled: true, canStatusRescheduled: true, canStatusReScheduleRequest: true, canStatusCompleted: true
          });
        }
      } catch (err) {
        console.error("Erro ao carregar perfil na reserva:", err);
      } finally {
        setLoadingProfile(false);
      }
    }
    fetchProfile();
  }, [db, authUser, isUserLoading]);

  const handleVerifyGuestEmail = async () => {
    if (!guestEmail || !db) return;
    setIsVerifyingEmail(true);
    try {
      const q = query(collection(db, 'users'), where('email', '==', guestEmail.toLowerCase().trim()), limit(1));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const userData = snap.docs[0].data() as User;
        const userId = snap.docs[0].id;
        setProfile({ ...userData, id: userId });
        setTeacherName(userData.name || '');
        setIsIdentified(true);

        if (userData.roleId === 'ADMIN') {
          setUserPerms({
            canManageUsers: true, canConfigureSlots: true, canManageLocations: true,
            canManageClasses: true, canViewReports: true, canViewAllAppointments: true,
            canViewSegmentAppointments: true, canViewClassAppointments: true,
            canEditAppointments: true, canCancelAppointments: true, canDeleteAppointments: true,
            canCreateBookings: true, canChangeStatus: true,
            canStatusPending: true, canStatusConfirmed: true, canStatusCancelled: true, canStatusRescheduled: true, canStatusReScheduleRequest: true, canStatusCompleted: true
          });
        } else {
          const roleDoc = await getDoc(doc(db, 'roles_config', userData.roleId));
          if (roleDoc.exists()) {
            setUserPerms(roleDoc.data() as RoleConfig);
          }
        }
        toast({ title: "Olá, " + userData.name, description: "Identificação realizada com sucesso." });
      } else {
        toast({ 
          variant: "destructive",
          title: "Acesso Negado", 
          description: "E-mail não cadastrado. Por favor, peça para o seu coordenador ou administrador efetuar seu cadastro antes de realizar o agendamento." 
        });
      }
    } catch (e) {
      toast({ title: "Erro na verificação", variant: "destructive" });
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  const segments = rawSegments ? [...rawSegments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];
  const locations = rawLocations || [];

  const filteredClasses = rawClasses?.filter(c => {
    if (!profile || !userPerms) return false;
    const userEmail = profile.email?.toLowerCase().trim();
    if (profile.roleId === 'ADMIN' || userEmail === 'herbertpacheco@cvmsp.com.br' || userPerms.canViewAllAppointments) return true;
    if (userPerms.canViewSegmentAppointments && profile.segmentIds?.includes(c.schoolSegmentId)) return true;
    if (userPerms.canViewClassAppointments && profile.classIds?.includes(c.id)) return true;
    return false;
  }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) || [];

  const selectedClass = filteredClasses?.find(c => c.id === selectedClassId);
  const selectedSegment = segments?.find(s => s.id === selectedClass?.schoolSegmentId);
  const selectedLocation = locations?.find(l => l.id === selectedLocationId);

  const filteredLocations = locations?.filter(l => {
    if (!l.isActive) return false;
    const userEmail = profile?.email?.toLowerCase().trim();
    if (profile?.roleId === 'ADMIN' || userEmail === 'herbertpacheco@cvmsp.com.br') return true;
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
      app.status !== 'CANCELLED'
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
  }).sort((a, b) => a.startTime.startTime?.localeCompare(b.startTime) || 0) || [];

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
    if (userPerms && !userPerms.canCreateBookings) {
      toast({ title: "Acesso Negado", description: "Seu perfil não tem permissão para criar reservas.", variant: "destructive" });
      return;
    }
    if (!date || !selectedClassId || !selectedLocationId || !selectedSlotId || !teacherName || !db || !profile) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }
    
    const slot = slots?.find(s => s.id === selectedSlotId);
    if (!slot) return;

    const [h, m] = slot.startTime.split(':').map(Number);
    const endTotal = h * 60 + m + (slot.durationMinutes || 60);
    const endH = Math.floor(endTotal / 60).toString().padStart(2, '0');
    const endM = (endTotal % 60).toString().padStart(2, '0');

    const appointmentDate = format(date, 'yyyy-MM-dd');
    
    const initialHistory: HistoryEntry = {
      timestamp: new Date().toISOString(),
      userId: profile.id,
      userName: profile.name || teacherName,
      action: 'CRIACAO',
      details: `Reserva inicial realizada para o dia ${format(date, 'dd/MM/yyyy')} às ${slot.startTime}.`
    };

    addDoc(collection(db, 'appointments'), {
      schoolClassId: selectedClassId,
      teacherId: profile.id,
      teacherName: teacherName,
      photoLocationId: selectedLocationId,
      locationIdentifier: locationIdentifier || null,
      appointmentDate: appointmentDate,
      startTime: slot.startTime,
      endTime: `${endH}:${endM}`,
      status: 'PENDING',
      observations: notes,
      aiBrief: aiBrief || null,
      history: [initialHistory],
      createdAt: serverTimestamp(),
    }).then(() => {
      setIsSuccess(true);
    });
  };

  if (isUserLoading || (authUser && loadingProfile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ECF1FA]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Sincronizando acesso...</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#ECF1FA] flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in duration-300">
          <div className="bg-primary p-8 text-center text-primary-foreground">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-3xl font-bold">Sessão Agendada!</h2>
            <p className="text-primary-foreground/80">Sua reserva foi enviada e aguarda confirmação da equipe.</p>
          </div>
          <CardContent className="p-8 space-y-4">
            <div className="flex justify-between border-b pb-2"><span>Turma:</span><span className="font-bold">{selectedClass?.name}</span></div>
            <div className="flex justify-between border-b pb-2"><span>Data:</span><span className="font-bold">{date && format(date, 'dd/MM/yyyy')}</span></div>
            <div className="flex justify-between border-b pb-2"><span>Status:</span><Badge variant="secondary" className="bg-orange-100 text-orange-700">Aguardando confirmação</Badge></div>
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
        <div className="flex justify-between items-center">
          <Button 
            variant="ghost" 
            onClick={() => router.push(authUser ? '/dashboard' : '/')} 
            className="rounded-xl gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {authUser ? 'Voltar ao Painel' : 'Voltar para Login'}
          </Button>
        </div>

        <div className="flex flex-col items-center text-center space-y-2">
          <div className="bg-primary p-4 rounded-2xl shadow-lg mb-2"><Camera className="w-10 h-10 text-primary-foreground" /></div>
          <h1 className="text-4xl font-bold text-primary">SchoolLens</h1>
          <p className="text-muted-foreground">Sistema de Agendamento Inteligente</p>
        </div>

        {!isIdentified ? (
          <Card className="max-w-md mx-auto shadow-xl border-none rounded-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="bg-primary text-primary-foreground p-6 text-center">
              <CardTitle className="text-xl">Identificação Rápida</CardTitle>
              <CardDescription className="text-primary-foreground/80">Informe seu e-mail institucional para iniciar o agendamento.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="guest-email-input" className="text-sm font-semibold flex items-center gap-2 text-slate-600">
                  <Mail className="w-4 h-4" /> E-mail Institucional
                </Label>
                <Input 
                  id="guest-email-input"
                  name="email"
                  placeholder="ex: professor@escola.com" 
                  value={guestEmail} 
                  onChange={(e) => setGuestEmail(e.target.value)} 
                  className="rounded-xl h-12 border-slate-200"
                />
              </div>
              <Button 
                onClick={handleVerifyGuestEmail} 
                disabled={isVerifyingEmail || !guestEmail} 
                className="w-full rounded-xl h-12 gap-2 text-lg"
              >
                {isVerifyingEmail ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                Verificar E-mail
              </Button>
            </CardContent>
            <CardFooter className="bg-muted/30 p-4 text-center">
              <p className="text-[10px] text-muted-foreground">
                Seu e-mail deve estar previamente cadastrado no sistema por um administrador.
              </p>
            </CardFooter>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8 animate-in fade-in duration-500">
              {dayBlock && (
                <div className="bg-destructive/10 border-2 border-destructive/20 p-6 rounded-3xl flex items-center gap-4">
                  <ShieldAlert className="w-6 h-6 text-destructive" />
                  <p className="text-sm text-destructive font-medium">Bloqueio Administrativo: {dayBlock.reason}</p>
                </div>
              )}

              <Card className="shadow-xl border-none rounded-3xl overflow-hidden">
                <CardHeader className="bg-primary text-primary-foreground p-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="flex items-center gap-2"><CalendarIcon className="w-5 h-5" /> Reserva de Sessão</CardTitle>
                      <CardDescription className="text-primary-foreground/80">Selecione os detalhes abaixo para agendar suas fotos.</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-primary-foreground border-primary-foreground/20 gap-1">
                      <UserIcon className="w-3 h-3" /> {profile?.name}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6 bg-white">
                  <div className="space-y-2">
                    <Label htmlFor="teacher-name-display" className="text-sm font-semibold">Docente Responsável</Label>
                    <Input id="teacher-name-display" name="teacher_name" value={teacherName} readOnly className="rounded-xl h-11 bg-muted/30 border-none font-bold" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="class-select-trigger" className="text-sm font-semibold">Turma</Label>
                      <Select onValueChange={(val) => { setSelectedClassId(val); setSelectedLocationId(''); }} value={selectedClassId} modal={false}>
                        <SelectTrigger id="class-select-trigger" name="class" className="rounded-xl h-11" aria-haspopup="listbox"><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
                        <SelectContent>
                          {filteredClasses.length > 0 ? filteredClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>) : <div className="p-4 text-xs text-center text-muted-foreground italic">Nenhuma turma disponível para seu perfil.</div>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location-select-trigger" className="text-sm font-semibold">Local da Foto</Label>
                      <Select onValueChange={setSelectedLocationId} value={selectedLocationId} disabled={!selectedClassId} modal={false}>
                        <SelectTrigger id="location-select-trigger" name="location" className="rounded-xl h-11" aria-haspopup="listbox"><SelectValue placeholder="Selecione o local" /></SelectTrigger>
                        <SelectContent>
                          {filteredLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {selectedLocation?.requiresIdentifier && (
                    <div className="space-y-2 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                      <Label htmlFor="location-identifier-input" className="text-sm font-bold flex items-center gap-2 text-primary"><Hash className="w-4 h-4" /> Qual sala ou número?</Label>
                      <Input id="location-identifier-input" name="location_identifier" placeholder="Ex: Sala 12, Laboratório..." value={locationIdentifier} onChange={(e) => setLocationIdentifier(e.target.value)} className="rounded-xl h-11 bg-white" />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="date-popover-trigger" className="text-sm font-semibold">Data</Label>
                      <Popover modal={false}>
                        <PopoverTrigger asChild>
                          <Button id="date-popover-trigger" name="date-btn" variant="outline" className="w-full h-11 justify-start rounded-xl" aria-haspopup="dialog">
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
                      <Label htmlFor="slot-select-trigger" className="text-sm font-semibold">Horário</Label>
                      <Select onValueChange={setSelectedSlotId} value={selectedSlotId} disabled={!date || !selectedClassId} modal={false}>
                        <SelectTrigger id="slot-select-trigger" name="slot" className="rounded-xl h-11" aria-haspopup="listbox"><SelectValue placeholder="Escolha o horário" /></SelectTrigger>
                        <SelectContent>
                          {availableSlots.length > 0 ? availableSlots.map(s => <SelectItem key={s.id} value={s.id}>{s.startTime} ({s.durationMinutes} min)</SelectItem>) : <div className="p-4 text-xs text-center text-muted-foreground">Indisponível para esta data ou turma.</div>}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="booking-notes-input" className="text-sm font-semibold">Observações (Para o Briefing)</Label>
                      <Button type="button" variant="ghost" size="sm" className="text-primary gap-1" onClick={handleGenerateAiBrief} disabled={isAiLoading || !notes}>
                        {isAiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Assistente IA
                      </Button>
                    </div>
                    <Textarea id="booking-notes-input" name="notes" placeholder="Descreva brevemente como será a sessão..." className="rounded-xl min-h-[120px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/30 p-8 flex justify-center">
                  <Button 
                    onClick={handleSchedule} 
                    className="w-full max-w-sm rounded-2xl h-14 bg-primary text-xl font-bold shadow-lg hover:scale-105 transition-transform"
                    disabled={!date || !selectedSlotId || !selectedClassId || !selectedLocationId}
                  >
                    CONCLUIR RESERVA
                  </Button>
                </CardFooter>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-none shadow-xl bg-accent/5 rounded-3xl animate-in fade-in duration-700">
                <CardHeader className="p-6"><CardTitle className="text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-accent-foreground" /> Briefing IA</CardTitle></CardHeader>
                <CardContent className="p-6 pt-0">
                  {aiBrief ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-white rounded-2xl border text-xs text-muted-foreground italic leading-relaxed">
                        {aiBrief.detailedBrief}
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Sugestões de Fotos:</p>
                        <div className="flex flex-wrap gap-1">
                          {aiBrief.preferredShots.slice(0, 3).map((shot, i) => (
                            <Badge key={i} variant="outline" className="bg-white text-[9px]">{shot}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 px-4 border-2 border-dashed rounded-2xl text-xs text-muted-foreground italic">
                      Escreva suas notas e use o botão "Assistente IA" para gerar um briefing profissional automaticamente.
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="bg-primary/5 p-6 rounded-3xl border border-dashed border-primary/20">
                <h4 className="text-sm font-bold text-primary flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4" /> Unidade Escolar
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  As opções de locais e horários são filtradas automaticamente com base no seu cadastro docente.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
