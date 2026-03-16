'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarDays, Calendar as CalendarIcon, Edit3, Loader2 } from 'lucide-react';
import {
  format,
  parseISO,
  addDays,
  addHours,
  startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Booking, Class, TimeSlot, ScheduleBlock, AppSettings, User, HistoryEntry } from '@/lib/types';

interface RescheduleDialogProps {
  booking: Booking | null;
  onClose: () => void;
  classes: Class[] | null;
  slots: TimeSlot[] | null;
  allAppointments: Booking[] | null;
  allBlocks: ScheduleBlock[] | null;
  appSettings: AppSettings | null;
  profile: User | null;
}

const timeToMin = (t: string) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h * 60) + m;
};

export function RescheduleDialog({
  booking,
  onClose,
  classes,
  slots,
  allAppointments,
  allBlocks,
  appSettings,
  profile,
}: RescheduleDialogProps) {
  const db = useFirestore();
  const [newDate, setNewDate] = useState<Date>();
  const [newSlotId, setNewSlotId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const classMap = useMemo(() => {
    const map: Record<string, Class> = {};
    classes?.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [classes]);

  const availableSlots = useMemo(() => {
    if (!slots || !newDate || !booking) return [];
    const dateStr = format(newDate, 'yyyy-MM-dd');
    const day = newDate.getDay().toString();
    const now = new Date();

    const minLimit = addHours(
      addDays(startOfDay(now), appSettings?.minAdvanceRescheduleDays ?? 1),
      appSettings?.minAdvanceRescheduleHours ?? 0
    );
    const cls = classMap[booking.schoolClassId];

    return slots
      .filter((s) => {
        if (s.dayOfWeek !== day) return false;
        const targetMatches = s.schoolClassId
          ? s.schoolClassId === booking.schoolClassId
          : s.schoolSegmentId
          ? s.schoolSegmentId === cls?.schoolSegmentId
          : !s.schoolClassId && !s.schoolSegmentId;
        if (!targetMatches) return false;

        const [h, m] = s.startTime.split(':').map(Number);
        const sDT = new Date(newDate);
        sDT.setHours(h, m, 0, 0);
        if (sDT < minLimit) return false;

        if (
          allAppointments?.some(
            (app) =>
              app.id !== booking.id &&
              app.appointmentDate === dateStr &&
              app.startTime === s.startTime &&
              app.status !== 'CANCELLED'
          )
        )
          return false;

        return !allBlocks?.some(
          (b) =>
            b.date === dateStr &&
            timeToMin(s.startTime) < timeToMin(b.endTime) &&
            timeToMin(s.startTime) + (s.durationMinutes || 60) > timeToMin(b.startTime)
        );
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [slots, newDate, booking, classMap, allAppointments, allBlocks, appSettings]);

  const handleRescheduleAction = () => {
    if (!newDate || !newSlotId || !db || !profile || !booking) return;

    setIsSaving(true);
    const slot = slots?.find((s) => s.id === newSlotId);
    if (!slot) {
      setIsSaving(false);
      return;
    }

    const [h, m] = slot.startTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + (slot.durationMinutes || 60);
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    const endTimeStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

    const formattedDate = format(newDate, 'yyyy-MM-dd');
    const newHistoryEntry: HistoryEntry = {
      timestamp: new Date().toISOString(),
      userId: profile.id,
      userName: profile.name,
      action: 'REAGENDAMENTO',
      details: `Sessão reagendada de ${format(
        parseISO(`${booking.appointmentDate}T00:00:00`),
        'dd/MM/yyyy'
      )} ${booking.startTime} para ${format(newDate, 'dd/MM/yyyy')} ${slot.startTime}.`,
    };

    updateDocumentNonBlocking(doc(db, 'appointments', booking.id), {
      appointmentDate: formattedDate,
      startTime: slot.startTime,
      endTime: endTimeStr,
      status: 'RESCHEDULED',
      history: [...(booking.history || []), newHistoryEntry],
    });

    setTimeout(() => {
      setIsSaving(false);
      onClose();
      toast({
        title: 'Sessão Reagendada!',
        description: 'O novo horário foi salvo com sucesso.',
      });
    }, 500);
  };

  return (
    <Dialog open={!!booking} onOpenChange={(open) => !open && onClose()} modal={false}>
      <DialogContent 
        className="max-w-xl rounded-3xl p-0 overflow-hidden shadow-2xl border-none z-[130]"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="bg-primary p-8 text-white">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Edit3 className="w-7 h-7" /> Reagendar Sessão
          </DialogTitle>
          <DialogDescription className="text-white/70 text-sm">
            Selecione a nova data e horário para esta sessão de fotos.
          </DialogDescription>
        </DialogHeader>
        {booking && (
          <div className="p-8 space-y-8">
            <div className="bg-muted/30 p-6 rounded-2xl border border-dashed border-slate-300">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">
                Registro Atual
              </p>
              <div className="flex flex-col gap-1">
                <p className="font-bold text-slate-800">
                  {booking.teacherName} - {classMap[booking.schoolClassId]?.name}
                </p>
                <p className="text-sm text-slate-600 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  {format(parseISO(`${booking.appointmentDate}T00:00:00`), 'dd/MM/yyyy')} às{' '}
                  {booking.startTime}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label>Nova Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-12 justify-start rounded-xl text-left">
                      <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                      {newDate ? format(newDate, 'dd/MM/yyyy') : 'Escolha o dia'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[150]" align="start">
                    <Calendar
                      mode="single"
                      selected={newDate}
                      onSelect={setNewDate}
                      locale={ptBR}
                      disabled={(d) =>
                        d <
                        addDays(
                          startOfDay(new Date()),
                          appSettings?.minAdvanceRescheduleDays ?? 1
                        )
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-3">
                <Label>Novo Horário</Label>
                <Select value={newSlotId} onValueChange={setNewSlotId} disabled={!newDate}>
                  <SelectTrigger className="rounded-xl h-12">
                    <SelectValue placeholder="Escolha o horário" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.startTime}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="p-8 bg-slate-50 border-t flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="rounded-xl h-12 px-8">
            Cancelar
          </Button>
          <Button
            onClick={handleRescheduleAction}
            disabled={!newDate || !newSlotId || isSaving}
            className="rounded-xl h-12 px-10 font-bold shadow-lg"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Gravar Reagendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
