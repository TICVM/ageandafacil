"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CalendarDays,
  MapPin,
  Search,
  MoreHorizontal,
  Loader2,
  Trash2,
  Info,
  XCircle,
  Clock,
  CheckCircle2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  Calendar as CalendarIcon,
  Edit3,
  BookOpen
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, getDoc } from 'firebase/firestore';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import {
  Booking,
  Class,
  PhotoLocation,
  User,
  AppPermissions,
  HistoryEntry,
  TimeSlot,
  ScheduleBlock,
  AppSettings
} from '@/lib/types';
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
import { RescheduleDialog } from '@/components/appointments/reschedule-dialog';
import { BookingDetailsDialog } from '@/components/appointments/booking-details-dialog';
import { DeleteConfirmationDialog } from '@/components/appointments/delete-confirmation-dialog';

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

type RolePermissions = AppPermissions & {
  canStatusCancelled?: boolean;
};

const ADMIN_PERMS: RolePermissions = {
  canManageUsers: true,
  canConfigureSlots: true,
  canManageLocations: true,
  canManageClasses: true,
  canViewReports: true,
  canViewAllAppointments: true,
  canViewSegmentAppointments: true,
  canViewClassAppointments: true,
  canEditAppointments: true,
  canCancelAppointments: true,
  canDeleteAppointments: true,
  canCreateBookings: true,
  canChangeStatus: true,
  canStatusPending: true,
  canStatusConfirmed: true,
  canStatusCancelled: true,
  canStatusRescheduled: true,
  canStatusReScheduleRequest: true,
  canStatusCompleted: true
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
  const [userPerms, setUserPerms] = useState<RolePermissions | null>(null);

  const isMaster = useMemo(() => {
    return authUser?.email?.toLowerCase().trim() === 'herbertpacheco@cvmsp.com.br';
  }, [authUser]);

  useEffect(() => {
    async function fetchPermissions() {
      if (!db || !authUser) return;

      try {
        if (isMaster) {
          setUserPerms(ADMIN_PERMS);
          setProfile({
            id: authUser.uid,
            name: 'Herbert Pacheco',
            email: authUser.email || '',
            roleId: 'ADMIN'
          } as User);
          return;
        }

        const userDoc = await getDoc(doc(db, 'users', authUser.uid));

        if (!userDoc.exists()) {
          setProfile(null);
          setUserPerms(null);
          return;
        }

        const userData = userDoc.data() as User;
        setProfile({ ...userData, id: authUser.uid });

        if (userData.roleId === 'ADMIN') {
          setUserPerms(ADMIN_PERMS);
          return;
        }

        const roleDoc = await getDoc(doc(db, 'roles_config', userData.roleId));

        if (roleDoc.exists()) {
          setUserPerms(roleDoc.data() as RolePermissions);
        } else {
          setUserPerms(null);
        }
      } catch (err) {
        console.error('Erro ao carregar permissões:', err);
        setUserPerms(null);
      }
    }

    fetchPermissions();
  }, [db, authUser, isMaster]);

  const appointmentsRef = useMemoFirebase(() => (db ? collection(db, 'appointments') : null), [db]);
  const classesRef = useMemoFirebase(() => (db ? collection(db, 'school_classes') : null), [db]);
  const locationsRef = useMemoFirebase(() => (db ? collection(db, 'photo_locations') : null), [db]);
  const slotsRef = useMemoFirebase(() => (db ? collection(db, 'available_time_slots') : null), [db]);
  const blocksRef = useMemoFirebase(() => (db ? collection(db, 'schedule_blocks') : null), [db]);
  const settingsRef = useMemoFirebase(() => (db ? doc(db, 'app_settings', 'general') : null), [db]);

  const { data: list, isLoading } = useCollection<Booking>(appointmentsRef);
  const { data: classes } = useCollection<Class>(classesRef);
  const { data: locations } = useCollection<PhotoLocation>(locationsRef);
  const { data: slots } = useCollection<TimeSlot>(slotsRef);
  const { data: allBlocks } = useCollection<ScheduleBlock>(blocksRef);
  const { data: appSettings } = useDoc<AppSettings>(settingsRef);

  const safeClasses = classes ?? [];
  const safeLocations = locations ?? [];
  const safeSlots = slots ?? [];
  const safeAllBlocks = allBlocks ?? [];
  const safeList = list ?? [];

  useEffect(() => {
    if (!selectedBooking || !safeList.length) return;

    const updated = safeList.find((b) => b.id === selectedBooking.id);

    if (!updated) {
      setSelectedBooking(null);
      return;
    }

    if (
      updated.status !== selectedBooking.status ||
      updated.appointmentDate !== selectedBooking.appointmentDate ||
      updated.startTime !== selectedBooking.startTime ||
      updated.endTime !== selectedBooking.endTime
    ) {
      setSelectedBooking(updated);
    }
  }, [safeList, selectedBooking]);

  const classMap = useMemo(() => {
    const map: Record<string, Class> = {};
    safeClasses.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [safeClasses]);

  const locationMap = useMemo(() => {
    const map: Record<string, PhotoLocation> = {};
    safeLocations.forEach((l) => {
      map[l.id] = l;
    });
    return map;
  }, [safeLocations]);

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

      toast({ title: 'Status atualizado' });
    },
    [db, profile]
  );

  const filtered = useMemo(() => {
    if (!safeList.length || !userPerms || !profile) return [];

    const isGlobalAdmin =
      isMaster ||
      profile.roleId === 'ADMIN' ||
      Boolean(userPerms.canViewAllAppointments);

    return safeList
      .filter((booking) => {
        if (isGlobalAdmin) return true;

        const cls = classMap[booking.schoolClassId];
        const schoolSegmentId = cls?.schoolSegmentId ?? '';

        const belongsBySegment =
          Boolean(userPerms.canViewSegmentAppointments) &&
          Boolean(profile.segmentIds?.includes(schoolSegmentId));

        const belongsByClass =
          Boolean(userPerms.canViewClassAppointments) &&
          Boolean(profile.classIds?.includes(booking.schoolClassId));

        const isOwner = booking.teacherId === profile.id;

        return belongsBySegment || belongsByClass || isOwner;
      })
      .filter((booking) => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return true;

        const className = classMap[booking.schoolClassId]?.name?.toLowerCase() || '';
        const teacherName = booking.teacherName?.toLowerCase() || '';
        const appointmentDate = booking.appointmentDate || '';

        return (
          teacherName.includes(term) ||
          appointmentDate.includes(term) ||
          className.includes(term)
        );
      })
      .sort((a, b) => {
        const byDate = a.appointmentDate.localeCompare(b.appointmentDate);
        if (byDate !== 0) return byDate;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [safeList, userPerms, profile, classMap, isMaster, searchTerm]);

  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};

    filtered.forEach((booking) => {
      if (!map[booking.appointmentDate]) {
        map[booking.appointmentDate] = [];
      }
      map[booking.appointmentDate].push(booking);
    });

    return map;
  }, [filtered]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const nextMonth = () => setCurrentMonth((prev) => addMonths(prev, 1));
  const prevMonth = () => setCurrentMonth((prev) => subMonths(prev, 1));
  const goToday = () => setCurrentMonth(new Date());

  if (isLoading || !userPerms) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ECF1FA]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Sincronizando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold tracking-tight text-primary">Agenda</h1>
          <p className="text-muted-foreground">
            Visualize e gerencie as sessões de fotos escolares.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
          <div className="relative w-full sm:w-64">
            <Label htmlFor="search-app-input" className="sr-only">
              Buscar agendamentos
            </Label>

            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              id="search-app-input"
              name="search"
              placeholder="Docente, turma ou data..."
              className="h-11 rounded-xl border-none bg-white pl-9 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Tabs
            value={viewMode}
            onValueChange={(value) => setViewMode(value as 'list' | 'calendar')}
            className="w-full sm:w-auto"
          >
            <TabsList className="h-11 rounded-xl border-none bg-white p-1 shadow-sm">
              <TabsTrigger value="list" className="gap-2 rounded-lg">
                <LayoutList className="h-4 w-4" />
                Lista
              </TabsTrigger>

              <TabsTrigger value="calendar" className="gap-2 rounded-lg">
                <CalendarIcon className="h-4 w-4" />
                Calendário
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {viewMode === 'list' ? (
        <Card className="overflow-hidden rounded-3xl border-none bg-white shadow-md">
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
                filtered.map((booking) => {
                  const statusCfg =
                    STATUS_CONFIG[booking.status as StatusKey] ?? STATUS_CONFIG.PENDING;
                  const StatusIcon = statusCfg.icon;

                  return (
                    <TableRow key={booking.id} className="hover:bg-accent/5">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-primary/10 p-2 text-primary">
                            <CalendarDays className="h-4 w-4" />
                          </div>

                          <div className="flex flex-col">
                            <span className="font-bold">
                              {format(
                                parseISO(`${booking.appointmentDate}T00:00:00`),
                                'dd/MM/yyyy'
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {booking.startTime} - {booking.endTime}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold">{booking.teacherName}</span>
                          <span className="text-xs text-muted-foreground">
                            {classMap[booking.schoolClassId]?.name || '---'}
                          </span>
                          {booking.subject && (
                            <div className="flex items-center gap-1 text-[10px] text-primary font-bold mt-0.5">
                              <BookOpen className="w-2.5 h-2.5" />
                              {booking.subject}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <MapPin className="h-3 w-3 text-primary" />
                          <span>
                            {locationMap[booking.photoLocationId]?.name || '---'}{' '}
                            {booking.locationIdentifier ? `(${booking.locationIdentifier})` : ''}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        {userPerms.canChangeStatus || isMaster ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Badge
                                className={cn(
                                  'flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-none px-3 shadow-sm',
                                  statusCfg.color
                                )}
                              >
                                <StatusIcon className="h-3.5 w-3.5" />
                                {statusCfg.label}
                              </Badge>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent
                              align="start"
                              className="rounded-2xl border-none p-2 shadow-2xl"
                            >
                              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                                const hasPerm =
                                  isMaster ||
                                  Boolean(userPerms[cfg.permKey as keyof RolePermissions]);

                                if (!hasPerm) return null;

                                const ItemIcon = cfg.icon;

                                return (
                                  <DropdownMenuItem
                                    key={key}
                                    onSelect={() => handleUpdateStatus(booking, key as StatusKey)}
                                    className="cursor-pointer gap-2 rounded-lg px-3 py-2"
                                  >
                                    <ItemIcon className="h-4 w-4" />
                                    {cfg.label}
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Badge
                            className={cn(
                              'flex h-8 cursor-default items-center gap-1.5 rounded-lg border-none px-3 opacity-80 shadow-sm',
                              statusCfg.color
                            )}
                          >
                            <StatusIcon className="h-3.5 w-3.5" />
                            {statusCfg.label}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            id={`view-booking-${booking.id}`}
                            name="viewBooking"
                            size="icon"
                            className="rounded-full text-primary hover:bg-primary/10"
                            onClick={() => setSelectedBooking(booking)}
                          >
                            <Info className="h-4 w-4" />
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="rounded-full"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent
                              align="end"
                              className="rounded-2xl border-none p-2 shadow-2xl"
                            >
                              {userPerms.canEditAppointments && (
                                <DropdownMenuItem
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    setRescheduleBooking(booking);
                                  }}
                                  className="cursor-pointer gap-2 rounded-lg py-2 text-primary"
                                >
                                  <Edit3 className="h-4 w-4" />
                                  Reagendar
                                </DropdownMenuItem>
                              )}

                              {userPerms.canCancelAppointments && booking.status !== 'CANCELLED' && (
                                <DropdownMenuItem
                                  onSelect={() => handleUpdateStatus(booking, 'CANCELLED')}
                                  className="cursor-pointer gap-2 rounded-lg py-2 text-orange-600"
                                >
                                  <XCircle className="h-4 w-4" />
                                  Cancelar Sessão
                                </DropdownMenuItem>
                              )}

                              {userPerms.canDeleteAppointments && (
                                <DropdownMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    setDeletingId(booking.id);
                                  }}
                                  className="mt-1 cursor-pointer gap-2 rounded-lg border-t py-2 text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Excluir Registro
                                </DropdownMenuItem>
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
                  <TableCell colSpan={5} className="h-48 text-center italic text-muted-foreground">
                    Nenhum agendamento encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-3xl border-none bg-white shadow-md">
          <div className="flex items-center justify-between border-b bg-primary/5 p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold text-primary">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h2>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goToday}
                className="h-9 rounded-lg border-none bg-white shadow-sm"
              >
                Hoje
              </Button>

              <div className="flex items-center rounded-lg bg-white shadow-sm">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={prevMonth}
                  className="h-9 w-9 rounded-l-lg border-r"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={nextMonth}
                  className="h-9 w-9 rounded-r-lg"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b bg-muted/30">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dayLabel) => (
              <div
                key={dayLabel}
                className="py-3 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground"
              >
                {dayLabel}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-[120px]">
            {calendarDays.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayBookings = bookingsByDate[dateStr] || [];
              const isSelectedMonth = day.getMonth() === currentMonth.getMonth();

              return (
                <div
                  key={dateStr}
                  className={cn(
                    'overflow-y-auto border-b border-r p-2 transition-colors hover:bg-slate-50',
                    !isSelectedMonth && 'bg-muted/10 opacity-40',
                    isToday(day) && 'bg-primary/5'
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        'min-w-[24px] rounded-md p-1 text-center text-xs font-bold',
                        isToday(day) ? 'bg-primary text-white' : 'text-slate-500'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {dayBookings.slice(0, 4).map((booking) => {
                      const cfg =
                        STATUS_CONFIG[booking.status as StatusKey] ?? STATUS_CONFIG.PENDING;

                      return (
                        <div
                          key={booking.id}
                          onClick={() => setSelectedBooking(booking)}
                          className={cn(
                            'cursor-pointer truncate rounded-md border-l-4 border-black/10 p-1.5 text-[10px] font-bold shadow-sm transition-transform hover:scale-[1.02]',
                            cfg.color
                          )}
                        >
                          {booking.startTime} - {booking.teacherName.split(' ')[0]}
                        </div>
                      );
                    })}

                    {dayBookings.length > 4 && (
                      <div className="text-center text-[9px] font-bold text-muted-foreground">
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

      <BookingDetailsDialog
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onReschedule={(booking) => setRescheduleBooking(booking)}
        onStatusUpdate={handleUpdateStatus}
        onDelete={(id) => {
          setSelectedBooking(null);
          // Pequeno intervalo para garantir que o backdrop do modal anterior limpe
          setTimeout(() => setDeletingId(id), 150);
        }}
        userPerms={userPerms}
        isMaster={isMaster}
        classMap={classMap}
        locationMap={locationMap}
      />

      <RescheduleDialog
        booking={rescheduleBooking}
        onClose={() => setRescheduleBooking(null)}
        classes={safeClasses}
        slots={safeSlots}
        allAppointments={safeList}
        allBlocks={safeAllBlocks}
        appSettings={appSettings}
        profile={profile}
      />

      <DeleteConfirmationDialog
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={() => {
          if (!deletingId || !db) return;

          deleteDocumentNonBlocking(doc(db, 'appointments', deletingId));
          setDeletingId(null);
          toast({ title: 'Agendamento removido.' });
        }}
      />
    </div>
  );
}
