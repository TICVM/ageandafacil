
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
        const userDocRef = doc(db, 'users', authUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const profileData = userDoc.data() as User;
          setProfile({ ...profileData, id: authUser.uid });
          setTeacherName(profileData.name || '');
          setIsIdentified(true);
          if (profileData.roleId === 'ADMIN' || userEmail === 'herbertpacheco@cvmsp.com.br') {
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
        console.error("Erro ao carregar perfil:", err);
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
        toast({ variant: "destructive", title: "Acesso Negado", description: "E-mail não cadastrado." });
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
    if (profile.roleId === 'ADMIN' || userPerms.canViewAllAppointments) return true;
    if (userPerms.canViewSegmentAppointments && profile.segmentIds?.includes(c.schoolSegmentId)) return true;
    if (userPerms.canViewClassAppointments && profile.classIds?.includes(c.id)) return true;
    return false;
  }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) || [];

  const selectedClass = filteredClasses?.find(c => c.id === selectedClassId);
  const selectedSegment = segments?.find(s => s.id === selectedClass?.schoolSegmentId);
  const selectedLocation = locations?.find(l => l.id === selectedLocationId);
  const filteredLocations = locations?.filter(l => l.isActive && (!selectedSegment?.unit || !l.unit || l.unit.toLowerCase() === selectedSegment.unit.toLowerCase())) || [];

  const availableSlots = slots?.filter(s => {
    if (!date) return false;
    if (s.dayOfWeek !== date.getDay().toString()) return false;
    const targetMatches = s.schoolClassId ? s.schoolClassId === selectedClassId : s.schoolSegmentId ? s.schoolSegmentId === selectedClass?.schoolSegmentId : !s.schoolClassId && !s.schoolSegmentId;
    if (!targetMatches) return false;
    const dateStr = format(date, 'yyyy-MM-dd');
    if (allAppointments?.some(app => app.appointmentDate === dateStr && app.startTime === s.startTime && app.status !== 'CANCELLED')) return false;
    return !allBlocks?.some(block => {
      if (block.date !== dateStr) return false;
      const t2m = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      return t2m(s.startTime) < t2m(block.endTime) && (t2m(s.startTime) + (s.durationMinutes || 60)) > t2m(block.startTime);
    });
  }).sort((a, b) => a.startTime.localeCompare(b.startTime)) || [];

  const handleSchedule = () => {
    if (!date || !selectedClassId || !selectedLocationId || !selectedSlotId || !teacherName || !db || !profile) {
      toast({ title: "Erro", description: "Preencha todos os campos.", variant: "destructive" });
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
      history: [{ timestamp: new Date().toISOString(), userId: profile.id, userName: teacherName, action: 'CRIACAO', details: 'Reserva realizada.' }],
      createdAt: serverTimestamp(),
    }).then(() => setIsSuccess(true));
  };

  if (isSuccess) return (
    <div className="min-h-screen bg-[#ECF1FA] flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl rounded-3xl overflow-hidden">
        <div className="bg-primary p-8 text-center text-primary-foreground">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4" />
          <h2 className="text-3xl font-bold">Sessão Agendada!</h2>
        </div>
        <CardContent className="p-8">
          <Button onClick={() => window.location.reload()} className="w-full rounded-xl h-12">Fazer outra reserva</Button>
          <Button variant="ghost" onClick={() => router.push('/dashboard')} className="w-full mt-2">Ir para o Painel</Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#ECF1FA] py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <Button variant="ghost" onClick={() => router.push(authUser ? '/dashboard' : '/')} className="rounded-xl gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        {!isIdentified ? (
          <Card className="max-w-md mx-auto shadow-xl rounded-3xl">
            <CardHeader className="bg-primary text-primary-foreground text-center"><CardTitle>Identificação</CardTitle></CardHeader>
            <CardContent className="p-8 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="guest-email-input">E-mail Institucional</Label>
                <Input id="guest-email-input" name="guestEmail" type="email" placeholder="professor@escola.com" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className="rounded-xl h-12" />
              </div>
              <Button onClick={handleVerifyGuestEmail} disabled={isVerifyingEmail || !guestEmail} className="w-full h-12">{isVerifyingEmail ? <Loader2 className="animate-spin" /> : "Verificar"}</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="md:col-span-2 shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="bg-primary text-primary-foreground p-6"><CardTitle>Reserva de Sessão</CardTitle></CardHeader>
              <CardContent className="p-8 space-y-6 bg-white">
                <div className="space-y-2">
                  <Label htmlFor="teacher-name-input">Docente</Label>
                  <Input id="teacher-name-input" name="teacherName" value={teacherName} readOnly className="rounded-xl h-11 bg-muted/30 border-none font-bold" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="class-select-trigger">Turma</Label>
                    <Select value={selectedClassId} onValueChange={(val) => { setSelectedClassId(val); setSelectedLocationId(''); }} modal={false}>
                      <SelectTrigger id="class-select-trigger" name="class" className="rounded-xl h-11"><SelectValue placeholder="Turma" /></SelectTrigger>
                      <SelectContent>{filteredClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location-select-trigger">Local</Label>
                    <Select value={selectedLocationId} onValueChange={setSelectedLocationId} disabled={!selectedClassId} modal={false}>
                      <SelectTrigger id="location-select-trigger" name="location" className="rounded-xl h-11"><SelectValue placeholder="Local" /></SelectTrigger>
                      <SelectContent>{filteredLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {selectedLocation?.requiresIdentifier && (
                  <div className="space-y-2 bg-primary/5 p-4 rounded-2xl border">
                    <Label htmlFor="identifier-input">Qual sala ou número?</Label>
                    <Input id="identifier-input" name="locationIdentifier" placeholder="Ex: Sala 12" value={locationIdentifier} onChange={(e) => setLocationIdentifier(e.target.value)} className="rounded-xl h-11 bg-white" />
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="date-trigger">Data</Label>
                    <Popover modal={false}>
                      <PopoverTrigger asChild>
                        <Button id="date-trigger" name="date" variant="outline" className="w-full h-11 justify-start rounded-xl">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {date ? format(date, "dd/MM/yyyy") : <span>Escolha a data</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={date} onSelect={setDate} locale={ptBR} disabled={(d) => d < startOfDay(new Date())} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slot-select-trigger">Horário</Label>
                    <Select value={selectedSlotId} onValueChange={setSelectedSlotId} disabled={!date || !selectedClassId} modal={false}>
                      <SelectTrigger id="slot-select-trigger" name="slot" className="rounded-xl h-11"><SelectValue placeholder="Horário" /></SelectTrigger>
                      <SelectContent>{availableSlots.map(s => <SelectItem key={s.id} value={s.id}>{s.startTime}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes-textarea">Observações</Label>
                  <Textarea id="notes-textarea" name="notes" placeholder="Descreva a sessão..." className="rounded-xl min-h-[120px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 p-8 flex justify-center">
                <Button onClick={handleSchedule} className="w-full max-w-sm rounded-2xl h-14 bg-primary text-xl font-bold" disabled={!date || !selectedSlotId || !selectedClassId || !selectedLocationId}>CONCLUIR RESERVA</Button>
              </CardFooter>
            </Card>
            <div className="space-y-6">
              <Card className="border-none shadow-xl bg-accent/5 rounded-3xl">
                <CardHeader className="p-6"><CardTitle className="text-lg">Dicas</CardTitle></CardHeader>
                <CardContent className="p-6 pt-0 text-xs text-muted-foreground italic">Selecione a turma para carregar os locais e horários disponíveis.</CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
