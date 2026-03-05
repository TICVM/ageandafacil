
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarDays, MapPin, Users, Clock, Search, MoreHorizontal, Loader2, Trash2, Hash } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { Booking, Class, PhotoLocation } from '@/lib/types';

export default function AppointmentsPage() {
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');

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
                  return (
                    <TableRow key={b.id} className="hover:bg-accent/5">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-2 rounded-lg text-primary">
                            <CalendarDays className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold">{new Date(b.appointmentDate).toLocaleDateString('pt-BR')}</span>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl p-2">
                            {b.status !== 'CANCELLED' && (
                              <DropdownMenuItem onClick={() => handleCancel(b.id)}>Cancelar</DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive flex items-center gap-2"
                              onClick={() => handleDelete(b.id)}
                            >
                              <Trash2 className="w-3 h-3" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
    </div>
  );
}
