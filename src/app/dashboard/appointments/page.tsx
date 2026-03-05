'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarDays, MapPin, Users, Clock, Search, MoreHorizontal, Filter, Loader2 } from 'lucide-react';
import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { Booking } from '@/lib/types';

export default function AppointmentsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState('');

  // Removido o orderBy para evitar erro de índice composto no Firestore
  const appointmentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'appointments'),
      where('teacherId', '==', user.uid)
    );
  }, [db, user]);

  const { data: list, isLoading } = useCollection<Booking>(appointmentsQuery);

  const handleCancel = (id: string) => {
    if (!db) return;
    const docRef = doc(db, 'appointments', id);
    updateDocumentNonBlocking(docRef, { status: 'CANCELLED' });
    toast({ title: "Agendamento Cancelado", description: "O horário foi liberado com sucesso." });
  };

  // Ordenação realizada no cliente (mais recente primeiro)
  const sortedList = list ? [...list].sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate)) : [];

  const filtered = sortedList.filter(b => 
    b.status.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.appointmentDate.includes(searchTerm)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return <Badge className="bg-green-500 rounded-lg">Confirmado</Badge>;
      case 'PENDING': return <Badge variant="secondary" className="rounded-lg">Pendente</Badge>;
      case 'CANCELLED': return <Badge variant="destructive" className="rounded-lg">Cancelado</Badge>;
      default: return <Badge className="rounded-lg">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda de Fotos</h1>
          <p className="text-muted-foreground">Gerencie seus horários reservados no banco de dados.</p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar agendamento..." 
              className="pl-9 rounded-xl h-11 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="rounded-xl h-11 bg-white">
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
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
                <TableHead className="font-bold">Detalhes</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="text-right font-bold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? (
                filtered.map((b) => (
                  <TableRow key={b.id} className="hover:bg-accent/5">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary">
                          <CalendarDays className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold">{new Date(b.appointmentDate).toLocaleDateString('pt-BR')}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {b.startTime} - {b.endTime}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{b.observations || 'Sem observações'}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Sessão de fotos
                        </span>
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
                          <DropdownMenuItem className="rounded-lg cursor-pointer">Ver Detalhes</DropdownMenuItem>
                          {b.status !== 'CANCELLED' && (
                            <DropdownMenuItem 
                              className="text-destructive rounded-lg cursor-pointer focus:bg-destructive/10 focus:text-destructive"
                              onClick={() => handleCancel(b.id)}
                            >
                              Cancelar Sessão
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Users className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-lg font-medium">Nenhum agendamento encontrado.</p>
                      <p className="text-sm">Os dados agora são carregados do Firestore.</p>
                    </div>
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