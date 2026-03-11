'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CalendarDays, 
  MapPin, 
  Search, 
  MoreHorizontal, 
  Loader2, 
  Trash2, 
  Info, 
  FileText, 
  XCircle, 
  Clock, 
  CheckCircle2, 
  History, 
  User as UserIcon, 
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  Calendar as CalendarIcon,
  Edit3
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, getDoc } from 'firebase/firestore';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { Booking, Class, PhotoLocation, User, AppPermissions, HistoryEntry, TimeSlot, ScheduleBlock, AppSettings, RoleConfig } from '@/lib/types';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addMonths, 
  subMonths,
  isToday,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RescheduleDialog } from '@/components/appointments/reschedule-dialog';

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
    permKey: 'canCancelAppointments'
  },
  RE_SCHEDULE_REQUEST: {
    label: 'Solicitar Reagendamento',
    color: 'bg-yellow-500 text-black',
    icon: Edit3,
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
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const [profile, setProfile] = useState<User | null>(null);
  const [userPerms, setUserPerms] = useState<AppPermissions | null>(null);

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
  const { data: allBlocks } = useCollection<ScheduleBlock>(blocksRef);
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

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToday = () => setCurrentMonth(new Date());

  if (isLoading || !userPerms) return (
    <div className="min-h-screen flex items-center justify-center bg-[#ECF1FA]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Sincronizando perfil...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold tracking-tight text-primary">Agenda</h1>
          <p className="text-muted-foreground">Visualize e gerencie as sessões de fotos escolares.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Label htmlFor="search-app-input" className="sr-only">Buscar agendamentos</Label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              id="search-app-input" 
              name="search" 
              placeholder="Docente, turma ou data..." 
              className="pl-9 rounded-xl h-11 bg-white border-none shadow-sm" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full sm:w-auto">
            <TabsList className="bg-white p-1 rounded-xl shadow-sm border-none h-11">
              <TabsTrigger value="list" className="rounded-lg gap-2"><LayoutList className="w-4 h-4" /> Lista</TabsTrigger>
              <TabsTrigger value="calendar" className="rounded-lg gap-2"><CalendarIcon className="w-4 h-4" /> Calendário</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {viewMode === 'list' ? (
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
                          <span className="font-bold">{format(parseISO(`${b.appointmentDate}T00:00:00`), 'dd/MM/yyyy')}</span>
                          <span className="text-xs text-muted-foreground">{b.startTime} - {b.endTime}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold">{b.teacherName}</span>
                        <span className="text-xs text-muted-foreground">{classMap[b.schoolClassId]?.name || '---'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <MapPin className="w-3 h-3 text-primary" />
                        {locationMap[b.photoLocationId]?.name || '---'} {b.locationIdentifier ? `(${b.locationIdentifier})` : ''}
                      </div>
                    </TableCell>
                    <TableCell>
                      {userPerms?.canChangeStatus || isMaster ? (
                        <DropdownMenu>
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
                        <Button variant="ghost" size="icon" className="rounded-full text-primary hover:bg-primary/10" onClick={() => setSelectedBooking(b)}><Info className="w-4 h-4" /></Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl shadow-2xl border-none p-2">
                            {userPerms?.canEditAppointments && (
                              <DropdownMenuItem onSelect={() => setRescheduleBooking(b)} className="gap-2 text-primary cursor-pointer rounded-lg py-2">
                                <Edit3 className="w-4 h-4" /> Reagendar
                              </DropdownMenuItem>
                            )}
                            {userPerms?.canCancelAppointments && b.status !== 'CANCELLED' && (
                              <DropdownMenuItem onSelect={() => handleUpdateStatus(b, 'CANCELLED')} className="gap-2 text-orange-600 cursor-pointer rounded-lg py-2">
                                <XCircle className="w-4 h-4" /> Cancelar Sessão
                              </DropdownMenuItem>
                            )}
                            {userPerms?.canDeleteAppointments && (
                              <DropdownMenuItem onSelect={() => setDeletingId(b.id)} className="gap-2 text-destructive cursor-pointer rounded-lg py-2 border-t mt-1">
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
      ) : (
        <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden">
          <div className="p-6 border-b flex items-center justify-between bg-primary/5">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToday} className="rounded-lg h-9 bg-white border-none shadow-sm">Hoje</Button>
              <div className="flex items-center bg-white rounded-lg shadow-sm">
                <Button variant="ghost" size="icon" onClick={prevMonth} className="h-9 w-9 rounded-l-lg border-r"><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={nextMonth} className="h-9 w-9 rounded-r-lg"><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="py-3 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-[120px]">
            {calendarDays.map((day, i) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayBookings = filtered.filter(b => b.appointmentDate === dateStr);
              const isSelectedMonth = day.getMonth() === currentMonth.getMonth();
              
              return (
                <div 
                  key={i} 
                  className={cn(
                    "border-r border-b p-2 overflow-y-auto hover:bg-slate-50 transition-colors",
                    !isSelectedMonth && "bg-muted/10 opacity-40",
                    isToday(day) && "bg-primary/5"
                  )}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={cn(
                      "text-xs font-bold p-1 rounded-md min-w-[24px] text-center",
                      isToday(day) ? "bg-primary text-white" : "text-slate-500"
                    )}>
                      {format(day, 'd')}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayBookings.slice(0, 4).map(b => {
                      const cfg = STATUS_CONFIG[b.status as StatusKey] || STATUS_CONFIG.PENDING;
                      return (
                        <div 
                          key={b.id}
                          onClick={() => setSelectedBooking(b)}
                          className={cn(
                            "text-[10px] p-1.5 rounded-md cursor-pointer truncate font-bold border-l-4 shadow-sm hover:scale-[1.02] transition-transform",
                            cfg.color,
                            "border-black/10"
                          )}
                        >
                          {b.startTime} - {b.teacherName.split(' ')[0]}
                        </div>
                      );
                    })}
                    {dayBookings.length > 4 && (
                      <div className="text-[9px] text-center text-muted-foreground font-bold">
                        + {dayBookings.length - 4} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Componente Isolado de Reagendamento */}
      <RescheduleDialog 
        booking={rescheduleBooking}
        onClose={() => setRescheduleBooking(null)}
        classes={classes}
        slots={slots}
        allAppointments={list}
        allBlocks={allBlocks}
        appSettings={appSettings}
        profile={profile}
      />

      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent 
          className="max-w-3xl rounded-3xl p-0 overflow-hidden shadow-2xl border-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="bg-primary p-8 text-white">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2"><FileText className="w-7 h-7" /> Detalhes da Sessão</DialogTitle>
            <DialogDescription className="text-white/70">Visualize o histórico e informações detalhadas desta reserva.</DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-8 space-y-6 border-r">
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Status Atual</p>
                  <div className="flex items-center gap-2">
                    <Badge className={cn("rounded-lg h-8 px-3 border-none", STATUS_CONFIG[selectedBooking.status as StatusKey]?.color)}>
                      {STATUS_CONFIG[selectedBooking.status as StatusKey]?.label}
                    </Badge>
                    {(userPerms?.canChangeStatus || isMaster) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 rounded-lg gap-1 text-primary"><MoreHorizontal className="w-4 h-4" /> Alterar</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="rounded-xl p-2 shadow-xl border-none min-w-[200px]">
                          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                            const hasPerm = isMaster || (userPerms && (userPerms as any)[cfg.permKey]);
                            if (!hasPerm) return null;
                            return (
                              <DropdownMenuItem key={key} onSelect={() => handleUpdateStatus(selectedBooking, key as StatusKey)} className="gap-2 rounded-lg py-2 cursor-pointer">
                                <cfg.icon className="w-4 h-4" />{cfg.label}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Docente / Turma</p>
                  <p className="text-xl font-bold">{selectedBooking.teacherName}</p>
                  <p className="text-sm font-medium text-primary">{classMap[selectedBooking.schoolClassId]?.name || '---'}</p>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <CalendarDays className="w-4 h-4 text-primary" />
                    <span>{format(parseISO(`${selectedBooking.appointmentDate}T00:00:00`), 'dd/MM/yyyy')} às {selectedBooking.startTime}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>{locationMap[selectedBooking.photoLocationId]?.name || '---'} {selectedBooking.locationIdentifier ? `(${selectedBooking.locationIdentifier})` : ''}</span>
                  </div>
                </div>

                <div className="bg-muted/30 p-6 rounded-2xl border border-dashed border-slate-300">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-3">Observações</p>
                  <ScrollArea className="h-[100px]">
                    <p className="text-sm italic text-slate-700 whitespace-pre-wrap">{selectedBooking.observations || "Sem notas."}</p>
                  </ScrollArea>
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
                          <span className="text-[10px] text-muted-foreground">{format(parseISO(e.timestamp), "dd/MM HH:mm")}</span>
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
          <DialogFooter className="p-6 border-t bg-white flex justify-between">
            <div className="flex gap-2">
              {userPerms?.canEditAppointments && (
                <Button variant="outline" onClick={() => setRescheduleBooking(selectedBooking)} className="rounded-xl border-primary text-primary hover:bg-primary/5">
                  <Edit3 className="w-4 h-4 mr-2" /> Reagendar
                </Button>
              )}
              {userPerms?.canCancelAppointments && selectedBooking?.status !== 'CANCELLED' && (
                <Button variant="outline" onClick={() => selectedBooking && handleUpdateStatus(selectedBooking, 'CANCELLED')} className="rounded-xl border-orange-200 text-orange-600 hover:bg-orange-50">
                  <XCircle className="w-4 h-4 mr-2" /> Cancelar
                </Button>
              )}
              {userPerms?.canDeleteAppointments && (
                <Button variant="ghost" onClick={() => { setDeletingId(selectedBooking?.id || null); setSelectedBooking(null); }} className="rounded-xl text-destructive hover:bg-destructive/5">
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
                </Button>
              )}
            </div>
            <Button onClick={() => setSelectedBooking(null)} className="rounded-xl px-10 h-11 font-bold">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-3xl p-8 border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-4 mx-auto">
              <Trash2 className="w-8 h-8" />
            </div>
            <AlertDialogTitle className="text-2xl font-bold text-center">Excluir Registro?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-base">
              Deseja realmente remover este agendamento do sistema?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 flex gap-3 sm:justify-center">
            <AlertDialogCancel className="rounded-2xl h-12 px-8 border-slate-200 font-bold">Voltar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (deletingId && db) {
                  deleteDocumentNonBlocking(doc(db, 'appointments', deletingId));
                  setDeletingId(null);
                  toast({ title: "Agendamento removido." });
                }
              }}
              className="bg-destructive text-white hover:bg-destructive/90 rounded-2xl h-12 px-8 font-bold shadow-lg shadow-destructive/20"
            >
              Sim, Excluir Registro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
