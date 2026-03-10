
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
        console.error("Erro ao carregar permissões na agenda:", err);
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

  const availableSlots = useMemo(() => {
    if (!slots || !editDate || !editingBooking || !classes) return [];
    
    const dateStr = format(editDate, 'yyyy-MM-dd');
    const dayOfWeekStr = editDate.getDay().toString();
    const cls = classes.find(c => c.id === editingBooking.schoolClassId);

    // Regra de Antecedência para Reagendamento
    const now = new Date();
    const minAdvanceDays = appSettings?.minAdvanceRescheduleDays ?? 1;
    const minAdvanceHours = appSettings?.minAdvanceRescheduleHours ?? 0;
    const minAdvanceLimit = addHours(addDays(now, minAdvanceDays), minAdvanceHours);
    
    const takenStartTimes = list?.filter(app => 
      app.id !== editingBooking.id &&
      app.status !== 'CANCELLED' &&
      app.appointmentDate === dateStr
    ).map(app => app.startTime) || [];

    return slots.filter(s => {
      if (s.dayOfWeek !== dayOfWeekStr) return false;

      // Validar antecedência por horário
      const [h, m] = s.startTime.split(':').map(Number);
      const slotDateTime = new Date(editDate);
      slotDateTime.setHours(h, m, 0, 0);
      if (slotDateTime < minAdvanceLimit) return false;

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
  }, [slots, editDate, editingBooking, classes, list, blocks, appSettings]);

  const handleOpenEdit = useCallback((booking: Booking) => {
    setEditDate(undefined);
    setEditSlotId('');
    setEditLocationId(booking.photoLocationId);
    setEditIdentifier(booking.locationIdentifier || '');
    setEditNotes(booking.observations || '');
    setEditingBooking(booking);
  }, []);

  const handleSaveEdit = () => {
    if (!db || !editingBooking || !editDate || !editSlotId || !editLocationId || !profile) {
      toast({ title: "Dados Incompletos", description: "Verifique se a nova data e o novo horário foram selecionados.", variant: "destructive" });
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

    updateDocumentNonBlocking(doc(db, 'appointments', editingBooking.id), {
      appointmentDate: newDate,
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
      return a.startTime.localeCompare(b.startTime) || 0;
    });
  }, [list, userPerms, profile, classes, isMaster, searchTerm]);

  const minRescheduleDate = useMemo(() => {
    const days = appSettings?.minAdvanceRescheduleDays ?? 1;
    return addDays(startOfDay(new Date()), days);
  }, [appSettings]);

  if (isLoading || !userPerms) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#ECF1FA]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Sincronizando agenda...</p>
      </div>
    );
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
          <h1 className="text-3xl font-bold tracking-tight text-primary">Agenda</h1>
          <p className="text-muted-foreground">Visualize e valide as sessões de fotos escolares.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Label htmlFor="search-appointments-list-input" className="sr-only">Buscar agendamentos</Label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            id="search-appointments-list-input"
            name="search"
            placeholder="Buscar docente ou data..." 
            className="pl-9 rounded-xl h-11 bg-white border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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
            {filtered.length > 0 ? (
              filtered.map((b) => {
                const cls = classes?.find(c => c.id === b.schoolClassId);
                const loc = locations?.find(l => l.id === b.photoLocationId);
                const status = STATUS_CONFIG[b.status] || STATUS_CONFIG.PENDING;

                return (
                  <TableRow key={b.id} className="hover:bg-accent/5">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary"><CalendarDays className="w-4 h-4" /></div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700">{format(new Date(b.appointmentDate + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                          <span className="text-xs text-muted-foreground font-mono">{b.startTime} - {b.endTime}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{b.teacherName}</span>
                        <span className="text-xs text-muted-foreground">{cls?.name || '---'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-primary" />
                        <span className="text-sm font-medium">{loc?.name || '---'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {hasAnyStatusPermission ? (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Badge id={`status-badge-trigger-${b.id}`} className={cn("rounded-lg cursor-pointer flex items-center gap-1.5 h-8 px-3 border-none", status.color)}>
                              <status.icon className="w-3.5 h-3.5" />
                              {status.label}
                            </Badge>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="rounded-2xl p-2 shadow-2xl border-none">
                            {(userPerms.canChangeStatus || userPerms.canStatusPending) && (
                              <DropdownMenuItem onSelect={() => handleUpdateStatus(b, 'PENDING')} className="gap-2 rounded-lg cursor-pointer"><Clock className="w-4 h-4" /> Aguardando confirmação</DropdownMenuItem>
                            )}
                            {(userPerms.canChangeStatus || userPerms.canStatusConfirmed) && (
                              <DropdownMenuItem onSelect={() => handleUpdateStatus(b, 'CONFIRMED')} className="gap-2 text-green-600 font-bold rounded-lg cursor-pointer"><CheckCircle2 className="w-4 h-4" /> Confirmar</DropdownMenuItem>
                            )}
                            {(userPerms.canChangeStatus || userPerms.canStatusCompleted) && (
                              <DropdownMenuItem onSelect={() => handleUpdateStatus(b, 'COMPLETED')} className="gap-2 text-slate-700 font-bold rounded-lg cursor-pointer"><CheckCircle className="w-4 h-4" /> Concluir Sessão</DropdownMenuItem>
                            )}
                            {(userPerms.canChangeStatus || userPerms.canStatusRescheduled) && (
                              <DropdownMenuItem onSelect={() => handleUpdateStatus(b, 'RESCHEDULED')} className="gap-2 text-blue-600 rounded-lg cursor-pointer"><Edit3 className="w-4 h-4" /> Reagendado</DropdownMenuItem>
                            )}
                            {(userPerms.canChangeStatus || userPerms.canStatusReScheduleRequest) && (
                              <DropdownMenuItem onSelect={() => handleUpdateStatus(b, 'RE_SCHEDULE_REQUEST')} className="gap-2 text-yellow-600 rounded-lg cursor-pointer"><AlertTriangle className="w-4 h-4" /> Por favor reagendar</DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-slate-100" />
                            {(userPerms.canChangeStatus || userPerms.canStatusCancelled) && (
                              <DropdownMenuItem onSelect={() => handleUpdateStatus(b, 'CANCELLED')} className="gap-2 text-destructive rounded-lg cursor-pointer"><XCircle className="w-4 h-4" /> Cancelar</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Badge className={cn("rounded-lg flex items-center gap-1.5 px-3 h-8 border-none", status.color)}>
                          <status.icon className="w-3.5 h-3.5" />
                          {status.label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-full text-primary hover:bg-primary/10" 
                          onClick={() => setSelectedBooking(b)} 
                          aria-label="Ver detalhes"
                        >
                          <Info className="w-4 h-4" />
                        </Button>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button id={`more-actions-trigger-${b.id}`} variant="ghost" size="icon" className="rounded-full hover:bg-muted" aria-label="Mais opções">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-2xl border-none">
                            {userPerms.canEditAppointments && (
                              <DropdownMenuItem onSelect={() => handleOpenEdit(b)} className="gap-2 cursor-pointer rounded-lg">
                                <Edit3 className="w-4 h-4 text-blue-600" /> Reagendar / Editar
                              </DropdownMenuItem>
                            )}
                            {userPerms.canCancelAppointments && b.status !== 'CANCELLED' && (
                              <DropdownMenuItem onSelect={() => handleUpdateStatus(b, 'CANCELLED')} className="gap-2 text-orange-600 cursor-pointer rounded-lg">
                                <XCircle className="w-4 h-4" /> Cancelar Sessão
                              </DropdownMenuItem>
                            )}
                            {userPerms.canDeleteAppointments && (
                              <>
                                <DropdownMenuSeparator className="bg-slate-100" />
                                <DropdownMenuItem onSelect={() => deleteDocumentNonBlocking(doc(db, 'appointments', b.id))} className="gap-2 text-destructive cursor-pointer rounded-lg">
                                  <Trash2 className="w-4 h-4" /> Excluir Registro
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
              <TableRow>
                <TableCell colSpan={5} className="h-64 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2 opacity-50">
                    <CalendarIcon className="w-10 h-10" />
                    <p>Nenhum registro encontrado.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="max-w-3xl rounded-3xl overflow-hidden p-0 border-none shadow-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader className="bg-primary p-8 text-primary-foreground">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-primary-foreground">
              <FileText className="w-7 h-7" /> Detalhes da Sessão
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80">Confira abaixo o histórico completo e os detalhes registrados.</DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-8 space-y-6 border-r">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Docente / Turma</p>
                    <p className="text-xl font-bold text-slate-800">{selectedBooking.teacherName}</p>
                    <p className="text-sm font-medium text-primary">{classes?.find(c => c.id === selectedBooking.schoolClassId)?.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Status Atual</p>
                    <Badge className={cn("rounded-lg px-3 py-1 text-xs border-none", STATUS_CONFIG[selectedBooking.status]?.color)}>
                      {STATUS_CONFIG[selectedBooking.status]?.label}
                    </Badge>
                  </div>
                </div>
                <div className="bg-muted/30 p-6 rounded-2xl border border-dashed border-slate-300">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" /> Notas do Professor
                  </p>
                  <p className="text-sm italic text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {selectedBooking.observations || "Nenhuma observação registrada para esta sessão."}
                  </p>
                </div>
              </div>

              <div className="p-8 space-y-4 bg-slate-50">
                <div className="flex items-center gap-2 text-primary mb-6">
                  <History className="w-6 h-6" />
                  <h3 className="font-bold text-lg">Linha do Tempo</h3>
                </div>
                <ScrollArea className="h-[320px] pr-4">
                  <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-primary/20">
                    {selectedBooking.history?.slice().reverse().map((entry, idx) => (
                      <div key={idx} className="relative pl-10">
                        <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-white border-2 border-primary flex items-center justify-center z-10 shadow-sm">
                          <Clock className="w-3 h-3 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-full">{entry.action}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{format(new Date(entry.timestamp), "dd/MM HH:mm")}</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-700 leading-snug">{entry.details}</p>
                          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
                            <UserIcon className="w-3 h-3" />
                            <span className="font-medium">{entry.userName}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
          <DialogFooter className="p-6 bg-white border-t">
            <Button onClick={() => setSelectedBooking(null)} className="rounded-xl px-8 h-12 shadow-lg">Fechar Detalhes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingBooking} onOpenChange={(open) => !open && !isSaving && setEditingBooking(null)}>
        <DialogContent className="max-w-2xl rounded-3xl overflow-hidden p-0 border-none shadow-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader className="bg-orange-500 p-8 text-white">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-white">
              <Edit3 className="w-7 h-7" /> Reagendar Sessão
            </DialogTitle>
            <DialogDescription className="text-orange-50/80">Confira o agendamento atual e defina a nova data e horário para a sessão.</DialogDescription>
          </DialogHeader>
          
          {editingBooking && (
            <div className="p-10 space-y-10 bg-white">
              <div className="bg-muted/30 p-6 rounded-3xl border border-dashed border-slate-300 relative overflow-hidden">
                 <div className="absolute right-0 top-0 p-4 opacity-5">
                    <Clock className="w-20 h-20" />
                 </div>
                 <p className="text-[10px] font-bold text-muted-foreground uppercase mb-4 flex items-center gap-2 tracking-widest">
                    <Clock className="w-4 h-4" /> Dados do Agendamento Atual
                 </p>
                 <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Data Atual</Label>
                      <p className="text-xl font-bold text-slate-800">{format(new Date(editingBooking.appointmentDate + 'T00:00:00'), 'dd/MM/yyyy')}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Horário Atual</Label>
                      <p className="text-xl font-bold text-slate-800">{editingBooking.startTime} <span className="text-sm font-normal text-muted-foreground">({editingBooking.endTime})</span></p>
                    </div>
                 </div>
              </div>

              <div className="flex items-center justify-center">
                 <div className="h-px bg-slate-200 flex-1"></div>
                 <Badge variant="secondary" className="mx-6 gap-2 text-[10px] font-bold py-1.5 px-4 bg-orange-50 text-orange-600 border-orange-200 uppercase tracking-widest">
                    <ArrowRight className="w-3.5 h-3.5" /> NOVO REAGENDAMENTO
                 </Badge>
                 <div className="h-px bg-slate-200 flex-1"></div>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <Label htmlFor="reschedule-new-date-popover-trigger" className="text-sm font-bold flex items-center gap-2 text-orange-600">
                      <CalendarIcon className="w-4 h-4" /> Nova Data
                    </Label>
                    <Popover modal={false}>
                      <PopoverTrigger asChild>
                        <Button 
                          id="reschedule-new-date-popover-trigger" 
                          name="newDate"
                          variant="outline" 
                          className="w-full h-12 justify-start rounded-xl bg-[#FFFBF9] border-orange-200 shadow-sm hover:border-orange-400 transition-colors"
                        >
                          <CalendarIcon className="mr-3 h-5 w-5 text-orange-500" />
                          {editDate ? format(editDate, "PPP", { locale: ptBR }) : <span className="text-muted-foreground italic">Selecione o novo dia...</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[100] rounded-2xl shadow-2xl border-none" align="start">
                        <Calendar 
                          mode="single" 
                          selected={editDate} 
                          onSelect={setEditDate} 
                          locale={ptBR} 
                          disabled={(d) => d < minRescheduleDate} 
                          className="p-4"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reschedule-new-slot-id-select" className="text-sm font-bold flex items-center gap-2 text-orange-600">
                      <Clock className="w-4 h-4" /> Novo Horário
                    </Label>
                    <Select value={editSlotId} onValueChange={setEditSlotId} disabled={!editDate} modal={false}>
                      <SelectTrigger id="reschedule-new-slot-id-select" name="newSlot" className="rounded-xl h-12 bg-[#FFFBF9] border-orange-200 shadow-sm hover:border-orange-400 transition-colors">
                        <SelectValue placeholder={!editDate ? "Aguardando data..." : "Escolha o horário"} />
                      </SelectTrigger>
                      <SelectContent className="z-[100] rounded-xl shadow-2xl border-none">
                        {availableSlots.length > 0 ? (
                          availableSlots.map(s => (
                            <SelectItem key={s.id} value={s.id} className="rounded-lg">
                              <div className="flex items-center gap-2">
                                <span className="font-bold">{s.startTime}</span>
                                <span className="text-[10px] text-muted-foreground">({s.durationMinutes} min)</span>
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-4 text-xs text-center text-muted-foreground italic">Nenhum horário disponível ou prazo esgotado.</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <Label htmlFor="reschedule-location-id-select" className="text-sm font-bold flex items-center gap-2 text-slate-600">
                      <MapPin className="w-4 h-4" /> Local da Foto
                    </Label>
                    <Select value={editLocationId} onValueChange={setEditLocationId} modal={false}>
                      <SelectTrigger id="reschedule-location-id-select" name="location" className="rounded-xl h-12 bg-white border-slate-200 shadow-sm">
                        <SelectValue placeholder="Selecione o local" />
                      </SelectTrigger>
                      <SelectContent className="z-[100] rounded-xl shadow-2xl border-none">
                        {locations?.filter(l => l.isActive).map(l => (
                          <SelectItem key={l.id} value={l.id} className="rounded-lg">
                            <div className="flex flex-col">
                              <span className="font-medium">{l.name}</span>
                              {l.unit && <span className="text-[10px] text-muted-foreground opacity-70">{l.unit}</span>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reschedule-location-identifier-input" className="text-sm font-bold flex items-center gap-2 text-slate-600">
                      <Hash className="w-4 h-4" /> Identificador Específico
                    </Label>
                    <Input 
                      id="reschedule-location-identifier-input" 
                      name="locationIdentifier" 
                      value={editIdentifier} 
                      onChange={(e) => setEditIdentifier(e.target.value)} 
                      className="rounded-xl h-12 border-slate-200 shadow-sm" 
                      placeholder="Ex: Sala 12, Pátio Sul..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reschedule-notes-textarea" className="text-sm font-bold text-slate-600">Notas e Observações</Label>
                  <Textarea 
                    id="reschedule-notes-textarea" 
                    name="notes" 
                    value={editNotes} 
                    onChange={(e) => setEditNotes(e.target.value)} 
                    className="rounded-2xl min-h-[100px] border-slate-200 shadow-sm" 
                    placeholder="Instruções adicionais para a equipe de fotografia ou coordenação..."
                  />
                </div>
              </div>

              <DialogFooter className="gap-3 border-t pt-8">
                <Button variant="outline" onClick={() => setEditingBooking(null)} className="rounded-xl h-12 px-8 font-medium border-slate-200" disabled={isSaving}>Cancelar</Button>
                <Button 
                  id="reschedule-confirm-button"
                  name="confirmReschedule"
                  onClick={handleSaveEdit} 
                  className="rounded-xl h-12 bg-orange-500 hover:bg-orange-600 text-white gap-2 px-10 shadow-xl shadow-orange-500/20 font-bold transition-transform hover:scale-105" 
                  disabled={isSaving || !editSlotId || !editDate}
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Confirmar Reagendamento
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
