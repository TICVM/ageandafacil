
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, MapPin, Search, MoreHorizontal, Loader2, Trash2, Info, FileText, Edit3, XCircle, CalendarIcon, Clock, Hash, Save } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, getDoc } from 'firebase/firestore';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from '@/hooks/use-toast';
import { Booking, Class, PhotoLocation, User, RoleConfig, AppPermissions, TimeSlot, ScheduleBlock } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Funções utilitárias estáveis
const timeToMin = (t: string) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h * 60) + m;
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

  // Estados para edição/reagendamento
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editSlotId, setEditSlotId] = useState<string>('');
  const [editLocationId, setEditLocationId] = useState<string>('');
  const [editIdentifier, setEditIdentifier] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Carregamento de Perfil e Permissões
  useEffect(() => {
    async function fetchPermissions() {
      if (!db || !authUser) return;
      
      const userEmail = authUser.email?.toLowerCase().trim();
      const isMasterEmail = userEmail === 'herbertpacheco@cvmsp.com.br';

      try {
        const userDoc = await getDoc(doc(db, 'users', authUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          setProfile({ ...userData, id: authUser.uid });

          if (userData.roleId === 'ADMIN' || isMasterEmail) {
            setUserPerms({
              canManageUsers: true, canConfigureSlots: true, canManageLocations: true,
              canManageClasses: true, canViewReports: true, canViewAllAppointments: true,
              canViewSegmentAppointments: true, canViewClassAppointments: true,
              canEditAppointments: true, canCancelAppointments: true, canDeleteAppointments: true,
              canCreateBookings: true
            });
          } else {
            const roleDoc = await getDoc(doc(db, 'roles_config', userData.roleId));
            if (roleDoc.exists()) {
              setUserPerms(roleDoc.data() as RoleConfig);
            }
          }
        } else if (isMasterEmail) {
          setProfile({ id: authUser.uid, name: 'Herbert Pacheco', email: userEmail || '', roleId: 'ADMIN' });
          setUserPerms({
            canManageUsers: true, canConfigureSlots: true, canManageLocations: true,
            canManageClasses: true, canViewReports: true, canViewAllAppointments: true,
            canViewSegmentAppointments: true, canViewClassAppointments: true,
            canEditAppointments: true, canCancelAppointments: true, canDeleteAppointments: true,
            canCreateBookings: true
          });
        }
      } catch (err) {
        console.error("Erro ao carregar permissões:", err);
      }
    }
    fetchPermissions();
  }, [db, authUser]);

  // Queries Estabilizadas
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

  const handleCancel = useCallback((id: string) => {
    if (!db || !userPerms?.canCancelAppointments) return;
    updateDocumentNonBlocking(doc(db, 'appointments', id), { status: 'CANCELLED' });
    toast({ title: "Agendamento Cancelado" });
  }, [db, userPerms]);

  const handleDelete = useCallback((id: string) => {
    if (!db || !userPerms?.canDeleteAppointments) return;
    deleteDocumentNonBlocking(doc(db, 'appointments', id));
    toast({ title: "Agendamento Excluído" });
  }, [db, userPerms]);

  const handleOpenEdit = (booking: Booking) => {
    const bookingDate = new Date(booking.appointmentDate + 'T00:00:00');
    setEditDate(bookingDate);
    setEditLocationId(booking.photoLocationId);
    setEditIdentifier(booking.locationIdentifier || '');
    setEditNotes(booking.observations || '');
    
    // Tenta encontrar o slot correspondente pelo horário
    const matchingSlot = slots?.find(s => s.startTime === booking.startTime);
    setEditSlotId(matchingSlot?.id || '');
    setEditingBooking(booking);
  };

  const handleSaveEdit = async () => {
    if (!db || !editingBooking || !editDate || !editSlotId || !editLocationId) {
      toast({ title: "Dados Incompletos", description: "Verifique data e horário.", variant: "destructive" });
      return;
    }

    const slot = slots?.find(s => s.id === editSlotId);
    if (!slot) {
      toast({ title: "Erro de Horário", description: "O horário selecionado não é mais válido.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    
    try {
      const [h, m] = slot.startTime.split(':').map(Number);
      const duration = slot.durationMinutes || 60;
      const endTotal = (h * 60) + m + duration;
      const endH = Math.floor(endTotal / 60).toString().padStart(2, '0');
      const endM = (endTotal % 60).toString().padStart(2, '0');

      const updateData = {
        appointmentDate: format(editDate, 'yyyy-MM-dd'),
        startTime: slot.startTime,
        endTime: `${endH}:${endM}`,
        photoLocationId: editLocationId,
        locationIdentifier: editIdentifier || null,
        observations: editNotes,
        status: 'CONFIRMED'
      };

      updateDocumentNonBlocking(doc(db, 'appointments', editingBooking.id), updateData);

      // Limpeza imediata de estado e fechar diálogo
      setEditingBooking(null);
      toast({ title: "Sessão Atualizada!", description: "O reagendamento foi processado." });
    } catch (e) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const availableSlots = useMemo(() => {
    if (!slots || !editDate || !editingBooking || !classes) return [];
    
    const dateStr = format(editDate, 'yyyy-MM-dd');
    const dayOfWeekStr = editDate.getDay().toString();
    const cls = classes.find(c => c.id === editingBooking.schoolClassId);
    
    const takenStartTimes = list?.filter(app => 
      app.id !== editingBooking.id &&
      app.appointmentDate === dateStr && 
      app.status === 'CANCELLED' === false
    ).map(app => app.startTime) || [];

    return slots.filter(s => {
      if (s.dayOfWeek !== dayOfWeekStr) return false;

      const targetMatches = s.schoolClassId 
        ? s.schoolClassId === editingBooking.schoolClassId
        : s.schoolSegmentId 
          ? s.schoolSegmentId === cls?.schoolSegmentId
          : !s.schoolClassId && !s.schoolSegmentId;
      
      if (!targetMatches) return false;
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

  const filtered = useMemo(() => {
    if (!list || !profile || !userPerms) return [];
    
    let result = list.filter(booking => {
      const isMaster = profile.roleId === 'ADMIN' || authUser?.email === 'herbertpacheco@cvmsp.com.br';
      if (isMaster || userPerms.canViewAllAppointments) return true;

      const cls = classes?.find(c => c.id === booking.schoolClassId);
      if (userPerms.canViewSegmentAppointments) {
        if (profile.segmentIds?.includes(cls?.schoolSegmentId || '')) return true;
      }
      if (userPerms.canViewClassAppointments) {
        if (profile.classIds?.includes(booking.schoolClassId)) return true;
        if (booking.teacherId === profile.id) return true;
      }
      return false;
    });

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(b => 
        b.teacherName?.toLowerCase().includes(lowerSearch) || 
        b.appointmentDate.includes(searchTerm)
      );
    }

    return [...result].sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));
  }, [list, profile, userPerms, classes, authUser, searchTerm]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return <Badge className="bg-green-500 rounded-lg">Confirmado</Badge>;
      case 'CANCELLED': return <Badge variant="destructive" className="rounded-lg">Cancelado</Badge>;
      default: return <Badge className="rounded-lg">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda Global</h1>
          <p className="text-muted-foreground">Visualize e gerencie as sessões de fotos.</p>
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
        {isLoading || !userPerms ? (
          <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
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

                  return (
                    <TableRow key={b.id} className="hover:bg-accent/5">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-2 rounded-lg text-primary"><CalendarDays className="w-4 h-4" /></div>
                          <div className="flex flex-col">
                            <span className="font-bold">{new Date(b.appointmentDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                            <span className="text-xs text-muted-foreground">{b.startTime} - {b.endTime}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold">{b.teacherName}</span>
                          <span className="text-xs text-muted-foreground">{cls?.name || '---'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{loc?.name || '---'}</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(b.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-2">
                          <Button variant="ghost" size="icon" className="rounded-full text-primary" onClick={() => setSelectedBooking(b)}><Info className="w-4 h-4" /></Button>
                          
                          {(userPerms.canEditAppointments || userPerms.canCancelAppointments || userPerms.canDeleteAppointments) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-full"><MoreHorizontal className="w-4 h-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl p-2">
                                {userPerms.canEditAppointments && (
                                  <DropdownMenuItem onClick={() => handleOpenEdit(b)} className="gap-2 cursor-pointer">
                                    <Edit3 className="w-3.5 h-3.5" /> Reagendar / Editar
                                  </DropdownMenuItem>
                                )}
                                {userPerms.canCancelAppointments && b.status !== 'CANCELLED' && (
                                  <DropdownMenuItem onClick={() => handleCancel(b.id)} className="gap-2 text-orange-600 cursor-pointer">
                                    <XCircle className="w-3.5 h-3.5" /> Cancelar Sessão
                                  </DropdownMenuItem>
                                )}
                                {userPerms.canDeleteAppointments && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleDelete(b.id)} className="gap-2 text-destructive cursor-pointer">
                                      <Trash2 className="w-3.5 h-3.5" /> Excluir Registro
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
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
        )}
      </Card>

      {/* Detalhes da Sessão */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="max-w-2xl rounded-3xl overflow-hidden p-0">
          <DialogHeader className="bg-primary p-6 text-primary-foreground">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-primary-foreground"><FileText className="w-6 h-6" /> Detalhes da Sessão</DialogTitle>
            <DialogDescription className="text-primary-foreground/80">Informações completas sobre o agendamento selecionado.</DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="flex flex-col">
              <ScrollArea className="max-h-[60vh] p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">Docente / Turma</p>
                    <p className="text-lg font-bold">{selectedBooking.teacherName}</p>
                    <p className="text-sm text-muted-foreground">{classes?.find(c => c.id === selectedBooking.schoolClassId)?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground">Status</p>
                    <div className="mt-1">{getStatusBadge(selectedBooking.status)}</div>
                  </div>
                </div>
                <div className="bg-muted/30 p-5 rounded-2xl border border-dashed">
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Notas do Professor</p>
                  <p className="text-sm italic whitespace-pre-wrap">{selectedBooking.observations || "Sem observações."}</p>
                </div>
              </ScrollArea>
              <DialogFooter className="p-6 bg-muted/20"><Button onClick={() => setSelectedBooking(null)} className="rounded-xl">Fechar</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reagendamento / Edição */}
      <Dialog open={!!editingBooking} onOpenChange={(open) => !open && !isSaving && setEditingBooking(null)}>
        <DialogContent className="max-w-2xl rounded-3xl overflow-hidden p-0">
          <DialogHeader className="bg-orange-500 p-6 text-white">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-white"><Edit3 className="w-6 h-6" /> Reagendar Sessão</DialogTitle>
            <DialogDescription className="text-orange-50/80">Selecione uma nova data e horário disponível para esta turma.</DialogDescription>
          </DialogHeader>
          {editingBooking && (
            <div className="flex flex-col">
              <div className="p-8 space-y-6 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-orange-500" /> Nova Data</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full h-11 justify-start rounded-xl" disabled={isSaving}>
                          {editDate ? format(editDate, "PPP", { locale: ptBR }) : "Escolha a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={editDate} onSelect={setEditDate} locale={ptBR} disabled={(d) => isSaving || d < new Date()} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold flex items-center gap-2"><Clock className="w-4 h-4 text-orange-500" /> Novo Horário</label>
                    <Select value={editSlotId} onValueChange={setEditSlotId} disabled={isSaving || !editDate}>
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue placeholder="Escolha o horário" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSlots.length > 0 ? (
                          availableSlots.map(s => <SelectItem key={s.id} value={s.id}>{s.startTime} ({s.durationMinutes} min)</SelectItem>)
                        ) : (
                          <div className="p-4 text-xs text-center text-muted-foreground italic">Sem horários disponíveis para esta data.</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold flex items-center gap-2"><MapPin className="w-4 h-4 text-orange-500" /> Local</label>
                    <Select value={editLocationId} onValueChange={setEditLocationId} disabled={isSaving}>
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {locations?.filter(l => l.isActive).map(l => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold flex items-center gap-2"><Hash className="w-4 h-4 text-orange-500" /> Identificador Local</label>
                    <Input 
                      placeholder="Ex: Sala 05..." 
                      value={editIdentifier} 
                      onChange={(e) => setEditIdentifier(e.target.value)}
                      className="rounded-xl h-11"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold">Observações Adicionais</label>
                  <Input 
                    placeholder="Notas para o fotógrafo..." 
                    value={editNotes} 
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="rounded-xl h-11"
                    disabled={isSaving}
                  />
                </div>
              </div>
              <DialogFooter className="p-6 bg-muted/20 gap-2">
                <Button variant="outline" onClick={() => setEditingBooking(null)} className="rounded-xl" disabled={isSaving}>Cancelar</Button>
                <Button onClick={handleSaveEdit} className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white gap-2 min-w-[140px]" disabled={isSaving || !editSlotId}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Confirmar Alterações
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
