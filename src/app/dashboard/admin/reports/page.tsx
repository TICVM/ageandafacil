
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, 
  Legend, CartesianGrid 
} from 'recharts';
import { Download, FileText, TrendingUp, Users, Calendar, CheckCircle, Loader2 } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Booking, Class, Segment } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ReportsPage() {
  const db = useFirestore();
  
  const appointmentsRef = useMemoFirebase(() => db ? collection(db, 'appointments') : null, [db]);
  const classesRef = useMemoFirebase(() => db ? collection(db, 'school_classes') : null, [db]);
  const segmentsRef = useMemoFirebase(() => db ? collection(db, 'school_segments') : null, [db]);

  const { data: appointments, isLoading: loadingApps } = useCollection<Booking>(appointmentsRef);
  const { data: classes } = useCollection<Class>(classesRef);
  const { data: segments } = useCollection<Segment>(segmentsRef);

  // Processamento de dados para os gráficos
  const stats = useMemo(() => {
    if (!appointments || !classes || !segments) return null;

    // 1. Sessões por Segmento
    const segmentCounts = segments.map(seg => {
      const count = appointments.filter(app => {
        const cls = classes.find(c => c.id === app.schoolClassId);
        return cls?.schoolSegmentId === seg.id;
      }).length;
      return { name: seg.name, value: count };
    }).filter(d => d.value > 0);

    // 2. Sessões por Turma (Top 10)
    const classCounts = classes.map(cls => {
      const count = appointments.filter(app => app.schoolClassId === cls.id).length;
      return { name: cls.name, count };
    }).filter(d => d.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 3. Evolução Mensal (Total vs Concluídos)
    const monthlyData: Record<string, { month: string, total: number, completed: number }> = {};
    
    appointments.forEach(app => {
      const date = parseISO(app.appointmentDate);
      const monthKey = format(date, 'yyyy-MM');
      const monthLabel = format(date, 'MMM/yy', { locale: ptBR });

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthLabel, total: 0, completed: 0 };
      }
      
      monthlyData[monthKey].total += 1;
      if (app.status === 'COMPLETED') {
        monthlyData[monthKey].completed += 1;
      }
    });

    const monthlyTrend = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

    return {
      segmentCounts,
      classCounts,
      monthlyTrend,
      total: appointments.length,
      completed: appointments.filter(a => a.status === 'COMPLETED').length,
      pending: appointments.filter(a => a.status === 'PENDING').length
    };
  }, [appointments, classes, segments]);

  const COLORS = ['#2258CC', '#56CEDE', '#4ADE80', '#F472B6', '#FB923C', '#6366F1'];

  if (loadingApps || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Gerando relatórios...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Relatórios de Fotos</h1>
          <p className="text-muted-foreground">Análise de desempenho, turmas e status das sessões.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl h-11 bg-white border-slate-200">
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          <Button className="rounded-xl h-11 bg-primary shadow-lg shadow-primary/20">
            <FileText className="w-4 h-4 mr-2" />
            Gerar PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-primary text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-bold uppercase opacity-70">Total Geral</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <Calendar className="w-10 h-10 opacity-20" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-bold uppercase opacity-70">Concluídos</p>
                <p className="text-3xl font-bold">{stats.completed}</p>
              </div>
              <CheckCircle className="w-10 h-10 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border border-slate-200">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Em Aberto</p>
                <p className="text-3xl font-bold text-slate-800">{stats.pending}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-primary opacity-10" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border border-slate-200">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Taxa de Sucesso</p>
                <p className="text-3xl font-bold text-slate-800">
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                </p>
              </div>
              <Users className="w-10 h-10 text-accent opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-md bg-white">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Evolução Mensal
            </CardTitle>
            <CardDescription>Comparativo entre agendamentos totais e sessões concluídas.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <ChartTooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" />
                <Bar name="Total Agendado" dataKey="total" fill="#2258CC" radius={[4, 4, 0, 0]} />
                <Bar name="Total Concluído" dataKey="completed" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Sessões por Turma
            </CardTitle>
            <CardDescription>Top 10 turmas com maior volume de registros.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.classCounts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" fontSize={10} width={100} tickLine={false} axisLine={false} />
                <ChartTooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="count" fill="#56CEDE" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <PieChart className="w-5 h-5 text-primary" />
              Distribuição por Segmento
            </CardTitle>
            <CardDescription>Volume de sessões distribuído pelas etapas de ensino.</CardDescription>
          </CardHeader>
          <CardContent className="h-80 flex items-center justify-center">
            <div className="w-full h-full md:w-2/3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.segmentCounts}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={8}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {stats.segmentCounts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
