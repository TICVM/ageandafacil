
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarDays, MapPin, Search, MoreHorizontal, Loader2, Trash2, Info, FileText, Edit3, XCircle } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, getDoc } from 'firebase/firestore';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Booking, Class, PhotoLocation, User, RoleConfig, AppPermissions } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AppointmentsPage() {
  const db = useFirestore();
  const { user: authUser } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [userPerms, setUserPerms] = useState<AppPermissions | null>(null);

  useEffect(() => {
    async function fetchPermissions() {
      if (!db || !authUser) return;
      
      const userEmail = authUser.email?.toLowerCase().trim();
      const isMasterEmail = userEmail === 'herbertpacheco@cvmsp.com.br';

      const userDoc = await getDoc(doc(db, 'users', authUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        setProfile({ ...userData, id: authUser.uid });

        // Administrador Master por e-mail ou por Role fixa
        if (userData.roleId === 'ADMIN' || isMasterEmail) {
          setUserPerms({
            canManageUsers: true, canConfigureSlots: true, canManageLocations: true,
            canManageClasses: true, canViewReports: true, canViewAllAppointments: true,
            canViewSegmentAppointments: true, canViewClassAppointments: true,
            canEditAppointments: true, canCancelAppointments: true, canDeleteAppointments: true,
            canCreateBookings: true
          });
        } else {
          // Busca permissões dinâmicas do cargo
          const roleDoc = await getDoc(doc(db, 'roles_config', userData.roleId));
          if (roleDoc.exists()) {
            setUserPerms(roleDoc.data() as RoleConfig);
          }
        }
      } else if (isMasterEmail) {
        // Fallback Master Admin
        setProfile({ id: authUser.uid, name: 'Herbert Pacheco', email: userEmail || '', roleId: 'ADMIN' });
        setUserPerms({
          canManageUsers: true, canConfigureSlots: true, canManageLocations: true,
          canManageClasses: true, canViewReports: true, canViewAllAppointments: true,
          canViewSegmentAppointments: true, canViewClassAppointments: true,
          canEditAppointments: true, canCancelAppointments: true, canDeleteAppointments: true,
          canCreateBookings: true
        });
      }
    }
    fetchPermissions();
  }, [db, authUser]);

  const appointmentsRef = useMemoFirebase(() => db ? collection(db, 'appointments') : null, [db]);
  const classesRef = useMemoFirebase(() => db ? collection(db, 'school_classes') : null, [db]);
  const locationsRef = useMemoFirebase(() => db ? collection(db, 'photo_locations') : null, [db]);

  const { data: list, isLoading } = useCollection<Booking>(appointmentsRef);
  const { data: classes } = useCollection<Class>(classesRef);
  const { data: locations } = useCollection<PhotoLocation>(locationsRef);

  const handleCancel = (id: string) => {
    if (!db || !userPerms?.canCancelAppointments) return;
    updateDocumentNonBlocking(doc(db, 'appointments', id), { status: 'CANCELLED' });
    toast({ title: "Agendamento Cancelado" });
  };

  const handleDelete = (id: string) => {
    if (!db || !userPerms?.canDeleteAppointments) return;
    deleteDocumentNonBlocking(doc(db, 'appointments', id));
    toast({ title: "Agendamento Excluído" });
  };

  // FILTRAGEM DINÂMICA POR NÍVEL DE VISUALIZAÇÃO
  const filteredByPermissions = list?.filter(booking => {
    if (!profile || !userPerms) return false;
    
    // Nível Master: Ver tudo (Garante acesso irrestrito por e-mail ou cargo ADMIN)
    if (profile.roleId === 'ADMIN' || authUser?.email === 'herbertpacheco@cvmsp.com.br' || userPerms.canViewAllAppointments) {
      return true;
    }

    // Nível 2: Ver por Segmento
    if (userPerms.canViewSegmentAppointments) {
      const cls = classes?.find(c => c.id === booking.schoolClassId);
      if (profile.segmentIds?.includes(cls?.schoolSegmentId || '')) return true;
    }

    // Nível 3: Ver por Turma/Docente
    if (userPerms.canViewClassAppointments) {
      if (profile.classIds?.includes(booking.schoolClassId)) return true;
      if (booking.teacherId === profile.id) return true;
    }

    return false;
  }) || [];

  const sortedList = [...filteredByPermissions].sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));
  const filtered = sortedList.filter(b => 
    b.teacherName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.appointmentDate.includes(searchTerm)
  );

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
          <p className="text-muted-foreground">Visualização total para Administradores Master.</p>
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
                                  <DropdownMenuItem className="gap-2"><Edit3 className="w-3.5 h-3.5" /> Reagendar / Editar</DropdownMenuItem>
                                )}
                                {userPerms.canCancelAppointments && b.status !== 'CANCELLED' && (
                                  <DropdownMenuItem onClick={() => handleCancel(b.id)} className="gap-2 text-orange-600"><XCircle className="w-3.5 h-3.5" /> Cancelar Sessão</DropdownMenuItem>
                                )}
                                {userPerms.canDeleteAppointments && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleDelete(b.id)} className="gap-2 text-destructive"><Trash2 className="w-3.5 h-3.5" /> Excluir Registro</DropdownMenuItem>
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

      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="max-w-2xl rounded-3xl overflow-hidden p-0">
          {selectedBooking && (
            <div className="flex flex-col">
              <div className="bg-primary p-6 text-primary-foreground">
                <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-primary-foreground"><FileText className="w-6 h-6" /> Detalhes da Sessão</DialogTitle>
              </div>
              <ScrollArea className="max-h-[70vh] p-8 space-y-6">
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
                  <p className="text-sm italic">{selectedBooking.observations || "Sem observações."}</p>
                </div>
                {selectedBooking.aiBrief && (
                  <div className="space-y-4">
                    <p className="text-xs font-bold uppercase text-primary">Briefing IA</p>
                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 text-sm whitespace-pre-wrap">{selectedBooking.aiBrief.detailedBrief}</div>
                  </div>
                )}
              </ScrollArea>
              <DialogFooter className="p-6 bg-muted/20"><Button onClick={() => setSelectedBooking(null)} className="rounded-xl">Fechar</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
