
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Camera, MapPin, CheckCircle2, Clock, AlertTriangle, ListTodo, PieChart, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, getDoc } from 'firebase/firestore';
import { Booking, User } from '@/lib/types';

export default function Dashboard() {
  const db = useFirestore();
  const { user } = useUser();
  const [profile, setProfile] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [now, setNow] = useState<Date | null>(null);

  // Evita erros de hidratação inicializando a data apenas no cliente
  useEffect(() => {
    setNow(new Date());
  }, []);

  useEffect(() => {
    async function fetchProfile() {
      if (!db || !user) return;
      try {
        const userEmail = user.email?.toLowerCase().trim();
        if (userEmail === 'herbertpacheco@cvmsp.com.br') {
          setProfile({ id: user.uid, name: 'Herbert Pacheco', email: userEmail, roleId: 'ADMIN' } as User);
          setLoadingProfile(false);
          return;
        }

        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          setProfile({ ...snap.data() as User, id: snap.id });
        }
      } catch (e) {
        console.error("Erro ao carregar perfil no dashboard:", e);
      } finally {
        setLoadingProfile(false);
      }
    }
    fetchProfile();
  }, [db, user]);

  const isAdmin = useMemo(() => {
    return profile?.roleId === 'ADMIN' || user?.email === 'herbertpacheco@cvmsp.com.br';
  }, [profile, user]);

  const appointmentsQuery = useMemoFirebase(() => {
    if (!db || !user || loadingProfile) return null;
    
    // Admins vêem tudo, Professores vêem apenas o seu
    if (isAdmin) {
      return collection(db, 'appointments');
    }
    
    return query(
      collection(db, 'appointments'),
      where('teacherId', '==', user.uid)
    );
  }, [db, user, isAdmin, loadingProfile]);

  const { data: rawBookings, isLoading: isLoadingBookings } = useCollection<Booking>(appointmentsQuery);

  const userBookings = useMemo(() => {
    if (!rawBookings) return [];
    return [...rawBookings].sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate));
  }, [rawBookings]);

  const nextBooking = useMemo(() => {
    if (!userBookings || !now) return null;
    const todayStr = now.toISOString().split('T')[0];
    return userBookings.find(b => b.status === 'CONFIRMED' && b.appointmentDate >= todayStr);
  }, [userBookings, now]);

  const stats = useMemo(() => {
    if (!now) return [];
    const today = new Date(now);
    const nextWeek = new Date(now);
    nextWeek.setDate(today.getDate() + 7);
    const todayStr = today.toISOString().split('T')[0];
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    return [
      {
        title: isAdmin ? 'Total Confirmados' : 'Meus Agendamentos',
        value: userBookings.filter(b => b.status === 'CONFIRMED').length,
        icon: CheckCircle2,
        color: 'text-green-600',
        bg: 'bg-green-100'
      },
      {
        title: 'Aguardando Confirmação',
        value: userBookings.filter(b => b.status === 'PENDING').length,
        icon: Clock,
        color: 'text-blue-600',
        bg: 'bg-blue-100'
      },
      {
        title: 'Próximos 7 Dias',
        value: userBookings.filter(b => b.appointmentDate >= todayStr && b.appointmentDate <= nextWeekStr).length,
        icon: CalendarDays,
        color: 'text-purple-600',
        bg: 'bg-purple-100'
      }
    ];
  }, [userBookings, isAdmin, now]);

  if (isLoadingBookings || loadingProfile || !now) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando painel...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {isAdmin ? 'Painel Administrativo' : `Olá, ${profile?.name || 'Docente'}`}
        </h1>
        <p className="text-muted-foreground">
          {isAdmin 
            ? 'Visão geral de todos os agendamentos da unidade.' 
            : 'Confira o resumo da sua agenda de fotos escolares.'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-shadow bg-white">
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
        <Card className="shadow-md border-none bg-white">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              {isAdmin ? 'Sessão mais Próxima' : 'Sua Próxima Sessão'}
            </CardTitle>
            <CardDescription>O agendamento confirmado cronologicamente mais próximo.</CardDescription>
          </CardHeader>
          <CardContent>
            {nextBooking ? (
              <div className="bg-primary/5 p-6 rounded-3xl border border-dashed border-primary/20 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-bold text-primary">
                      {nextBooking.teacherName}
                    </h3>
                    <p className="font-medium text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="w-4 h-4" />
                      Sessão confirmada
                    </p>
                  </div>
                  <div className="bg-primary text-primary-foreground px-4 py-2 rounded-2xl text-center shadow-lg">
                    <span className="block text-xl font-bold">{nextBooking.appointmentDate.split('-')[2]}</span>
                    <span className="text-[10px] uppercase font-bold tracking-tighter">
                      {new Date(nextBooking.appointmentDate + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-4 border-t border-primary/10">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{nextBooking.startTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-green-600">CONFIRMADO</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-muted/20 rounded-3xl border-2 border-dashed border-muted">
                <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Nenhuma sessão confirmada em breve.</p>
                {!isAdmin && (
                  <Link href="/reserva">
                    <Button variant="link" className="mt-2 text-primary font-bold">Agendar agora</Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md border-none bg-white">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Links Úteis
            </CardTitle>
            <CardDescription>Acesse as funções do sistema rapidamente.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Link href="/reserva" className="col-span-2">
              <Button className="w-full h-16 text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all gap-3 bg-primary hover:scale-[1.02]">
                <CalendarDays className="w-6 h-6" />
                Novo Agendamento
              </Button>
            </Link>
            <Link href="/dashboard/appointments">
              <Button variant="outline" className="w-full h-24 rounded-2xl flex-col gap-2 hover:bg-primary/5 border-slate-200 transition-all hover:border-primary/50">
                <ListTodo className="w-6 h-6 text-primary" />
                Ver Agenda
              </Button>
            </Link>
            <Link href={isAdmin ? "/dashboard/admin/reports" : "/dashboard/appointments"}>
              <Button variant="outline" className="w-full h-24 rounded-2xl flex-col gap-2 hover:bg-primary/5 border-slate-200 transition-all hover:border-primary/50">
                <PieChart className="w-6 h-6 text-primary" />
                {isAdmin ? 'Relatórios' : 'Meu Histórico'}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-3xl p-8 border shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="bg-primary p-4 rounded-2xl shadow-xl">
            <Camera className="w-10 h-10 text-primary-foreground" />
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-bold text-slate-800">Dicas para uma sessão incrível</h2>
            <p className="text-muted-foreground max-w-2xl mt-2 leading-relaxed">
              Lembre-se de conferir se o local está disponível e avisar os pais com antecedência. 
              Sessões bem planejadas geram os melhores registros para a escola!
            </p>
          </div>
          <Button variant="outline" className="md:ml-auto rounded-xl border-primary text-primary hover:bg-primary/5">Ver Tutorial</Button>
        </div>
      </div>
    </div>
  );
}
