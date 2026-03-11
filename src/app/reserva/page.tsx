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

const timeToMin = (t: string) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h * 60) + m;
};

const ADMIN_PERMS: AppPermissions = {
  canManageUsers: true, canConfigureSlots: true, canManageLocations: true,
  canManageClasses: true, canViewReports: true, canViewAllAppointments: true,
  canViewSegmentAppointments: true, canViewClassAppointments: true,
  canEditAppointments: true, canCancelAppointments: true, canDeleteAppointments: true,
  canCreateBookings: true, canChangeStatus: true,
  canStatusPending: true, canStatusConfirmed: true, canStatusCancelled: true, canStatusRescheduled: true, canStatusReScheduleRequest: true, canStatusCompleted: true
};

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
      if (!db || !authUser) { 
        setLoadingProfile(false); 
        return; 
      }
      setLoadingProfile(true);
      try {
        const email = authUser.email?.toLowerCase().trim();
        if (isMaster) {
          const mProf: User = { id: authUser.uid, name: 'Herbert Pacheco', email: email!, roleId: 'ADMIN' };
          setProfile(mProf); 
          setTeacherName(mProf.name); 
          setUserPerms(ADMIN_PERMS);
          setIsIdentified(true); 
          setLoadingProfile(false); 
          return;
        }
        const snap = await getDoc(doc(db, 'users', authUser.uid));
        if (snap.exists()) {
          const data = snap.data() as User;
          setProfile({ ...data, id: authUser.uid }); 
          setTeacherName(data.name); 
          setIsIdentified(true);
          if (data.roleId === 'ADMIN') setUserPerms(ADMIN_PERMS);
          else { 
            const rSnap = await getDoc(doc(db, 'roles_config', data.roleId)); 
            if (rSnap.exists()) setUserPerms(rSnap.data() as RoleConfig); 
          }
        }
      } catch (err) { 
        console.error(err); 
      } finally { 
        setLoadingProfile(false); 
      }
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
        setProfile({ ...data, id: snap.docs[0].id }); 
        setTeacherName(data.name); 
        setIsIdentified(true);
        if (data.roleId === 'ADMIN') setUserPerms(ADMIN_PERMS);
        else { 
          const rSnap = await getDoc(doc(db, 'roles_config', data.roleId)); 
          if (rSnap.exists()) setUserPerms(rSnap.data() as RoleConfig); 
        }
        toast({ title: "Olá, " + data.name });
      } else {
        toast({ variant: "destructive", title: "E-mail não cadastrado." });
      }
    } finally { 
      setIsVerifyingEmail(false); 
    }
  };

  const filteredClasses = useMemo(() => {
    if (!rawClasses) return [];
    if (isMaster || profile?.roleId === 'ADMIN' || userPerms?.canViewAllAppointments) {
      return [...rawClasses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    if (!profile) return [];
    const uClassIds = profile.classIds || [];
    const uSegIds = profile.segmentIds || [];
    return rawClasses.filter(c => uClassIds.includes(c.id) || uSegIds.includes(c.schoolSegmentId)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [rawClasses, profile, isMaster, userPerms]);

  const filteredLocations = useMemo(() => {
    if (!rawLocations) return [];
    if (!selectedClassId) return rawLocations.filter(l => l.isActive);
    
    const selClass = rawClasses?.find(c => c.id === selectedClassId);
    if (!selClass) return rawLocations.filter(l => l.isActive);
    const selSeg = rawSegments?.find(s => s.id === selClass.schoolSegmentId);
    
    return rawLocations.filter(l => {
      if (!l.isActive) return false;
      if (!selSeg || !selSeg.unit) return true;
      if (!l.unit) return true;
      return l.unit.toLowerCase().trim() === selSeg.unit.toLowerCase().trim();
    });
  }, [rawLocations, rawClasses, rawSegments, selectedClassId]);

  const selectedLocation = useMemo(() => 
    rawLocations?.find(l => l.id === selectedLocationId),
    [rawLocations, selectedLocationId]
  );

  const avSlots = useMemo(() => {
    if (!slots || !date || !selectedClassId) return [];
    const dateStr = format(date, 'yyyy-MM-dd');
    const day = date.getDay().toString();
    const now = new Date();
    const minLimit = addHours(addDays(now, appSettings?.minAdvanceBookingDays ?? 1), appSettings?.minAdvanceBookingHours ?? 0);
    const cls = rawClasses?.find(c => c.id === selectedClassId);
    
    return slots.filter(s => {
      if (s.dayOfWeek !== day) return false;
      const targetMatches = s.schoolClassId ? s.schoolClassId === selectedClassId : s.schoolSegmentId ? s.schoolSegmentId === cls?.schoolSegmentId : !s.schoolClassId && !s.schoolSegmentId;
      if (!targetMatches) return false;
      const [h, m] = s.startTime.split(':').map(Number);
      const sDT = new Date(date); sDT.setHours(h, m, 0, 0);
      if (sDT < minLimit) return false;
      if (allAppointments?.some(app => app.appointmentDate === dateStr && app.startTime === s.startTime && app.status !== 'CANCELLED')) return false;
      return !allBlocks?.some(b => b.date === dateStr && timeToMin(s.startTime) < timeToMin(b.endTime) && (timeToMin(s.startTime) + (s.durationMinutes || 60)) > timeToMin(b.startTime));
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [slots, date, selectedClassId, rawClasses, allAppointments, allBlocks, appSettings]);

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

  if (isUserLoading || (authUser && loadingProfile)) return <div className="min-h-screen bg-[#ECF1FA] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  if (isSuccess) return (
    <div className="min-h-screen bg-[#ECF1FA] flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95">
        <div className="bg-primary p-10 text-center text-white"><CheckCircle2 className="w-20 h-20 mx-auto mb-4" /><h2 className="text-3xl font-bold">Agendado!</h2></div>
        <CardContent className="p-8 space-y-4">
          <Button onClick={() => window.location.reload()} className="w-full h-12 rounded-xl">Nova reserva</Button>
          <Button variant="ghost" onClick={() => router.push('/dashboard')} className="w-full h-12 rounded-xl">Ir para o Painel</Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#ECF1FA] py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push(authUser ? '/dashboard' : '/')} className="rounded-xl h-11 px-6 bg-white shadow-sm"><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button>
          <span className="font-bold text-xl text-primary flex items-center gap-2"><Camera className="w-6 h-6" /> SchoolLens</span>
        </div>

        {!isIdentified ? (
          <Card className="max-w-md mx-auto shadow-2xl rounded-3xl overflow-hidden border-none bg-white">
            <CardHeader className="bg-primary text-white text-center py-8">
              <Mail className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <CardTitle className="text-2xl">Identificação</CardTitle>
              <CardDescription className="text-white/70">Digite seu e-mail funcional cadastrado para continuar.</CardDescription>
            </CardHeader>
            <CardContent className="p-10 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="guest-email-input">E-mail Institucional</Label>
                <Input id="guest-email-input" name="guestEmail" type="email" placeholder="professor@escola.com" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className="rounded-xl h-12" />
              </div>
              <Button onClick={handleVerifyGuestEmail} disabled={isVerifyingEmail || !guestEmail} className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg">{isVerifyingEmail ? <Loader2 className="animate-spin" /> : "Verificar Cadastro"}</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="md:col-span-2 shadow-xl rounded-3xl overflow-hidden border-none bg-white">
              <CardHeader className="bg-primary text-white p-8">
                <CardTitle className="text-2xl">Reserva de Sessão</CardTitle>
                <CardDescription className="text-white/70">Olá, {teacherName}. Preencha os detalhes para agendar suas fotos.</CardDescription>
              </CardHeader>
              <CardContent className="p-10 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="class-select">Turma</Label>
                    <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                      <SelectTrigger id="class-select" className="rounded-xl h-12">
                        <SelectValue placeholder="Selecione a turma" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="loc-select">Local</Label>
                    <Select value={selectedLocationId} onValueChange={setSelectedLocationId} disabled={!selectedClassId}>
                      <SelectTrigger id="loc-select" className="rounded-xl h-12">
                        <SelectValue placeholder="Escolha o local" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name} {l.unit ? `(${l.unit})` : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedLocation?.requiresIdentifier && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                    <Label htmlFor="loc-id-input" className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-primary" />
                      Identificação do Local (Ex: Sala 10, Lab B)
                    </Label>
                    <Input 
                      id="loc-id-input"
                      name="locationIdentifier"
                      placeholder="Especifique o número ou nome da sala..."
                      value={locationIdentifier}
                      onChange={(e) => setLocationIdentifier(e.target.value)}
                      className="rounded-xl h-12 border-primary/30"
                      required
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="date-trigger">Data</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button id="date-trigger" variant="outline" className="w-full h-12 justify-start rounded-xl">
                          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                          {date ? format(date, "dd/MM/yyyy") : "Escolha o dia"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={date} onSelect={setDate} locale={ptBR} disabled={(d) => d < addDays(startOfDay(new Date()), appSettings?.minAdvanceBookingDays ?? 1)} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="slot-select">Horário</Label>
                    <Select value={selectedSlotId} onValueChange={setSelectedSlotId} disabled={!date || !selectedClassId}>
                      <SelectTrigger id="slot-select" className="rounded-xl h-12">
                        <SelectValue placeholder="Escolha o horário" />
                      </SelectTrigger>
                      <SelectContent>
                        {avSlots.map(s => <SelectItem key={s.id} value={s.id}>{s.startTime}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="notes-area">Observações</Label>
                  <Textarea id="notes-area" name="notes" placeholder="Descreva atividades ou solicitações especiais..." className="rounded-2xl min-h-[120px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 p-10 flex justify-center">
                <Button onClick={handleSchedule} className="w-full max-w-sm h-16 bg-primary text-xl font-bold rounded-2xl shadow-xl" disabled={!date || !selectedSlotId || !selectedClassId || !selectedLocationId || (selectedLocation?.requiresIdentifier && !locationIdentifier)}>
                  CONCLUIR RESERVA
                </Button>
              </CardFooter>
            </Card>
            <div className="space-y-6">
              <Card className="bg-primary text-white rounded-3xl p-8 border-none shadow-xl">
                <ShieldAlert className="w-8 h-8 mb-4 opacity-50" />
                <h3 className="font-bold mb-4 uppercase text-xs tracking-widest">Regras da Unidade</h3>
                <ul className="space-y-3 text-sm opacity-90">
                  <li>• Antecedência mínima: {appSettings?.minAdvanceBookingDays ?? 1}d {appSettings?.minAdvanceBookingHours ?? 0}h</li>
                  <li>• Verifique a disponibilidade do local escolhido.</li>
                  <li>• Mantenha as observações atualizadas para a equipe.</li>
                </ul>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
