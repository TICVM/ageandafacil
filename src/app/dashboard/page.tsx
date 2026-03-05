
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Camera, MapPin, CheckCircle2, Clock, AlertTriangle, ListTodo, PieChart } from 'lucide-react';
import { bookings, classes, locations } from '@/lib/db';
import { Booking, User } from '@/lib/types';
import Link from 'next/link';

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [userBookings, setUserBookings] = useState<Booking[]>([]);

  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem('user') || 'null');
    setUser(savedUser);
    if (savedUser?.role === 'ADMIN') {
      setUserBookings(bookings);
    } else {
      setUserBookings(bookings.filter(b => b.teacherId === savedUser?.id));
    }
  }, []);

  const nextBooking = userBookings
    .filter(b => b.status === 'CONFIRMED' && new Date(b.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  const stats = [
    {
      title: 'Agendamentos Ativos',
      value: userBookings.filter(b => b.status === 'CONFIRMED').length,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-100'
    },
    {
      title: 'Sessões Pendentes',
      value: userBookings.filter(b => b.status === 'PENDING').length,
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-100'
    },
    {
      title: 'Próximos 7 Dias',
      value: userBookings.filter(b => {
        const d = new Date(b.date);
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        return d >= today && d <= nextWeek;
      }).length,
      icon: CalendarDays,
      color: 'text-purple-600',
      bg: 'bg-purple-100'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bem-vindo, {user?.name}</h1>
        <p className="text-muted-foreground">Aqui está o resumo da sua agenda de fotos escolares.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <div className={`${stat.bg} ${stat.color} p-3 rounded-2xl group-hover:scale-110 transition-transform`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Card className="shadow-md border-none">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Próxima Sessão
            </CardTitle>
            <CardDescription>O agendamento confirmado mais próximo.</CardDescription>
          </CardHeader>
          <CardContent>
            {nextBooking ? (
              <div className="bg-muted/30 p-6 rounded-2xl border border-dashed border-primary/20 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-bold text-primary">
                      {classes.find(c => c.id === nextBooking.classId)?.name}
                    </h3>
                    <p className="font-medium text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {locations.find(l => l.id === nextBooking.locationId)?.name}
                    </p>
                  </div>
                  <div className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-center">
                    <span className="block text-xl font-bold">{nextBooking.date.split('-')[2]}</span>
                    <span className="text-[10px] uppercase font-bold tracking-tighter">
                      {new Date(nextBooking.date).toLocaleDateString('pt-BR', { month: 'short' })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{nextBooking.startTime} - {nextBooking.endTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-xs uppercase font-bold tracking-widest text-green-600">Confirmado</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-muted/20 rounded-2xl border-2 border-dashed border-muted">
                <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Nenhuma sessão agendada em breve.</p>
                <Link href="/dashboard/schedule">
                  <Button variant="link" className="mt-2">Agendar agora</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md border-none">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Ações Rápidas
            </CardTitle>
            <CardDescription>Acesse as funções mais comuns.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Link href="/dashboard/schedule" className="col-span-2">
              <Button className="w-full h-16 text-lg rounded-2xl shadow-sm hover:shadow-md transition-all gap-3 bg-primary">
                <CalendarDays className="w-6 h-6" />
                Novo Agendamento
              </Button>
            </Link>
            <Link href="/dashboard/appointments">
              <Button variant="outline" className="w-full h-24 rounded-2xl flex-col gap-2 hover:bg-accent/10 border-accent/20">
                <ListTodo className="w-6 h-6 text-accent-foreground" />
                Ver Agenda
              </Button>
            </Link>
            <Link href="/dashboard/admin/reports">
              <Button variant="outline" className="w-full h-24 rounded-2xl flex-col gap-2 hover:bg-accent/10 border-accent/20">
                <PieChart className="w-6 h-6 text-accent-foreground" />
                Relatórios
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="bg-primary/5 rounded-3xl p-8 border border-primary/10">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="bg-primary p-4 rounded-2xl shadow-lg">
            <Camera className="w-10 h-10 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Dicas para uma sessão incrível</h2>
            <p className="text-muted-foreground max-w-2xl mt-2">
              Lembre-se de verificar o local com antecedência e avisar os pais sobre o dia da foto. 
              Utilize nosso assistente de IA para criar briefs detalhados para a equipe de marketing.
            </p>
          </div>
          <Button className="md:ml-auto rounded-xl">Ler mais dicas</Button>
        </div>
      </div>
    </div>
  );
}
