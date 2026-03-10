
'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { format, startOfDay, addDays, addHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock, MapPin, Sparkles, Loader2, CheckCircle2, Camera, User as UserIcon, Building2, Hash, ShieldAlert, ArrowLeft, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, serverTimestamp, addDoc, doc, getDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { TimeSlot, Class, PhotoLocation, Segment, Booking, ScheduleBlock, User, RoleConfig, AppPermissions, AppSettings } from '@/lib/types';
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
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [profile, setProfile] = useState<User | null>(null);
  const [userPerms, setUserPerms] = useState<AppPermissions | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [guestEmail, setGuestEmail] = useState('');
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [isIdentified, setIsIdentified] = useState(false);

  const isMaster = useMemo(() => authUser?.email?.toLowerCase().trim() === 'herbertpacheco@cvmsp.com.br', [authUser]);

  const classesRef = useMemoFirebase(() => db ? collection(db, 'school_classes') : null, [db]);
  const locationsRef = useMemoFirebase(() => db ? collection(db, 'photo_locations') : null, [db]);
  const slotsRef = useMemoFirebase(() => db ? collection(db, 'available_time_slots') : null, [db]);
  const segmentsRef = useMemoFirebase(() => db ? collection(db, 'school_segments') : null, [db]);
  const apptsRef = useMemoFirebase(() => db ? collection(db, 'appointments') : null, [db]);
  const blocksRef = useMemoFirebase(() => db ? collection(db, 'schedule_blocks') : null, [db]);
  const settingsRef = useMemoFirebase(() => db ? doc(db, 'app_settings', 'general') : null, [db]);

  const { data: rawClasses } = useCollection<Class>(classesRef);
  const { data: rawLocations } = useCollection<PhotoLocation>(locationsRef);
  const { data: slots } = useCollection<TimeSlot>(slotsRef);
  const { data: rawSegments } = useCollection<Segment>(segmentsRef);
  const { data: allAppointments } = useCollection<Booking>(apptsRef);
  const { data: allBlocks } = useCollection<ScheduleBlock>(blocksRef);
  const { data: appSettings } = useDoc<AppSettings>(settingsRef);

  useEffect(() => {
    async function fetchProfile() {
      if (isUserLoading) return;
      if (!db || !authUser) { setLoadingProfile(false); return; }
      setLoadingProfile(true);
      try {
        const email = authUser.email?.toLowerCase().trim();
        if (isMaster) {
          const mProf: User = { id: authUser.uid, name: 'Herbert Pacheco', email: email!, roleId: 'ADMIN' };
          setProfile(mProf); setTeacherName(mProf.name); setIsIdentified(true); setLoadingProfile(false); return;
        }
        const snap = await getDoc(doc(db, 'users', authUser.uid));
        if (snap.exists()) {
          const data = snap.data() as User;
          setProfile({ ...data, id: authUser.uid }); setTeacherName(data.name); setIsIdentified(true);
          if (data.roleId === 'ADMIN') setUserPerms({ canManageUsers: true, canConfigureSlots: true, canManageLocations: true, canManageClasses: true, canViewReports: true, canViewAllAppointments: true, canViewSegmentAppointments: true, canViewClassAppointments: true, canEditAppointments: true, canCancelAppointments: true, canDeleteAppointments: true, canCreateBookings: true, canChangeStatus: true, canStatusPending: true, canStatusConfirmed: true, canStatusCancelled: true, canStatusRescheduled: true, canStatusReScheduleRequest: true, canStatusCompleted: true });
          else { const rSnap = await getDoc(doc(db, 'roles_config', data.roleId)); if (rSnap.exists()) setUserPerms(rSnap.data() as RoleConfig); }
        } else {
          const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) { const data = qSnap.docs[0].data() as User; setProfile({ ...data, id: qSnap.docs[0].id }); setTeacherName(data.name); setIsIdentified(true); }
        }
      } catch (err) { console.error(err); } finally { setLoadingProfile(false); }
    }
    fetchProfile();
  }, [db, authUser, isUserLoading, isMaster]);

  const handleVerifyGuestEmail = async () => {
    if (!guestEmail || !db) return;
    setIsVerifyingEmail(true);
    try {
      const q = query(collection(db, 'users'), where('email', '==', guestEmail.toLowerCase().trim()), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data() as User;
        setProfile({ ...data, id: snap.docs[0].id }); setTeacherName(data.name); setIsIdentified(true);
        const rSnap = await getDoc(doc(db, 'roles_config', data.roleId)); if (rSnap.exists()) setUserPerms(rSnap.data() as RoleConfig);
        toast({ title: "Olá, " + data.name });
      } else toast({ variant: "destructive", title: "E-mail não cadastrado." });
    } finally { setIsVerifyingEmail(false); }
  };

  const filteredClasses = useMemo(() => {
    if (!rawClasses) return [];
    return rawClasses.filter(c => {
      if (isMaster || profile?.roleId === 'ADMIN' || userPerms?.canViewAllAppointments) return true;
      if (!profile) return false;
      const uC = profile.classIds || []; const uS = profile.segmentIds || [];
      return uC.includes(c.id) || uS.includes(c.schoolSegmentId);
    }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [rawClasses, profile, userPerms, isMaster]);

  const selClass = useMemo(() => filteredClasses.find(c => c.id === selectedClassId), [filteredClasses, selectedClassId]);
  const selSeg = useMemo(() => rawSegments?.find(s => s.id === selClass?.schoolSegmentId), [rawSegments, selClass]);
  
  const filteredLocs = useMemo(() => rawLocations?.filter(l => l.isActive && (!selSeg?.unit || !l.unit || l.unit.toLowerCase() === selSeg.unit.toLowerCase())) || [], [rawLocations, selSeg]);

  const avSlots = useMemo(() => {
    if (!slots || !date || !selectedClassId) return [];
    const dateStr = format(date, 'yyyy-MM-dd');
    const day = date.getDay().toString();
    const now = new Date();
    const minLimit = addHours(addDays(now, appSettings?.minAdvanceBookingDays ?? 1), appSettings?.minAdvanceBookingHours ?? 0);

    return slots.filter(s => {
      if (s.dayOfWeek !== day) return false;
      const targetMatches = s.schoolClassId ? s.schoolClassId === selectedClassId : s.schoolSegmentId ? s.schoolSegmentId === selClass?.schoolSegmentId : !s.schoolClassId && !s.schoolSegmentId;
      if (!targetMatches) return false;
      const [h, m] = s.startTime.split(':').map(Number);
      const sDT = new Date(date); sDT.setHours(h, m, 0, 0);
      if (sDT < minLimit) return false;
      if (allAppointments?.some(app => app.appointmentDate === dateStr && app.startTime === s.startTime && app.status !== 'CANCELLED')) return false;
      return !allBlocks?.some(b => b.date === dateStr && timeToMin(s.startTime) < timeToMin(b.endTime) && (timeToMin(s.startTime) + (s.durationMinutes || 60)) > timeToMin(b.startTime));
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [slots, date, selectedClassId, selClass, allAppointments, allBlocks, appSettings]);

  const handleSchedule = () => {
    if (!date || !selectedSlotId || !db || !profile) return;
    const slot = slots?.find(s => s.id === selectedSlotId); if (!slot) return;
    const [h, m] = slot.startTime.split(':').map(Number);
    const endT = h * 60 + m + (slot.durationMinutes || 60);
    addDoc(collection(db, 'appointments'), {
      schoolClassId: selectedClassId, teacherId: profile.id, teacherName: teacherName,
      photoLocationId: selectedLocationId, locationIdentifier: locationIdentifier || null,
      appointmentDate: format(date, 'yyyy-MM-dd'), startTime: slot.startTime,
      endTime: `${Math.floor(endT/60).toString().padStart(2,'0')}:${(endT%60).toString().padStart(2,'0')}`,
      status: 'PENDING', observations: notes,
      history: [{ timestamp: new Date().toISOString(), userId: profile.id, userName: teacherName, action: 'CRIACAO', details: 'Reserva realizada.' }],
      createdAt: serverTimestamp(),
    }).then(() => setIsSuccess(true));
  };

  const minBookingDate = useMemo(() => addDays(startOfDay(new Date()), appSettings?.minAdvanceBookingDays ?? 1), [appSettings]);

  if (isUserLoading || (authUser && loadingProfile)) return <div className="min-h-screen bg-[#ECF1FA] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  if (isSuccess) return (
    <div className="min-h-screen bg-[#ECF1FA] flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95">
        <div className="bg-primary p-10 text-center text-white"><CheckCircle2 className="w-20 h-20 mx-auto mb-4" /><h2 className="text-3xl font-bold">Agendado!</h2><p className="mt-2 opacity-80">Sua reserva foi encaminhada para a coordenação.</p></div>
        <CardContent className="p-8 space-y-4"><Button onClick={() => window.location.reload()} className="w-full rounded-xl h-12 text-lg">Nova reserva</Button><Button variant="ghost" onClick={() => router.push('/dashboard')} className="w-full h-12">Ir para o Painel</Button></CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#ECF1FA] py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between"><Button variant="ghost" onClick={() => router.push(authUser ? '/dashboard' : '/')} className="rounded-xl gap-2 h-11 px-6 bg-white shadow-sm"><ArrowLeft className="w-4 h-4" /> Voltar</Button><div className="flex items-center gap-2"><div className="bg-primary p-2 rounded-lg"><Camera className="w-5 h-5 text-white" /></div><span className="font-bold text-xl text-primary">SchoolLens</span></div></div>

        {!isIdentified ? (
          <div className="max-w-md mx-auto"><Card className="shadow-2xl rounded-3xl border-none overflow-hidden bg-white"><CardHeader className="bg-primary text-white text-center py-8"><Mail className="w-10 h-10 mx-auto mb-2 opacity-50" /><CardTitle className="text-2xl">Identificação</CardTitle><CardDescription className="text-white/70">Digite seu e-mail funcional para continuar.</CardDescription></CardHeader><CardContent className="p-10 space-y-6"><div className="space-y-2"><Label htmlFor="guest-email-input" className="text-sm font-bold uppercase text-slate-500">E-mail Institucional</Label><Input id="guest-email-input" name="guestEmail" type="email" placeholder="professor@escola.com" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className="rounded-xl h-12" /></div><Button onClick={handleVerifyGuestEmail} disabled={isVerifyingEmail || !guestEmail} className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg">{isVerifyingEmail ? <Loader2 className="animate-spin" /> : "Verificar Cadastro"}</Button></CardContent></Card></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in">
            <Card className="md:col-span-2 shadow-xl rounded-3xl overflow-hidden border-none bg-white">
              <CardHeader className="bg-primary text-white p-8"><div className="flex justify-between items-center"><div><CardTitle className="text-2xl">Reserva de Sessão</CardTitle><CardDescription className="text-white/70">Preencha os detalhes da sua sessão de fotos.</CardDescription></div><Badge variant="outline" className="border-white/30 text-white h-8 px-4">Passo 2 de 2</Badge></div></CardHeader>
              <CardContent className="p-10 space-y-8">
                <div className="space-y-3"><Label htmlFor="teacher-name-input" className="text-xs font-bold uppercase text-slate-500">Docente Responsável</Label><div className="relative"><UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" /><Input id="teacher-name-input" name="teacherName" value={teacherName} readOnly className="rounded-xl h-12 pl-10 bg-muted/30 font-bold text-primary border-none" /></div></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-3"><Label htmlFor="class-select-trigger" className="text-xs font-bold uppercase text-slate-500">Turma</Label><Select value={selectedClassId} onValueChange={(v) => { setSelectedClassId(v); setSelectedLocationId(''); }}><SelectTrigger id="class-select-trigger" name="class" className="rounded-xl h-12"><SelectValue placeholder="Selecione a turma" /></SelectTrigger><SelectContent>{filteredClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-3"><Label htmlFor="loc-select-trigger" className="text-xs font-bold uppercase text-slate-500">Local</Label><Select value={selectedLocationId} onValueChange={setSelectedLocationId} disabled={!selectedClassId}><SelectTrigger id="loc-select-trigger" name="location" className="rounded-xl h-12"><SelectValue placeholder={!selectedClassId ? "Aguardando turma..." : "Escolha o local"} /></SelectTrigger><SelectContent>{filteredLocs.map(l => <SelectItem key={l.id} value={l.id}>{l.name} {l.unit ? `(${l.unit})` : ''}</SelectItem>)}</SelectContent></Select></div>
                </div>
                {rawLocations?.find(l => l.id === selectedLocationId)?.requiresIdentifier && <div className="space-y-3 bg-primary/5 p-6 rounded-2xl border border-primary/10"><Label htmlFor="id-input" className="text-xs font-bold text-primary uppercase">Identificação Específica (Sala/Lab)</Label><div className="relative"><Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" /><Input id="id-input" name="identifier" placeholder="Ex: Sala 12..." value={locationIdentifier} onChange={(e) => setLocationIdentifier(e.target.value)} className="rounded-xl h-12 pl-10" /></div></div>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-3"><Label htmlFor="date-trigger" className="text-xs font-bold uppercase text-slate-500">Data</Label><Popover modal={false}><PopoverTrigger asChild><Button id="date-trigger" name="date" variant="outline" className="w-full h-12 justify-start rounded-xl"><CalendarIcon className="mr-2 h-4 w-4 text-primary" />{date ? format(date, "dd 'de' MMMM", { locale: ptBR }) : "Escolha o dia"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0 z-[100] shadow-2xl border-none" align="start"><Calendar mode="single" selected={date} onSelect={setDate} locale={ptBR} disabled={(d) => d < minBookingDate} /></PopoverContent></Popover></div>
                  <div className="space-y-3"><Label htmlFor="slot-trigger" className="text-xs font-bold uppercase text-slate-500">Horário</Label><Select value={selectedSlotId} onValueChange={setSelectedSlotId} disabled={!date || !selectedClassId}><SelectTrigger id="slot-trigger" name="slot" className="rounded-xl h-12"><SelectValue placeholder={!date ? "Aguardando data..." : "Escolha o horário"} /></SelectTrigger><SelectContent>{avSlots.length > 0 ? avSlots.map(s => <SelectItem key={s.id} value={s.id}>{s.startTime}</SelectItem>) : <div className="p-4 text-xs text-center text-muted-foreground italic">Nenhum horário disponível.</div>}</SelectContent></Select></div>
                </div>
                <div className="space-y-3"><Label htmlFor="notes-area" className="text-xs font-bold uppercase text-slate-500">Observações</Label><Textarea id="notes-area" name="notes" placeholder="Ex: Alunos fantasiados..." className="rounded-2xl min-h-[120px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              </CardContent>
              <CardFooter className="bg-slate-50 p-10 flex justify-center border-t"><Button onClick={handleSchedule} className="w-full max-w-sm rounded-2xl h-16 bg-primary text-xl font-bold shadow-xl shadow-primary/20" disabled={!date || !selectedSlotId || !selectedClassId || !selectedLocationId}>CONCLUIR AGENDAMENTO</Button></CardFooter>
            </Card>
            <div className="space-y-6">
              <Card className="border-none shadow-xl bg-primary text-white rounded-3xl overflow-hidden"><CardHeader className="pb-2"><div className="p-3 bg-white/20 rounded-2xl w-fit mb-4"><ShieldAlert className="w-6 h-6" /></div><CardTitle className="text-lg">Regras</CardTitle></CardHeader><CardContent className="space-y-4 text-sm opacity-90"><div className="flex gap-3"><CheckCircle2 className="w-5 h-5 shrink-0" /><p>Antecedência mínima de {appSettings?.minAdvanceBookingDays ?? 1}d {appSettings?.minAdvanceBookingHours ?? 0}h.</p></div><div className="flex gap-3"><CheckCircle2 className="w-5 h-5 shrink-0" /><p>Mantenha a coordenação avisada sobre sessões externas.</p></div></CardContent></Card>
              <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden"><CardHeader className="p-8 pb-0"><CardTitle className="text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-accent" />Ajuda</CardTitle></CardHeader><CardContent className="p-8 pt-4 space-y-4 text-sm text-slate-600"><p>Dúvidas? Entre em contato com a equipe de marketing pelo ramal 204.</p></CardContent></Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
