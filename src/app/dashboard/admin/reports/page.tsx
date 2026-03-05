
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, Legend } from 'recharts';
import { Download, FileText, Share2, TrendingUp, Users, Calendar } from 'lucide-react';
import { bookings, classes, segments, locations } from '@/lib/db';

export default function ReportsPage() {
  const segmentData = segments.map(s => {
    const count = bookings.filter(b => {
      const cls = classes.find(c => c.id === b.classId);
      return cls?.segmentId === s.id && b.status === 'CONFIRMED';
    }).length;
    return { name: s.name, value: count };
  }).filter(d => d.value > 0);

  const locationData = locations.map(l => {
    const count = bookings.filter(b => b.locationId === l.id && b.status === 'CONFIRMED').length;
    return { name: l.name, count };
  }).filter(d => d.count > 0);

  const COLORS = ['#2258CC', '#56CEDE', '#4ADE80', '#F472B6', '#FB923C'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios de Fotos</h1>
          <p className="text-muted-foreground">Analise o volume de sessões por segmento, local e período.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl h-11 bg-white">
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button className="rounded-xl h-11 bg-primary">
            <FileText className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Sessões por Segmento
            </CardTitle>
            <CardDescription>Distribuição de fotos confirmadas.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={segmentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label
                >
                  {segmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Popularidade de Locais
            </CardTitle>
            <CardDescription>Quantidade de agendamentos por local.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={locationData}>
                <XAxis dataKey="name" fontSize={10} />
                <YAxis />
                <ChartTooltip cursor={{fill: '#f1f5f9'}} />
                <Bar dataKey="count" fill="#2258CC" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-primary text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium opacity-80">Total de Sessões</p>
                <p className="text-3xl font-bold">{bookings.length}</p>
              </div>
              <Calendar className="w-10 h-10 opacity-30" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-white border">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Turmas Atendidas</p>
                <p className="text-3xl font-bold">{new Set(bookings.map(b => b.classId)).size}</p>
              </div>
              <Users className="w-10 h-10 text-primary opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Média p/ Semana</p>
                <p className="text-3xl font-bold">4.2</p>
              </div>
              <TrendingUp className="w-10 h-10 text-accent opacity-30" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
