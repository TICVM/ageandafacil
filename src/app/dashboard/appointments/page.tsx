
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarDays, MapPin, Users, Clock, Search, MoreHorizontal, Loader2, Trash2, Hash, Info, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Booking, Class, PhotoLocation } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AppointmentsPage() {
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const appointmentsRef = useMemoFirebase(() => db ? collection(db, 'appointments') : null, [db]);
  const classesRef = useMemoFirebase(() => db ? collection(db, 'school_classes') : null, [db]);
  const locationsRef = useMemoFirebase(() => db ? collection(db, 'photo_locations') : null, [db]);

  const { data: list, isLoading } = useCollection<Booking>(appointmentsRef);
  const { data: classes } = useCollection<Class>(classesRef);
  const { data: locations } = useCollection<PhotoLocation>(locationsRef);

  const handleCancel = (id: string) => {
    if (!db) return;
    updateDocumentNonBlocking(doc(db, 'appointments', id), { status: 'CANCELLED' });
    toast({ title: "Agendamento Cancelado" });
  };

  const handleDelete = (id: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'appointments', id));
    toast({ title: "Agendamento Excluído" });
  };

  const sortedList = list ? [...list].sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate)) : [];

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

  const formatCreationDate = (createdAt: any) => {
    if (!createdAt) return null;
    // Se for Timestamp do Firestore
    if (createdAt.seconds) {
      return new Date(createdAt.seconds * 1000).toLocaleDateString('pt-BR');
    }
    // Se for String
    return new Date(createdAt).toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda Global</h1>
          <p className="text-muted-foreground">Visualize todos os agendamentos realizados pelos professores.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por professor ou data..." 
            className="pl-9 rounded-xl h-11 bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow>
                <TableHead className="font-bold">Data / Hora</TableHead>
                <TableHead className="font-bold">Professor / Turma</TableHead>
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
                  const bookedAt = formatCreationDate(b.createdAt);

                  return (
                    <TableRow key={b.id} className="hover:bg-accent/5">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-2 rounded-lg text-primary">
                            <CalendarDays className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold">{new Date(b.appointmentDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                            <span className="text-xs text-muted-foreground">{b.startTime} - {b.endTime}</span>
                            {bookedAt && (
                              <span className="text-[10px] text-muted-foreground/60 mt-1">
                                Reservado em: {bookedAt}
                              </span>
                            )}
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
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{loc?.name || '---'}</span>
                          {b.locationIdentifier && (
                            <span className="text-[10px] text-primary font-bold flex items-center gap-1">
                              <Hash className="w-2.5 h-2.5" />
                              {b.locationIdentifier}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(b.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full text-primary hover:bg-primary/10"
                            onClick={() => setSelectedBooking(b)}
                          >
                            <Info className="w-4 h-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="rounded-full">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl p-2">
                              {b.status !== 'CANCELLED' && (
                                <DropdownMenuItem onClick={() => handleCancel(b.id)}>Cancelar Sessão</DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive flex items-center gap-2"
                                onClick={() => handleDelete(b.id)}
                              >
                                <Trash2 className="w-3 h-3" /> Excluir Registro
                              </DropdownMenuItem>
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
                    Nenhum agendamento encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Modal de Detalhes do Agendamento */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="max-w-2xl rounded-3xl overflow-hidden p-0">
          {selectedBooking && (
            <div className="flex flex-col">
              <div className="bg-primary p-6 text-primary-foreground">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-primary-foreground">
                    <FileText className="w-6 h-6" />
                    Detalhes da Sessão
                  </DialogTitle>
                  <DialogDescription className="text-primary-foreground/80">
                    Informações completas para a equipe de marketing.
                  </DialogDescription>
                </DialogHeader>
              </div>
              
              <ScrollArea className="max-h-[70vh]">
                <div className="p-8 space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Professor(a)</p>
                      <p className="text-lg font-bold">{selectedBooking.teacherName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Turma</p>
                      <p className="text-lg font-bold">
                        {classes?.find(c => c.id === selectedBooking.schoolClassId)?.name || '---'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Local / Unidade</p>
                      <div className="flex flex-col">
                        <span className="text-lg font-bold">
                          {locations?.find(l => l.id === selectedBooking.photoLocationId)?.name || '---'}
                        </span>
                        {selectedBooking.locationIdentifier && (
                          <span className="text-sm text-primary font-bold flex items-center gap-1">
                            <Hash className="w-3 h-3" /> {selectedBooking.locationIdentifier}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Horário</p>
                      <p className="text-lg font-bold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        {selectedBooking.startTime} - {selectedBooking.endTime}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 bg-muted/30 p-5 rounded-2xl border border-dashed">
                    <h4 className="font-bold flex items-center gap-2">
                      <Info className="w-4 h-4 text-primary" />
                      Observações do Professor
                    </h4>
                    <p className="text-sm leading-relaxed text-muted-foreground italic">
                      {selectedBooking.observations || "Nenhuma observação informada."}
                    </p>
                  </div>

                  {selectedBooking.aiBrief && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="flex items-center gap-2 text-accent-foreground">
                        <Sparkles className="w-5 h-5" />
                        <h4 className="font-bold">Briefing Detalhado (IA)</h4>
                      </div>
                      
                      <div className="grid gap-4">
                        <Card className="border-none shadow-sm bg-accent/5 p-4 rounded-xl">
                          <p className="text-xs font-bold text-accent-foreground mb-1 uppercase">Narrativa da Sessão</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{selectedBooking.aiBrief.detailedBrief}</p>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-accent-foreground uppercase">Atividades Planejadas</p>
                            <ul className="space-y-1">
                              {selectedBooking.aiBrief.keyActivities.map((act, i) => (
                                <li key={i} className="text-xs flex items-center gap-2 text-muted-foreground">
                                  <CheckCircle2 className="w-3 h-3 text-green-500" /> {act}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-accent-foreground uppercase">Fotos Sugeridas</p>
                            <ul className="space-y-1">
                              {selectedBooking.aiBrief.preferredShots.map((shot, i) => (
                                <li key={i} className="text-xs flex items-center gap-2 text-muted-foreground">
                                  <CheckCircle2 className="w-3 h-3 text-primary" /> {shot}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <Card className="border-none shadow-sm bg-primary/5 p-4 rounded-xl">
                          <p className="text-xs font-bold text-primary mb-1 uppercase">Vibe / Atmosfera Desejada</p>
                          <p className="text-sm text-muted-foreground font-medium">{selectedBooking.aiBrief.desiredMood}</p>
                        </Card>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              <div className="p-6 bg-muted/20 border-t flex justify-end">
                <Button onClick={() => setSelectedBooking(null)} className="rounded-xl">
                  Fechar Detalhes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
