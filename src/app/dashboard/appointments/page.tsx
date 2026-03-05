
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarDays, MapPin, Users, Clock, Search, MoreHorizontal, Filter, XCircle } from 'lucide-react';
import { bookings, classes, locations, segments } from '@/lib/db';
import { Booking, User } from '@/lib/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';

export default function AppointmentsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [list, setList] = useState<Booking[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem('user') || 'null');
    setUser(savedUser);
    setList(savedUser?.role === 'ADMIN' ? bookings : bookings.filter(b => b.teacherId === savedUser?.id));
  }, []);

  const handleCancel = (id: string) => {
    setList(prev => prev.map(b => b.id === id ? { ...b, status: 'CANCELLED' } : b));
    toast({ title: "Agendamento Cancelado", description: "O horário foi liberado com sucesso." });
  };

  const filtered = list.filter(b => {
    const cls = classes.find(c => c.id === b.classId);
    return cls?.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'CONFIRMED': return <Badge className="bg-green-500 rounded-lg">Confirmado</Badge>;
      case 'PENDING': return <Badge variant="secondary" className="rounded-lg">Pendente</Badge>;
      case 'CANCELLED': return <Badge variant="destructive" className="rounded-lg">Cancelado</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda de Fotos</h1>
          <p className="text-muted-foreground">Gerencie seus horários reservados com a equipe de marketing.</p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por turma..." 
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
        <Table>
          <TableHeader className="bg-muted/20">
            <TableRow>
              <TableHead className="font-bold">Data / Hora</TableHead>
              <TableHead className="font-bold">Turma / Segmento</TableHead>
              <TableHead className="font-bold">Local</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="text-right font-bold">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? (
              filtered.sort((a,b) => b.date.localeCompare(a.date)).map((b) => {
                const cls = classes.find(c => c.id === b.classId);
                const seg = segments.find(s => s.id === cls?.segmentId);
                const loc = locations.find(l => l.id === b.locationId);

                return (
                  <TableRow key={b.id} className="hover:bg-accent/5">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary">
                          <CalendarDays className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold">{new Date(b.date).toLocaleDateString('pt-BR')}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {b.startTime} - {b.endTime}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold">{cls?.name}</span>
                        <span className="text-xs text-muted-foreground">{seg?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span className="text-sm">{loc?.name}</span>
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
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Users className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-lg font-medium">Nenhum agendamento encontrado.</p>
                    <p className="text-sm">Tente ajustar seus filtros ou realizar uma nova busca.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
