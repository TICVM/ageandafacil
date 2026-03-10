'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CalendarDays, MapPin, Search, MoreHorizontal, Loader2, Trash2, Info, FileText, Edit3, XCircle, CalendarIcon, Clock, Hash, Save, CheckCircle2, AlertTriangle, History, User as UserIcon, CheckCircle, ArrowRight } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, getDoc } from 'firebase/firestore';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from '@/hooks/use-toast';
import { Booking, Class, PhotoLocation, User, RoleConfig, AppPermissions, TimeSlot, ScheduleBlock, HistoryEntry, AppSettings } from '@/lib/types';
import { format, startOfDay, addDays, addHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const STATUS_CONFIG = {
  PENDING: {
    label: 'Aguardando confirmação',
    color: 'bg-orange-500 text-white',
    icon: Clock,
    permKey: 'canStatusPending'
  },
  CONFIRMED: {
    label: 'Confirmado',
    color: 'bg-green-600 text-white',
    icon: CheckCircle2,
    permKey: 'canStatusConfirmed'
  },
  RESCHEDULED: {
    label: 'Reagendado',
    color: 'bg-blue-500 text-white',
    icon: Edit3,
    permKey: 'canStatusRescheduled'
  },
  CANCELLED: {
    label: 'Cancelado',
    color: 'bg-destructive text-white',
    icon: XCircle,
    permKey: 'canStatusCancelled'
  },
  RE_SCHEDULE_REQUEST: {
    label: 'Por favor reagendar',
    color: 'bg-yellow-500 text-black',
    icon: AlertTriangle,
    permKey: 'canStatusReScheduleRequest'
  },
  COMPLETED: {
    label: 'Concluído',
    color: 'bg-slate-600 text-white',
    icon: CheckCircle,
    permKey: 'canStatusCompleted'
  }
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

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

export default function AppointmentsPage() {
  const db = useFirestore();
  const { user: authUser } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  
  const [profile, setProfile] = useState<User | null>(null);
  const [userPerms, setUserPerms] = useState<AppPermissions | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editSlotId, setEditSlotId] = useState<string>('');
  const [editLocationId, setEditLocationId] = useState<string>('');
  const [editIdentifier, setEditIdentifier] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const isMaster = useMemo(() => {
    return authUser?.email?.toLowerCase().trim() === 'herbertpacheco@cvmsp.com.br';
  }, [authUser]);

  useEffect(() => {
    async function fetchPermissions() {
      if (!db || !authUser) return;
      try {
        if (isMaster) {
          setUserPerms(ADMIN_PERMS);
          setProfile({ id: authUser.uid, name: 'Herbert Pacheco', email: authUser.email || '', roleId: 'ADMIN' });
          return;
        }

        const userDoc = await getDoc(doc(db, 'users', authUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          setProfile({ ...userData, id: authUser.uid });
          if (userData.roleId === 'ADMIN') {
            setUserPerms(ADMIN_PERMS);
          } else {
            const roleDoc = await getDoc(doc(db, 'roles_config', userData.roleId));
            if (roleDoc.exists()) setUserPerms(roleDoc.data() as RoleConfig);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar permissões:", err);
      }
    }
    fetchPermissions();
  }, [db, authUser, isMaster]);

  const appointmentsRef = useMemoFirebase(() => db ? collection(db, 'appointments') : null, [db]);
  const classesRef = useMemoFirebase(() => db ? collection(db, 'school_classes') : null, [db]);
  const locationsRef = useMemoFirebase(() => db ? collection(db, 'photo_locations') : null, [db]);
  const slotsRef = useMemoFirebase(() => db ? collection(db, 'available_time_slots') : null, [db]);
  const blocksRef = useMemoFirebase(() => db ? collection(db, 'schedule_blocks') : null, [db]);
  const settingsRef = useMemoFirebase(() => db ? doc(db, 'app_settings', 'general') : null, [db]);

  const { data: list, isLoading } = useCollection<Booking>(appointmentsRef);
  const { data: classes } = useCollection<Class>(classesRef);
  const { data: locations } = useCollection<PhotoLocation>(locationsRef);
  const { data: slots } = useCollection<TimeSlot>(slotsRef);
  const { data: blocks } = useCollection<ScheduleBlock>(blocksRef);
  const { data: appSettings } = useDoc<AppSettings>(settingsRef);

  const classMap = useMemo(() => {
    const map: Record<string, Class> = {};
    classes?.forEach(c => { map[c.id] = c; });
    return map;
  }, [classes]);

  const locationMap = useMemo(() => {
    const map: Record<string, PhotoLocation> = {};
    locations?.forEach(l => { map[l.id] = l; });
    return map;
  }, [locations]);

  const handleDelete = (id: string) => {
    if (!db) return;
    // Pequeno atraso para evitar conflitos de foco com o menu do Radix
    setTimeout(() => {
      const confirmed = window.confirm("Deseja realmente excluir este agendamento? Esta ação não pode ser desfeita.");
      if (confirmed) {
        deleteDocumentNonBlocking(doc(db, 'appointments', id));
        toast({ title: "Agendamento excluído." });
      }
    }, 100);
  };

  const handleUpdateStatus = useCallback(
    (booking: Booking, newStatus: StatusKey) => {
      if (!db || !profile) return;
      const statusCfg = STATUS_CONFIG[newStatus];
      const newHistoryEntry: HistoryEntry = {
        timestamp: new Date().toISOString(),
        userId: profile.id,
        userName: profile.name,
        action: 'ALTERACAO_DE_STATUS',
        details: `Status alterado para ${statusCfg.label}.`
      };
      updateDocumentNonBlocking(doc(db, 'appointments', booking.id), {
        status: newStatus,
        history: [...(booking.history || []), newHistoryEntry]
      });
      toast({ title: "Status Atualizado" });
    },
    [db, profile]
  );

  const filtered = useMemo(() => {
    if (!list || !userPerms || !profile) return [];
    const isGlobalAdmin = isMaster || profile.roleId === 'ADMIN' || userPerms.canViewAllAppointments;
    return list.filter(booking => {
      if (isGlobalAdmin) return true;
      const cls = classMap[booking.schoolClassId];
      const belongsBySegment = userPerms.canViewSegmentAppointments && profile.segmentIds?.includes(cls?.schoolSegmentId || '');
      const belongsByClass = userPerms.canViewClassAppointments && profile.classIds?.includes(booking.schoolClassId);
      const isOwner = booking.teacherId === profile.id;
      return belongsBySegment || belongsByClass || isOwner;
    })
    .filter(b => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        b.teacherName?.toLowerCase().includes(term) || 
        b.appointmentDate.includes(term) ||
        classMap[b.schoolClassId]?.name?.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate) || a.startTime.localeCompare(b.startTime));
  }, [list, userPerms, profile, classMap, isMaster, searchTerm]);

  const availableSlots = useMemo(() => {
    if (!slots || !editDate || !editingBooking || !classes) return [];
    const dateStr = format(editDate, 'yyyy-MM-dd');
    const dayOfWeekStr = editDate.getDay().toString();
    const cls = classMap[editingBooking.schoolClassId];
    const now = new Date();
    const minAdvanceLimit = addHours(addDays(now, appSettings?.minAdvanceRescheduleDays ?? 1), appSettings?.minAdvanceRescheduleHours ?? 0);
    
    return slots.filter(s => {
      if (s.dayOfWeek !== dayOfWeekStr) return false;
      const [h, m] = s.startTime.split(':').map(Number);
      const slotDateTime = new Date(editDate);
      slotDateTime.setHours(h, m, 0, 0);
      if (slotDateTime < minAdvanceLimit) return false;
      const targetMatches = s.schoolClassId ? s.schoolClassId === editingBooking.schoolClassId : s.schoolSegmentId ? s.schoolSegmentId === cls?.schoolSegmentId : !s.schoolClassId && !s.schoolSegmentId;
      if (!targetMatches) return false;
      if (list?.some(app => app.id !== editingBooking.id && app.status !== 'CANCELLED' && app.appointmentDate === dateStr && app.startTime === s.startTime)) return false;
      return !blocks?.some(block => {
        if (block.date !== dateStr) return false;
        const sM = timeToMin(s.startTime);
        const eM = sM + (s.durationMinutes || 60);
        return sM < timeToMin(block.endTime) && eM > timeToMin(block.startTime);
      });
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [slots, editDate, editingBooking, classes, list, blocks, appSettings, classMap]);

  const handleOpenEdit = useCallback((booking: Booking) => {
    setEditDate(undefined);
    setEditSlotId('');
    setEditLocationId(booking.photoLocationId);
    setEditIdentifier(booking.locationIdentifier || '');
    setEditNotes(booking.observations || '');
    setEditingBooking(booking);
  }, []);

  const handleSaveEdit = () => {
    if (!db || !editingBooking || !editDate || !editSlotId || !profile) return;
    const slot = slots?.find(s => s.id === editSlotId);
    if (!slot) return;
    setIsSaving(true);
    const [h, m] = slot.startTime.split(':').map(Number);
    const endTotal = (h * 60) + m + (slot.durationMinutes || 60);
    const endH = Math.floor(endTotal / 60).toString().padStart(2, '0');
    const endM = (endTotal % 60).toString().padStart(2, '0');
    const newHistoryEntry: HistoryEntry = {
      timestamp: new Date().toISOString(),
      userId: profile.id,
      userName: profile.name,
      action: 'REAGENDAMENTO',
      details: `Reagendado para ${format(editDate, 'dd/MM/yyyy')} às ${slot.startTime}.`
    };
    updateDocumentNonBlocking(doc(db, 'appointments', editingBooking.id), {
      appointmentDate: format(editDate, 'yyyy-MM-dd'),
      startTime: slot.startTime,
      endTime: `${endH}:${endM}`,
      photoLocationId: editLocationId,
      locationIdentifier: editIdentifier || null,
      observations: editNotes,
      status: 'RESCHEDULED',
      history: [...(editingBooking.history || []), newHistoryEntry]
    });
    setEditingBooking(null);
    setIsSaving(false);
    toast({ title: "Sessão Reagendada!" });
  };

  const minResDate = useMemo(() => addDays(startOfDay(new Date()), appSettings?.minAdvanceRescheduleDays ?? 1), [appSettings]);

  if (isLoading || !userPerms) return <div className="min-h-screen flex items-center justify-center bg-[#ECF1FA]"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Agenda</h1>
          <p className="text-muted-foreground">Visualize e valide as sessões de fotos escolares.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Label htmlFor="search-app-input" className="sr-only">Buscar agendamentos</Label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input id="search-app-input" name="search" placeholder="Buscar docente, turma ou data..." className="pl-9 rounded-xl h-11 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-white rounded-3xl">
        <Table>
          <TableHeader className="bg-muted/20">
            <TableRow>
              <TableHead className="font-bold">Data / Hora</TableHead>
              <TableHead className="font-bold">Docente / Turma</TableHead>
              <TableHead className="font-bold">Local</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="text-right font-bold">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? filtered.map((b) => {
              const statusCfg = STATUS_CONFIG[b.status as StatusKey] ?? STATUS_CONFIG.PENDING;
              const StatusIcon = statusCfg.icon;
              return (
                <TableRow key={b.id} className="hover:bg-accent/5">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-lg text-primary"><CalendarDays className="w-4 h-4" /></div>
                      <div className="flex flex-col">
                        <span className="font-bold">{format(new Date(`${b.appointmentDate}T00:00:00`), 'dd/MM/yyyy')}</span>
                        <span className="text-xs text-muted-foreground">{b.startTime} - {b.endTime}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold">{b.teacherName}</span>
                      <span className="text-xs text-muted-foreground">{classMap[b.schoolClassId]?.name || 'Turma não identificada'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <MapPin className="w-3 h-3 text-primary" />
                      {locationMap[b.photoLocationId]?.name || 'Local não definido'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {userPerms?.canChangeStatus || isMaster ? (
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Badge className={cn("rounded-lg cursor-pointer flex items-center gap-1.5 h-8 px-3 border-none shadow-sm", statusCfg.color)}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusCfg.label}
                          </Badge>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="rounded-2xl p-2 shadow-2xl border-none">
                          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                            const hasPerm = isMaster || (userPerms && (userPerms as any)[cfg.permKey]);
                            if (!hasPerm) return null;
                            return (
                              <DropdownMenuItem key={key} onSelect={() => handleUpdateStatus(b, key as StatusKey)} className="gap-2 rounded-lg cursor-pointer py-2 px-3">
                                <cfg.icon className="w-4 h-4" />{cfg.label}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Badge className={cn("rounded-lg flex items-center gap-1.5 h-8 px-3 border-none shadow-sm opacity-80 cursor-default", statusCfg.color)}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusCfg.label}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" className="rounded-full text-primary hover:bg-primary/10" onClick={() => setSelectedBooking(b)} aria-label="Ver detalhes"><Info className="w-4 h-4" /></Button>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-full"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl shadow-2xl border-none p-2">
                          {userPerms?.canEditAppointments && (
                            <DropdownMenuItem onSelect={() => handleOpenEdit(b)} className="gap-2 cursor-pointer rounded-lg py-2">
                              <Edit3 className="w-4 h-4 text-blue-600" /> Reagendar / Editar
                            </DropdownMenuItem>
                          )}
                          {userPerms?.canDeleteAppointments && (
                            <DropdownMenuItem onSelect={() => handleDelete(b.id)} className="gap-2 text-destructive cursor-pointer rounded-lg py-2">
                              <Trash2 className="w-4 h-4" /> Excluir Registro
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic">Nenhum agendamento encontrado.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-w-3xl rounded-3xl p-0 overflow-hidden shadow-2xl border-none" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader className="bg-primary p-8 text-white">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2"><FileText className="w-7 h-7" /> Detalhes da Sessão</DialogTitle>
            <DialogDescription className="text-white/70">Visualize as informações completas e o histórico desta reserva.</DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-8 space-y-6 border-r">
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Docente / Turma</p>
                  <p className="text-xl font-bold">{selectedBooking.teacherName}</p>
                  <p className="text-sm font-medium text-primary">{classMap[selectedBooking.schoolClassId]?.name || '---'}</p>
                </div>
                <div className="bg-muted/30 p-6 rounded-2xl border border-dashed border-slate-300">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-3">Observações</p>
                  <p className="text-sm italic text-slate-700">{selectedBooking.observations || "Sem notas."}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span>Local: {locationMap[selectedBooking.photoLocationId]?.name || '---'} {selectedBooking.locationIdentifier ? `(${selectedBooking.locationIdentifier})` : ''}</span>
                </div>
              </div>
              <div className="p-8 bg-slate-50">
                <div className="flex items-center gap-2 text-primary mb-6"><History className="w-6 h-6" /><h3 className="font-bold text-lg">Histórico</h3></div>
                <ScrollArea className="h-[320px] pr-4">
                  <div className="space-y-6 relative border-l-2 border-primary/20 pl-6 ml-2">
                    {selectedBooking.history?.slice().reverse().map((e, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-white border-2 border-primary shadow-sm" />
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] font-bold text-primary uppercase bg-primary/5 px-2 py-0.5 rounded">{e.action}</span>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(e.timestamp), "dd/MM HH:mm")}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-700 leading-relaxed">{e.details}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><UserIcon className="w-2.5 h-2.5" /> {e.userName}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
          <DialogFooter className="p-6 border-t bg-white">
            <Button onClick={() => setSelectedBooking(null)} className="rounded-xl px-10 h-11 font-bold">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingBooking} onOpenChange={() => !isSaving && setEditingBooking(null)}>
        <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden shadow-2xl border-none" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader className="bg-orange-500 p-8 text-white">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2"><Edit3 className="w-7 h-7" /> Reagendar Sessão</DialogTitle>
            <DialogDescription className="text-white/70">Ajuste a data e o horário da sessão de fotos. Verifique a disponibilidade do local.</DialogDescription>
          </DialogHeader>
          {editingBooking && (
            <div className="p-10 space-y-8 bg-white">
              <div className="bg-muted/30 p-6 rounded-2xl border border-dashed border-slate-300">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-4 flex items-center gap-2"><Clock className="w-4 h-4" /> AGENDAMENTO ATUAL</p>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Data Atual</Label>
                    <p className="text-lg font-bold text-slate-700">{format(new Date(`${editingBooking.appointmentDate}T00:00:00`), 'dd/MM/yyyy')}</p>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Horário Atual</Label>
                    <p className="text-lg font-bold text-slate-700">{editingBooking.startTime}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label htmlFor="reschedule-new-date-trigger" className="text-sm font-bold flex items-center gap-2 text-orange-600"><CalendarIcon className="w-4 h-4" /> Nova Data</Label>
                  <Popover modal={false}>
                    <PopoverTrigger asChild>
                      <Button id="reschedule-new-date-trigger" variant="outline" className="w-full h-12 justify-start rounded-xl">
                        <CalendarIcon className="mr-3 h-5 w-5 text-orange-500" />
                        {editDate ? format(editDate, "PPP", { locale: ptBR }) : <span className="text-muted-foreground italic">Escolha o dia...</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[100] shadow-2xl border-none" align="start">
                      <Calendar mode="single" selected={editDate} onSelect={setEditDate} locale={ptBR} disabled={(d) => d < minResDate} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reschedule-new-slot-select" className="text-sm font-bold flex items-center gap-2 text-orange-600"><Clock className="w-4 h-4" /> Novo Horário</Label>
                  <Select value={editSlotId} onValueChange={setEditSlotId} disabled={!editDate}>
                    <SelectTrigger id="reschedule-new-slot-select" className="rounded-xl h-12">
                      <SelectValue placeholder={!editDate ? "Aguardando data..." : "Escolha o horário"} />
                    </SelectTrigger>
                    <SelectContent className="z-[100] border-none shadow-2xl">
                      {availableSlots.length > 0 ? availableSlots.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.startTime}</SelectItem>
                      )) : <div className="p-4 text-xs text-center text-muted-foreground italic">Sem horários livres.</div>}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reschedule-notes-textarea" className="text-sm font-bold text-slate-600">Notas e Observações</Label>
                <Textarea id="reschedule-notes-textarea" name="notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="rounded-2xl min-h-[100px]" />
              </div>

              <DialogFooter className="gap-3 border-t pt-8 bg-white">
                <Button variant="outline" onClick={() => setEditingBooking(null)} className="rounded-xl h-12 px-8" disabled={isSaving}>Cancelar</Button>
                <Button onClick={handleSaveEdit} className="rounded-xl h-12 bg-orange-500 hover:bg-orange-600 text-white gap-2 px-10 shadow-xl font-bold" disabled={isSaving || !editSlotId || !editDate}>
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Salvar Reagendamento
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
