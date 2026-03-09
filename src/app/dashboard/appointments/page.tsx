
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, MapPin, Search, MoreHorizontal, Loader2, Trash2, Info, FileText, Edit3, XCircle, CalendarIcon, Clock, Hash, Save, CheckCircle2, AlertTriangle, History, User as UserIcon, CheckCircle } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, getDoc } from 'firebase/firestore';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from '@/hooks/use-toast';
import { Booking, Class, PhotoLocation, User, RoleConfig, AppPermissions, TimeSlot, ScheduleBlock, HistoryEntry } from '@/lib/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const timeToMin = (t: string) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h * 60) + m;
};

const STATUS_CONFIG = {
  PENDING: { label: 'Aguardando confirmação', color: 'bg-orange-500 text-white', icon: Clock },
  CONFIRMED: { label: 'Confirmado', color: 'bg-green-600 text-white', icon: CheckCircle2 },
  RESCHEDULED: { label: 'Reagendado', color: 'bg-blue-500 text-white', icon: Edit3 },
  CANCELLED: { label: 'Cancelado', color: 'bg-destructive text-white', icon: XCircle },
  RE_SCHEDULE_REQUEST: { label: 'Por favor reagendar', color: 'bg-yellow-500 text-black', icon: AlertTriangle },
  COMPLETED: { label: 'Concluído', color: 'bg-slate-600 text-white', icon: CheckCircle },
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
          const masterPerms: AppPermissions = {
            canManageUsers: true, canConfigureSlots: true, canManageLocations: true,
            canManageClasses: true, canViewReports: true, canViewAllAppointments: true,
            canViewSegmentAppointments: true, canViewClassAppointments: true,
            canEditAppointments: true, canCancelAppointments: true, canDeleteAppointments: true,
            canCreateBookings: true, canChangeStatus: true,
            canStatusPending: true, canStatusConfirmed: true, canStatusCancelled: true, canStatusRescheduled: true, canStatusReScheduleRequest: true, canStatusCompleted: true
          };
          setUserPerms(masterPerms);
          setProfile({ id: authUser.uid, name: 'Herbert Pacheco', email: authUser.email || '', roleId: 'ADMIN' });
          return;
        }

        const userDoc = await getDoc(doc(db, 'users', authUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          setProfile({ ...userData, id: authUser.uid });

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

  const { data: list, isLoading } = useCollection<Booking>(appointmentsRef);
  const { data: classes } = useCollection<Class>(classesRef);
  const { data: locations } = useCollection<PhotoLocation>(locationsRef);
  const { data: slots } = useCollection<TimeSlot>(slotsRef);
  const { data: blocks } = useCollection<ScheduleBlock>(blocksRef);

  const availableSlots = useMemo(() => {
    if (!slots || !editDate || !editingBooking || !classes) return [];
    
    const dateStr = format(editDate, 'yyyy-MM-dd');
    const dayOfWeekStr = editDate.getDay().toString();
    const cls = classes.find(c => c.id === editingBooking.schoolClassId);
    
    const takenStartTimes = list?.filter(app => 
      app.id !== editingBooking.id &&
      app.status !== 'CANCELLED' &&
      app.appointmentDate === dateStr
    ).map(app => app.startTime) || [];

    return slots.filter(s => {
      if (s.dayOfWeek !== dayOfWeekStr) return false;

      const targetMatches = s.schoolClassId 
        ? s.schoolClassId === editingBooking.schoolClassId
        : s.schoolSegmentId 
          ? s.schoolSegmentId === cls?.schoolSegmentId
          : !s.schoolClassId && !s.schoolSegmentId;
      
      if (!targetMatches) return false;
      
      const isCurrentlyBookedTime = editingBooking.startTime === s.startTime && 
                                   editingBooking.appointmentDate === dateStr;
      
      if (isCurrentlyBookedTime) return true;
      if (takenStartTimes.includes(s.startTime)) return false;

      const slotStartMin = timeToMin(s.startTime);
      const slotEndMin = slotStartMin + (s.durationMinutes || 60);
      
      const isBlocked = blocks?.some(block => {
        if (block.date !== dateStr) return false;
        const bStart = timeToMin(block.startTime);
        const bEnd = timeToMin(block.endTime);
        return slotStartMin < bEnd && slotEndMin > bStart;
      });

      return !isBlocked;
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [slots, editDate, editingBooking, classes, list, blocks]);

  const handleOpenEdit = useCallback((booking: Booking) => {
    const bookingDate = new Date(booking.appointmentDate + 'T00:00:00');
    setEditDate(bookingDate);
    setEditLocationId(booking.photoLocationId);
    setEditIdentifier(booking.locationIdentifier || '');
    setEditNotes(booking.observations || '');
    
    if (slots) {
      const dayOfWeekStr = bookingDate.getDay().toString();
      const matchingSlot = slots.find(s => 
        s.startTime === booking.startTime && 
        s.dayOfWeek === dayOfWeekStr &&
        (s.schoolClassId === booking.schoolClassId || !s.schoolClassId)
      );
      setEditSlotId(matchingSlot?.id || '');
    }
    
    setTimeout(() => {
      setEditingBooking(booking);
    }, 200);
  }, [slots]);

  const handleSaveEdit = () => {
    if (!db || !editingBooking || !editDate || !editSlotId || !editLocationId || !profile) {
      toast({ title: "Dados Incompletos", description: "Verifique a data e o horário selecionado.", variant: "destructive" });
      return;
    }

    const slot = slots?.find(s => s.id === editSlotId);
    if (!slot) return;

    setIsSaving(true);
    
    const [h, m] = slot.startTime.split(':').map(Number);
    const endTotal = (h * 60) + m + (slot.durationMinutes || 60);
    const endH = Math.floor(endTotal / 60).toString().padStart(2, '0');
    const endM = (endTotal % 60).toString().padStart(2, '0');

    const newDate = format(editDate, 'yyyy-MM-dd');
    const newHistoryEntry: HistoryEntry = {
      timestamp: new Date().toISOString(),
      userId: profile.id,
      userName: profile.name,
      action: 'REAGENDAMENTO',
      details: `Sessão reagendada de ${format(new Date(editingBooking.appointmentDate + 'T00:00:00'), 'dd/MM/yyyy')} ${editingBooking.startTime} para ${format(editDate, 'dd/MM/yyyy')} ${slot.startTime}.`
    };

    const updateData = {
      appointmentDate: newDate,
      startTime: slot.startTime,
      endTime: `${endH}:${endM}`,
      photoLocationId: editLocationId,
      locationIdentifier: editIdentifier || null,
      observations: editNotes,
      status: 'RESCHEDULED',
      history: [...(editingBooking.history || []), newHistoryEntry]
    };

    updateDocumentNonBlocking(doc(db, 'appointments', editingBooking.id), updateData);

    setEditingBooking(null);
    setIsSaving(false);
    toast({ title: "Sessão Reagendada!" });
  };

  const handleUpdateStatus = (booking: Booking, newStatus: Booking['status']) => {
    if (!db || !profile) return;

    const newHistoryEntry: HistoryEntry = {
      timestamp: new Date().toISOString(),
      userId: profile.id,
      userName: profile.name,
      action: 'ALTERACAO_DE_STATUS',
      details: `Status alterado de ${STATUS_CONFIG[booking.status].label} para ${STATUS_CONFIG[newStatus].label}.`
    };

    updateDocumentNonBlocking(doc(db, 'appointments', booking.id), { 
      status: newStatus,
      history: [...(booking.history || []), newHistoryEntry]
    });
    
    toast({ title: "Status Atualizado", description: `Sessão marcada como ${STATUS_CONFIG[newStatus].label}.` });
  };

  const filtered = useMemo(() => {
    if (!list || !userPerms || !profile) return [];
    
    return list.filter(booking => {
      if (isMaster || userPerms.canViewAllAppointments) return true;
      const cls = classes?.find(c => c.id === booking.schoolClassId);
      if (userPerms.canViewSegmentAppointments && profile.segmentIds?.includes(cls?.schoolSegmentId || '')) return true;
      if (userPerms.canViewClassAppointments && profile.classIds?.includes(booking.schoolClassId)) return true;
      if (booking.teacherId === profile.id) return true;
      return false;
    }).filter(b => {
      if (!searchTerm) return true;
      const lowerSearch = searchTerm.toLowerCase();
      return b.teacherName?.toLowerCase().includes(lowerSearch) || 
             b.appointmentDate.includes(searchTerm);
    }).sort((a, b) => {
      const dateCompare = a.appointmentDate.localeCompare(b.appointmentDate);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [list, userPerms, profile, classes, isMaster, searchTerm]);

  const formatCreatedAt = (createdAt: any) => {
    if (!createdAt) return null;
    try {
      const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
      return format(date, "dd/MM HH:mm", { locale: ptBR });
    } catch (e) {
      return null;
    }
  };

  if (isLoading || !userPerms) {
    return <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const hasAnyStatusPermission = userPerms.canChangeStatus || 
    userPerms.canStatusPending || 
    userPerms.canStatusConfirmed || 
    userPerms.canStatusCancelled || 
    userPerms.canStatusRescheduled || 
    userPerms.canStatusReScheduleRequest ||
    userPerms.canStatusCompleted;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground">Visualize e valide as sessões de fotos escolares.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar docente ou data..." 
            className="pl-9 rounded-xl h-11 bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-white">
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
            {filtered.length > 0 ? (
              filtered.map((b) => {
                const cls = classes?.find(c => c.id === b.schoolClassId);
                const loc = locations?.find(l => l.id === b.photoLocationId);
                const creationTime = formatCreatedAt(b.createdAt);
                const status = STATUS_CONFIG[b.status] || STATUS_CONFIG.PENDING;

                return (
                  <TableRow key={b.id} className="hover:bg-accent/5">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary"><CalendarDays className="w-4 h-4" /></div>
                        <div className="flex flex-col">
                          <span className="font-bold">{format(new Date(b.appointmentDate + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                          <span className="text-xs text-muted-foreground">{b.startTime} - {b.endTime}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold">{b.teacherName}</span>
                        <span className="text-xs text-muted-foreground">{cls?.name || '---'}</span>
                        {creationTime && (
                          <span className="text-[10px] text-muted-foreground/50 mt-1 italic">
                            Agendado em: {creationTime}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><span className="text-sm font-medium">{loc?.name || '---'}</span></TableCell>
                    <TableCell>
                      {hasAnyStatusPermission ? (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Badge className={cn("rounded-lg cursor-pointer flex items-center gap-1.5 h-7", status.color)}>
                              <status.icon className="w-3 h-3" />
                              {status.label}
                            </Badge>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="rounded-xl p-2">
                            {(userPerms.canChangeStatus || userPerms.canStatusPending) && (
                              <DropdownMenuItem onSelect={() => handleUpdateStatus(b, 'PENDING')} className="gap-2"><Clock className="w-3.5 h-3.5" /> Aguardando confirmação</DropdownMenuItem>
                            )}
                            {(userPerms.canChangeStatus || userPerms.canStatusConfirmed) && (
                              <DropdownMenuItem onSelect={() => handleUpdateStatus(b, 'CONFIRMED')} className="gap-2 text-green-600 font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> Confirmar</DropdownMenuItem>
                            )}
                            {(userPerms.canChangeStatus || userPerms.canStatusCompleted) && (
                              <DropdownMenuItem onSelect={() => handleUpdateStatus(b, 'COMPLETED')} className="gap-2 text-slate-700 font-bold"><CheckCircle className="w-3.5 h-3.5" /> Concluir Sessão</DropdownMenuItem>
                            )}
                            {(userPerms.canChangeStatus || userPerms.canStatusRescheduled) && (
                              <DropdownMenuItem onSelect={() => handleUpdateStatus(b, 'RESCHEDULED')} className="gap-2 text-blue-600"><Edit3 className="w-3.5 h-3.5" /> Reagendado</DropdownMenuItem>
                            )}
                            {(userPerms.canChangeStatus || userPerms.canStatusReScheduleRequest) && (
                              <DropdownMenuItem onSelect={() => handleUpdateStatus(b, 'RE_SCHEDULE_REQUEST')} className="gap-2 text-yellow-600"><AlertTriangle className="w-3.5 h-3.5" /> Por favor reagendar</DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {(userPerms.canChangeStatus || userPerms.canStatusCancelled) && (
                              <DropdownMenuItem onSelect={() => handleUpdateStatus(b, 'CANCELLED')} className="gap-2 text-destructive"><XCircle className="w-3.5 h-3.5" /> Cancelar</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Badge className={cn("rounded-lg flex items-center gap-1.5", status.color)}>
                          <status.icon className="w-3 h-3" />
                          {status.label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-2">
                        <Button variant="ghost" size="icon" className="rounded-full text-primary" onClick={() => {
                          setTimeout(() => setSelectedBooking(b), 150);
                        }}><Info className="w-4 h-4" /></Button>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl p-2">
                            {userPerms.canEditAppointments && (
                              <DropdownMenuItem onSelect={() => handleOpenEdit(b)} className="gap-2 cursor-pointer">
                                <Edit3 className="w-3.5 h-3.5" /> Reagendar / Editar
                              </DropdownMenuItem>
                            )}
                            {userPerms.canCancelAppointments && b.status !== 'CANCELLED' && (
                              <DropdownMenuItem onSelect={() => handleUpdateStatus(b, 'CANCELLED')} className="gap-2 text-orange-600 cursor-pointer">
                                <XCircle className="w-3.5 h-3.5" /> Cancelar Sessão
                              </DropdownMenuItem>
                            )}
                            {userPerms.canDeleteAppointments && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => deleteDocumentNonBlocking(doc(db, 'appointments', b.id))} className="gap-2 text-destructive cursor-pointer">
                                  <Trash2 className="w-3.5 h-3.5" /> Excluir Registro
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow><TableCell colSpan={5} className="h-64 text-center text-muted-foreground">Nenhum registro encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="max-w-3xl rounded-3xl overflow-hidden p-0">
          <DialogHeader className="bg-primary p-6 text-primary-foreground">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-primary-foreground"><FileText className="w-6 h-6" /> Detalhes da Sessão</DialogTitle>
            <DialogDescription className="text-primary-foreground/80">Confira abaixo o histórico completo e os detalhes registrados.</DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-8 space-y-6 border-r">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">Docente / Turma</p>
                    <p className="text-lg font-bold">{selectedBooking.teacherName}</p>
                    <p className="text-sm text-muted-foreground">{classes?.find(c => c.id === selectedBooking.schoolClassId)?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">Status Atual</p>
                    <Badge className={cn("rounded-lg mt-1", STATUS_CONFIG[selectedBooking.status]?.color)}>
                      {STATUS_CONFIG[selectedBooking.status]?.label}
                    </Badge>
                  </div>
                </div>
                <div className="bg-muted/30 p-5 rounded-2xl border border-dashed">
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Notas do Professor</p>
                  <p className="text-sm italic whitespace-pre-wrap">{selectedBooking.observations || "Sem observações."}</p>
                </div>
              </div>

              <div className="p-8 space-y-4 bg-slate-50">
                <div className="flex items-center gap-2 text-primary mb-4">
                  <History className="w-5 h-5" />
                  <h3 className="font-bold text-lg">Linha do Tempo</h3>
                </div>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                    {selectedBooking.history?.slice().reverse().map((entry, idx) => (
                      <div key={idx} className="relative pl-8">
                        <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-white border-2 border-primary flex items-center justify-center z-10">
                          <Clock className="w-3 h-3 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{entry.action}</span>
                            <span className="text-[10px] text-muted-foreground">{format(new Date(entry.timestamp), "dd/MM HH:mm")}</span>
                          </div>
                          <p className="text-sm font-medium leading-tight">{entry.details}</p>
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                            <UserIcon className="w-2.5 h-2.5" />
                            <span>{entry.userName}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
          <DialogFooter className="p-4 bg-white border-t">
            <Button onClick={() => setSelectedBooking(null)} className="rounded-xl">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingBooking} onOpenChange={(open) => !open && !isSaving && setEditingBooking(null)}>
        <DialogContent className="max-w-2xl rounded-3xl overflow-hidden p-0">
          <DialogHeader className="bg-orange-500 p-6 text-white">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-white"><Edit3 className="w-6 h-6" /> Reagendar Sessão</DialogTitle>
            <DialogDescription className="text-orange-50/80">Altere a data, o horário ou o local para este agendamento específico.</DialogDescription>
          </DialogHeader>
          {editingBooking && (
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-orange-500" /> Nova Data</label>
                  <Popover modal={false}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full h-11 justify-start rounded-xl">
                        {editDate ? format(editDate, "PPP", { locale: ptBR }) : "Escolha a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={editDate} onSelect={setEditDate} locale={ptBR} disabled={(d) => d < new Date()} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2"><Clock className="w-4 h-4 text-orange-500" /> Novo Horário</label>
                  <Select value={editSlotId} onValueChange={setEditSlotId} disabled={!editDate} modal={false}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="Escolha o horário" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSlots.length > 0 ? (
                        availableSlots.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.startTime} ({s.durationMinutes} min)
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-4 text-xs text-center text-muted-foreground italic">Nenhum horário disponível.</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2"><MapPin className="w-4 h-4 text-orange-500" /> Local</label>
                  <Select value={editLocationId} onValueChange={setEditLocationId} modal={false}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {locations?.filter(l => l.isActive).map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2"><Hash className="w-4 h-4 text-orange-500" /> Identificador</label>
                  <Input value={editIdentifier} onChange={(e) => setEditIdentifier(e.target.value)} className="rounded-xl h-11" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold">Notas Adicionais</label>
                <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="rounded-xl h-11" />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditingBooking(null)} className="rounded-xl" disabled={isSaving}>Cancelar</Button>
                <Button onClick={handleSaveEdit} className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white gap-2 min-w-[140px]" disabled={isSaving || !editSlotId}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
