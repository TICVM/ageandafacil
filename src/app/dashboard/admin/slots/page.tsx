
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Plus, Trash2, CalendarDays } from 'lucide-react';
import { slotTemplates, segments } from '@/lib/db';
import { toast } from '@/hooks/use-toast';

const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function SlotAdminPage() {
  const [slots, setSlots] = useState(slotTemplates);
  const [newSlot, setNewSlot] = useState({ day: '1', time: '08:00', duration: '60' });

  const handleAdd = () => {
    const id = Math.random().toString(36).substr(2, 9);
    setSlots(prev => [...prev, {
      id,
      dayOfWeek: parseInt(newSlot.day),
      startTime: newSlot.time,
      durationMinutes: parseInt(newSlot.duration)
    }]);
    toast({ title: "Horário Adicionado", description: "O novo template de horário foi criado." });
  };

  const handleRemove = (id: string) => {
    setSlots(prev => prev.filter(s => s.id !== id));
    toast({ title: "Horário Removido" });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuração de Horários</h1>
        <p className="text-muted-foreground">Defina os horários padrão disponíveis para agendamento em cada dia da semana.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 shadow-md border-none h-fit">
          <CardHeader>
            <CardTitle className="text-xl">Novo Template</CardTitle>
            <CardDescription>Cadastre um horário recorrente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Dia da Semana</label>
              <Select onValueChange={(v) => setNewSlot({...newSlot, day: v})} defaultValue={newSlot.day}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {days.map((d, i) => (
                    <SelectItem key={i} value={i.toString()}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Início</label>
              <Input 
                type="time" 
                value={newSlot.time} 
                onChange={(e) => setNewSlot({...newSlot, time: e.target.value})}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Duração (minutos)</label>
              <Input 
                type="number" 
                value={newSlot.duration} 
                onChange={(e) => setNewSlot({...newSlot, duration: e.target.value})}
                className="rounded-xl"
              />
            </div>
            <Button onClick={handleAdd} className="w-full rounded-xl gap-2 h-11">
              <Plus className="w-4 h-4" />
              Adicionar Horário
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-md border-none">
          <CardHeader>
            <CardTitle className="text-xl">Horários Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {days.map((dayName, dayIndex) => {
                const daySlots = slots.filter(s => s.dayOfWeek === dayIndex);
                if (daySlots.length === 0) return null;

                return (
                  <div key={dayIndex} className="bg-muted/30 p-4 rounded-2xl space-y-3">
                    <h3 className="font-bold text-primary flex items-center gap-2">
                      <CalendarDays className="w-4 h-4" />
                      {dayName}
                    </h3>
                    <div className="space-y-2">
                      {daySlots.sort((a,b) => a.startTime.localeCompare(b.startTime)).map(s => (
                        <div key={s.id} className="bg-white p-3 rounded-xl border flex justify-between items-center shadow-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="font-semibold">{s.startTime}</span>
                            <span className="text-xs text-muted-foreground">({s.durationMinutes} min)</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full"
                            onClick={() => handleRemove(s.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
