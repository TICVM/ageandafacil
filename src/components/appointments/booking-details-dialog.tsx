
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  CalendarDays,
  MapPin,
  FileText,
  XCircle,
  Clock,
  CheckCircle2,
  History,
  User as UserIcon,
  CheckCircle,
  Edit3,
  Trash2,
  MoreHorizontal,
  BookOpen
} from 'lucide-react';

import { format, parseISO } from 'date-fns';

import { cn } from '@/lib/utils';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

import { Booking, Class, PhotoLocation, AppPermissions } from '@/lib/types';

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

interface BookingDetailsDialogProps {
  booking: Booking | null;
  onClose: () => void;
  onReschedule: (booking: Booking) => void;
  onStatusUpdate: (booking: Booking, status: StatusKey) => void;
  onDelete: (id: string) => void;
  userPerms: AppPermissions | null;
  isMaster: boolean;
  classMap: Record<string, Class>;
  locationMap: Record<string, PhotoLocation>;
}

export function BookingDetailsDialog({
  booking,
  onClose,
  onReschedule,
  onStatusUpdate,
  onDelete,
  userPerms,
  isMaster,
  classMap,
  locationMap,
}: BookingDetailsDialogProps) {

  if (!booking) return null;

  const history = (booking.history ?? []).slice().reverse();

  const formattedDate = booking.appointmentDate
    ? format(parseISO(`${booking.appointmentDate}T00:00:00`), "dd/MM/yyyy")
    : "---";

  const currentStatus: StatusKey =
    (booking.status as StatusKey) ?? "PENDING";

  const statusCfg = STATUS_CONFIG[currentStatus];
  const StatusIcon = statusCfg.icon;

  const hasPerm = (perm: string) => {
    if (isMaster) return true;
    if (!userPerms) return false;
    return perm in userPerms && (userPerms as any)[perm];
  };

  return (
    <Dialog open={!!booking} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-3xl rounded-3xl p-0 overflow-hidden shadow-2xl border-none z-50"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="bg-primary p-8 text-white">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-7 h-7" />
            Detalhes da Sessão
          </DialogTitle>

          <DialogDescription className="text-white/70">
            Visualize o histórico e informações detalhadas desta reserva.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2">

          {/* COLUNA ESQUERDA */}

          <div className="p-8 space-y-6 md:border-r">

            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Status Atual
                </p>
                <div className="flex items-center gap-2">
                  <Badge className={cn("rounded-lg h-8 px-3 border-none", statusCfg.color)}>
                    <StatusIcon className="w-3.5 h-3.5 mr-1.5" />
                    {statusCfg.label}
                  </Badge>
                  {(userPerms?.canChangeStatus || isMaster) && (
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 rounded-lg gap-1 text-primary">
                          <MoreHorizontal className="w-4 h-4" />
                          Alterar
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="rounded-xl p-2 shadow-xl border-none min-w-[200px]"
                      >
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                          if (!hasPerm(cfg.permKey)) return null;
                          const Icon = cfg.icon;
                          return (
                            <DropdownMenuItem
                              key={key}
                              onSelect={() => onStatusUpdate(booking, key as StatusKey)}
                              className="gap-2 rounded-lg py-2 cursor-pointer"
                            >
                              <Icon className="w-4 h-4" />
                              {cfg.label}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              {booking.subject && (
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                    Disciplina
                  </p>
                  <Badge variant="outline" className="gap-1.5 h-8 border-primary text-primary font-bold">
                    <BookOpen className="w-3 h-3" />
                    {booking.subject}
                  </Badge>
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Docente / Turma
              </p>

              <p className="text-xl font-bold">
                {booking.teacherName}
              </p>

              <p className="text-sm font-medium text-primary">
                {classMap[booking.schoolClassId]?.name ?? "Turma não encontrada"}
              </p>
            </div>

            <div className="flex flex-col gap-3">

              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CalendarDays className="w-4 h-4 text-primary" />
                <span>{formattedDate} às {booking.startTime}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-primary" />

                <span>
                  {locationMap[booking.photoLocationId]?.name ?? 'Local não encontrado'}

                  {booking.locationIdentifier
                    ? ` (${booking.locationIdentifier})`
                    : ''
                  }
                </span>

              </div>

            </div>

            <div className="bg-muted/30 p-6 rounded-2xl border border-dashed border-slate-300">

              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-3">
                Observações
              </p>

              <ScrollArea className="h-[100px]">
                <p className="text-sm italic text-slate-700 whitespace-pre-wrap">
                  {booking.observations || "Sem notas."}
                </p>
              </ScrollArea>

            </div>

          </div>

          {/* COLUNA DIREITA */}

          <div className="p-8 bg-slate-50">

            <div className="flex items-center gap-2 text-primary mb-6">
              <History className="w-6 h-6" />
              <h3 className="font-bold text-lg">
                Histórico
              </h3>
            </div>

            <ScrollArea className="h-[320px] pr-4">

              <div className="space-y-6 relative border-l-2 border-primary/20 pl-6 ml-2">

                {history.map((e) => (

                  <div key={e.timestamp} className="relative">

                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-white border-2 border-primary shadow-sm" />

                    <div className="flex justify-between items-center mb-1">

                      <span className="text-[9px] font-bold text-primary uppercase bg-primary/5 px-2 py-0.5 rounded">
                        {e.action}
                      </span>

                      <span className="text-[10px] text-muted-foreground">
                        {format(parseISO(e.timestamp), "dd/MM HH:mm")}
                      </span>

                    </div>

                    <p className="text-sm font-medium text-slate-700 leading-relaxed">
                      {e.details}
                    </p>

                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <UserIcon className="w-2.5 h-2.5" />
                      {e.userName}
                    </p>

                  </div>

                ))}

              </div>

            </ScrollArea>

          </div>

        </div>

        <DialogFooter className="p-6 border-t bg-white flex justify-between">

          <div className="flex gap-2">

            {userPerms?.canEditAppointments && (

              <Button
                variant="outline"
                onClick={() => onReschedule(booking)}
                className="rounded-xl border-primary text-primary hover:bg-primary/5"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Reagendar
              </Button>

            )}

            {userPerms?.canCancelAppointments && booking.status !== 'CANCELLED' && (

              <Button
                variant="outline"
                onClick={() => onStatusUpdate(booking, 'CANCELLED')}
                className="rounded-xl border-orange-200 text-orange-600 hover:bg-orange-50"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Cancelar
              </Button>

            )}

            {userPerms?.canDeleteAppointments && (

              <Button
                variant="ghost"
                onClick={() => onDelete(booking.id)}
                className="rounded-xl text-destructive hover:bg-destructive/5"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </Button>

            )}

          </div>

          <Button
            onClick={onClose}
            className="rounded-xl px-10 h-11 font-bold"
          >
            Fechar
          </Button>

        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
