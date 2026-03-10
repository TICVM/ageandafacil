
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
import { format, startOfDay } from 'date-fns';
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
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [profile, setProfile] = useState<User | null>(null);
  const [userPerms, setUserPerms] = useState<AppPermissions | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [guestEmail, setGuestEmail] = useState('');
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [isIdentified, setIsIdentified] = useState(false);

  // Queries
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

  // Identificação Automática se logado
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
        
        // Verificação Master Admin por E-mail
        if (userEmail === 'herbertpacheco@cvmsp.com.br') {
          const masterProfile: User = { id: authUser.uid, name: 'Herbert Pacheco', email: userEmail, roleId: 'ADMIN' };
          setProfile(masterProfile);
          setTeacherName(masterProfile.name);
          setIsIdentified(true);
          setLoadingProfile(false);
          return;
        }

        const userDocRef = doc(db, 'users', authUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const profileData = userDoc.data() as User;
          setProfile({ ...profileData, id: authUser.uid });
          setTeacherName(profileData.name || '');
          setIsIdentified(true);
          
          if (profileData.roleId === 'ADMIN') {
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
            if (roleDoc.exists()) setUserPerms(roleDoc.data() as RoleConfig);
          }
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
          if (roleDoc.exists()) setUserPerms(roleDoc.data() as RoleConfig);
        }
        toast({ title: "Olá, " + userData.name });
      } else {
        toast({ variant: "destructive", title: "Acesso Negado", description: "E-mail não cadastrado na base oficial da escola." });
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
    if (!profile) return true; // Para visitantes antes da identificação final
    if (profile.roleId === 'ADMIN') return true;
    if (userPerms?.canViewAllAppointments) return true;
    if (userPerms?.canViewSegmentAppointments && profile.segmentIds?.includes(c.schoolSegmentId)) return true;
    if (userPerms?.canViewClassAppointments && profile.classIds?.includes(c.id)) return true;
    return true; // Fallback permitindo ver turmas para agendar
  }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) || [];

  const selectedClass = filteredClasses?.find(c => c.id === selectedClassId);
  const selectedSegment = segments?.find(s => s.id === selectedClass?.schoolSegmentId);
  const selectedLocation = locations?.find(l => l.id === selectedLocationId);
  
  const filteredLocations = locations?.filter(l => 
    l.isActive && 
    (!selectedSegment?.unit || !l.unit || l.unit.toLowerCase() === selectedSegment.unit.toLowerCase())
  ) || [];

  const availableSlots = slots?.filter(s => {
    if (!date || !selectedClassId) return false;
    if (s.dayOfWeek !== date.getDay().toString()) return false;
    
    const targetMatches = s.schoolClassId 
      ? s.schoolClassId === selectedClassId 
      : s.schoolSegmentId 
        ? s.schoolSegmentId === selectedClass?.schoolSegmentId 
        : !s.schoolClassId && !s.schoolSegmentId;
        
    if (!targetMatches) return false;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    if (allAppointments?.some(app => app.appointmentDate === dateStr && app.startTime === s.startTime && app.status !== 'CANCELLED')) return false;
    
    return !allBlocks?.some(block => {
      if (block.date !== dateStr) return false;
      const t2m = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      const slotStart = t2m(s.startTime);
      const slotEnd = slotStart + (s.durationMinutes || 60);
      const blockStart = t2m(block.startTime);
      const blockEnd = t2m(block.endTime);
      return slotStart < blockEnd && slotEnd > blockStart;
    });
  }).sort((a, b) => a.startTime.localeCompare(b.startTime)) || [];

  const handleSchedule = () => {
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

    addDoc(collection(db, 'appointments'), {
      schoolClassId: selectedClassId,
      teacherId: profile.id,
      teacherName: teacherName,
      photoLocationId: selectedLocationId,
      locationIdentifier: locationIdentifier || null,
      appointmentDate: format(date, 'yyyy-MM-dd'),
      startTime: slot.startTime,
      endTime: `${endH}:${endM}`,
      status: 'PENDING',
      observations: notes,
      history: [{ 
        timestamp: new Date().toISOString(), 
        userId: profile.id, 
        userName: teacherName, 
        action: 'CRIACAO', 
        details: 'Reserva realizada pelo sistema.' 
      }],
      createdAt: serverTimestamp(),
    }).then(() => setIsSuccess(true));
  };

  if (isUserLoading || (authUser && loadingProfile)) {
    return (
      <div className="min-h-screen bg-[#ECF1FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Sincronizando perfil...</p>
        </div>
      </div>
    );
  }

  if (isSuccess) return (
    <div className="min-h-screen bg-[#ECF1FA] flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-500">
        <div className="bg-primary p-10 text-center text-primary-foreground">
          <CheckCircle2 className="w-20 h-20 mx-auto mb-4" />
          <h2 className="text-3xl font-bold">Sessão Agendada!</h2>
          <p className="mt-2 opacity-80">Sua reserva foi encaminhada para a coordenação.</p>
        </div>
        <CardContent className="p-8 space-y-4">
          <Button onClick={() => window.location.reload()} className="w-full rounded-xl h-12 text-lg">Nova reserva</Button>
          <Button variant="ghost" onClick={() => router.push('/dashboard')} className="w-full h-12">Ir para o Painel</Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#ECF1FA] py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push(authUser ? '/dashboard' : '/')} className="rounded-xl gap-2 h-11 px-6 bg-white shadow-sm">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <div className="bg-primary p-2 rounded-lg"><Camera className="w-5 h-5 text-primary-foreground" /></div>
            <span className="font-bold text-xl text-primary">SchoolLens</span>
          </div>
        </div>

        {!isIdentified ? (
          <div className="max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="shadow-2xl rounded-3xl border-none overflow-hidden bg-white">
              <CardHeader className="bg-primary text-primary-foreground text-center py-8">
                <Mail className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <CardTitle className="text-2xl">Identificação</CardTitle>
                <CardDescription className="text-primary-foreground/70">Digite seu e-mail funcional para continuar.</CardDescription>
              </CardHeader>
              <CardContent className="p-10 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="reserva-guest-email-input" className="text-sm font-bold uppercase tracking-wider text-slate-500">E-mail Institucional</Label>
                  <Input 
                    id="reserva-guest-email-input" 
                    name="guestEmail" 
                    type="email" 
                    placeholder="professor@escola.com" 
                    value={guestEmail} 
                    onChange={(e) => setGuestEmail(e.target.value)} 
                    className="rounded-xl h-12 bg-[#F8FAFC] border-slate-200" 
                  />
                </div>
                <Button 
                  onClick={handleVerifyGuestEmail} 
                  disabled={isVerifyingEmail || !guestEmail} 
                  className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg"
                >
                  {isVerifyingEmail ? <Loader2 className="animate-spin" /> : "Verificar Cadastro"}
                </Button>
                <p className="text-[10px] text-center text-muted-foreground italic mt-4">
                  * Apenas e-mails cadastrados pela administração podem realizar agendamentos.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in duration-500">
            <Card className="md:col-span-2 shadow-xl rounded-3xl overflow-hidden border-none bg-white">
              <CardHeader className="bg-primary text-primary-foreground p-8">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-2xl">Reserva de Sessão</CardTitle>
                    <CardDescription className="text-primary-foreground/70">Selecione os detalhes da sua sessão de fotos.</CardDescription>
                  </div>
                  <Badge variant="outline" className="border-white/30 text-white h-8 px-4">Passo 2 de 2</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-10 space-y-8">
                <div className="space-y-3">
                  <Label htmlFor="reserva-teacher-name-input" className="text-xs font-bold uppercase text-slate-500">Docente Responsável</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
                    <Input 
                      id="reserva-teacher-name-input" 
                      name="teacherName" 
                      value={teacherName} 
                      readOnly 
                      className="rounded-xl h-12 pl-10 bg-muted/30 border-none font-bold text-primary" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="reserva-class-trigger" className="text-xs font-bold uppercase text-slate-500">Qual a Turma?</Label>
                    <Select value={selectedClassId} onValueChange={(val) => { setSelectedClassId(val); setSelectedLocationId(''); }} modal={false}>
                      <SelectTrigger id="reserva-class-trigger" name="class" className="rounded-xl h-12 bg-[#F8FAFC] border-slate-200 shadow-sm">
                        <SelectValue placeholder="Selecione a turma" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl shadow-2xl">
                        {filteredClasses.map(c => <SelectItem key={c.id} value={c.id} className="rounded-lg">{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="reserva-location-trigger" className="text-xs font-bold uppercase text-slate-500">Local da Foto</Label>
                    <Select value={selectedLocationId} onValueChange={setSelectedLocationId} disabled={!selectedClassId} modal={false}>
                      <SelectTrigger id="reserva-location-trigger" name="location" className="rounded-xl h-12 bg-[#F8FAFC] border-slate-200 shadow-sm">
                        <SelectValue placeholder={!selectedClassId ? "Aguardando turma..." : "Escolha o local"} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl shadow-2xl">
                        {filteredLocations.map(l => (
                          <SelectItem key={l.id} value={l.id} className="rounded-lg">
                            <div className="flex flex-col">
                              <span>{l.name}</span>
                              {l.unit && <span className="text-[10px] text-muted-foreground">{l.unit}</span>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedLocation?.requiresIdentifier && (
                  <div className="space-y-3 bg-primary/5 p-6 rounded-2xl border border-primary/10 animate-in slide-in-from-top-2">
                    <Label htmlFor="reserva-identifier-input" className="text-xs font-bold text-primary uppercase">Identificação Específica (Sala/Lab)</Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                      <Input 
                        id="reserva-identifier-input" 
                        name="locationIdentifier" 
                        placeholder="Ex: Sala 12, Laboratório B..." 
                        value={locationIdentifier} 
                        onChange={(e) => setLocationIdentifier(e.target.value)} 
                        className="rounded-xl h-12 pl-10 bg-white border-primary/20" 
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="reserva-date-popover-trigger" className="text-xs font-bold uppercase text-slate-500">Data Desejada</Label>
                    <Popover modal={false}>
                      <PopoverTrigger asChild>
                        <Button id="reserva-date-popover-trigger" name="date" variant="outline" className="w-full h-12 justify-start rounded-xl bg-[#F8FAFC] border-slate-200 shadow-sm">
                          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                          {date ? format(date, "dd 'de' MMMM", { locale: ptBR }) : <span className="text-muted-foreground">Escolha o dia</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none" align="start">
                        <Calendar mode="single" selected={date} onSelect={setDate} locale={ptBR} disabled={(d) => d < startOfDay(new Date())} className="p-4" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="reserva-slot-trigger" className="text-xs font-bold uppercase text-slate-500">Horário Disponível</Label>
                    <Select value={selectedSlotId} onValueChange={setSelectedSlotId} disabled={!date || !selectedClassId} modal={false}>
                      <SelectTrigger id="reserva-slot-trigger" name="slot" className="rounded-xl h-12 bg-[#F8FAFC] border-slate-200 shadow-sm">
                        <SelectValue placeholder={!date ? "Aguardando data..." : "Escolha o horário"} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl shadow-2xl">
                        {availableSlots.length > 0 ? (
                          availableSlots.map(s => <SelectItem key={s.id} value={s.id} className="rounded-lg">{s.startTime}</SelectItem>)
                        ) : (
                          <div className="p-4 text-xs text-center text-muted-foreground italic">Nenhum horário disponível para este dia.</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="reserva-notes-input" className="text-xs font-bold uppercase text-slate-500">Observações para o Fotógrafo</Label>
                  <Textarea 
                    id="reserva-notes-input" 
                    name="notes" 
                    placeholder="Ex: Alunos virão fantasiados, trazer acessórios específicos..." 
                    className="rounded-2xl min-h-[120px] bg-[#F8FAFC] border-slate-200 shadow-sm p-4" 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                  />
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 p-10 flex justify-center border-t">
                <Button 
                  onClick={handleSchedule} 
                  className="w-full max-w-sm rounded-2xl h-16 bg-primary text-xl font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform" 
                  disabled={!date || !selectedSlotId || !selectedClassId || !selectedLocationId}
                >
                  CONCLUIR AGENDAMENTO
                </Button>
              </CardFooter>
            </Card>

            <div className="space-y-6">
              <Card className="border-none shadow-xl bg-primary text-primary-foreground rounded-3xl overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="p-3 bg-white/20 rounded-2xl w-fit mb-4">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-lg">Regras Importantes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm opacity-90">
                  <div className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <p>Agende com pelo menos 24h de antecedência.</p>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <p>Mantenha a coordenação avisada sobre sessões fora da sala.</p>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <p>O status 'Confirmado' será atualizado em breve pela marketing.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                <CardHeader className="pb-0 p-8">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-accent" />
                    Ajuda Rápida
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-4 space-y-4 text-sm text-slate-600">
                  <p>Não encontrou o local que desejava? Selecione "Outro" e especifique nas observações.</p>
                  <p>Dúvidas? Entre em contato com a equipe de marketing pelo ramal 204.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
