'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock, MapPin, Sparkles, Loader2, CheckCircle2, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, doc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { AISessionBriefAssistantOutput } from '@/lib/types';
import { aiSessionBriefAssistant } from '@/ai/flows/ai-session-brief-assistant-flow';
import { toast } from '@/hooks/use-toast';

export default function SchedulePage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  
  const [date, setDate] = useState<Date>();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiBrief, setAiBrief] = useState<AISessionBriefAssistantOutput | null>(null);

  const classesQuery = useMemoFirebase(() => db ? collection(db, 'school_classes') : null, [db]);
  const locationsQuery = useMemoFirebase(() => db ? collection(db, 'photo_locations') : null, [db]);
  const slotsQuery = useMemoFirebase(() => db ? collection(db, 'available_time_slots') : null, [db]);

  const { data: classes } = useCollection(classesQuery);
  const { data: locations } = useCollection(locationsQuery);
  const { data: slots } = useCollection(slotsQuery);

  const filteredClasses = classes?.filter(c => c.responsibleTeacherId === user?.uid) || [];
  const activeLocations = locations?.filter(l => l.isActive) || [];

  const handleGenerateAiBrief = async () => {
    if (!notes || !selectedClassId || !selectedLocationId) {
      toast({ title: "Dados incompletos", description: "Preencha a turma, local e suas notas primeiro.", variant: "destructive" });
      return;
    }

    setIsAiLoading(true);
    try {
      const cls = classes?.find(c => c.id === selectedClassId);
      const loc = locations?.find(l => l.id === selectedLocationId);

      const result = await aiSessionBriefAssistant({
        briefNotes: notes,
        className: cls?.name || 'Turma não identificada',
        segmentName: 'Geral', // Contexto simplificado
        locationName: loc?.name || 'Local não identificado',
      });
      setAiBrief(result);
      toast({ title: "Briefing gerado com sucesso!", description: "A IA expandiu suas notas para a equipe de marketing." });
    } catch (error) {
      toast({ title: "Erro ao gerar briefing", description: "Tente novamente mais tarde.", variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSchedule = () => {
    if (!date || !selectedClassId || !selectedLocationId || !selectedSlotId || !db || !user) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }

    const slot = slots?.find(s => s.id === selectedSlotId);
    if (!slot) return;

    // Calcular hora de término simplificada
    const [h, m] = slot.startTime.split(':').map(Number);
    const endTotal = h * 60 + m + 60; // 60 minutos padrão
    const endH = Math.floor(endTotal / 60).toString().padStart(2, '0');
    const endM = (endTotal % 60).toString().padStart(2, '0');

    const appointmentData = {
      schoolClassId: selectedClassId,
      teacherId: user.uid,
      photoLocationId: selectedLocationId,
      appointmentDate: format(date, 'yyyy-MM-dd'),
      startTime: slot.startTime,
      endTime: `${endH}:${endM}`,
      sessionDurationMinutes: 60,
      status: 'CONFIRMED',
      observations: notes,
      aiBrief: aiBrief || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    addDocumentNonBlocking(collection(db, 'appointments'), appointmentData);

    toast({ title: "Agendamento Realizado!", description: "Sua sessão de fotos foi confirmada." });
    router.push('/dashboard/appointments');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Novo Agendamento</h1>
        <p className="text-muted-foreground">Siga os passos abaixo para reservar sua sessão de fotos no banco de dados real.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <Card className="shadow-lg border-none overflow-hidden">
            <CardHeader className="bg-primary text-primary-foreground p-6">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                Dados da Sessão
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Turma</label>
                  <Select onValueChange={setSelectedClassId} value={selectedClassId}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="Selecione a turma" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredClasses.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Local da Foto</label>
                  <Select onValueChange={setSelectedLocationId} value={selectedLocationId}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="Selecione o local" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeLocations.map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Data</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full h-11 justify-start text-left font-normal rounded-xl",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        initialFocus
                        disabled={(d) => d < new Date() || d > new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Horário Disponível</label>
                  <Select onValueChange={setSelectedSlotId} value={selectedSlotId} disabled={!date}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder={date ? "Selecione o horário" : "Escolha a data primeiro"} />
                    </SelectTrigger>
                    <SelectContent>
                      {slots?.filter(s => s.dayOfWeek === date?.getDay().toString() || s.dayOfWeek === date?.getDay()).map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            {s.startTime}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold">Notas e Observações</label>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="text-primary hover:text-primary/80 gap-1 rounded-lg"
                    onClick={handleGenerateAiBrief}
                    disabled={isAiLoading || !notes}
                  >
                    {isAiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Melhorar com IA
                  </Button>
                </div>
                <Textarea 
                  placeholder="Ex: Alunos estarão fantasiados. Queremos fotos de ação na quadra..."
                  className="rounded-xl min-h-[120px] bg-muted/20"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 p-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => router.back()} className="rounded-xl">Cancelar</Button>
              <Button onClick={handleSchedule} className="rounded-xl px-8 h-11 bg-primary text-lg">AGENDAR</Button>
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-md bg-accent/5 overflow-hidden">
            <CardHeader className="p-6">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent-foreground" />
                Assistente IA
              </CardTitle>
              <CardDescription>O briefing detalhado que será enviado ao Marketing.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              {aiBrief ? (
                <div className="space-y-4 animate-in zoom-in-95 duration-300">
                  <div className="p-4 bg-white rounded-xl border border-accent/20 shadow-sm space-y-3">
                    <h4 className="font-bold text-accent-foreground text-sm">Resumo Detalhado:</h4>
                    <p className="text-xs leading-relaxed text-muted-foreground">{aiBrief.detailedBrief}</p>
                    
                    <h4 className="font-bold text-accent-foreground text-sm">Atividades Chave:</h4>
                    <ul className="text-xs space-y-1">
                      {aiBrief.keyActivities.map((act, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                          {act}
                        </li>
                      ))}
                    </ul>

                    <h4 className="font-bold text-accent-foreground text-sm">Fotos Preferidas:</h4>
                    <ul className="text-xs space-y-1">
                      {aiBrief.preferredShots.map((shot, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <Camera className="w-3 h-3 text-primary" />
                          {shot}
                        </li>
                      ))}
                    </ul>

                    <div className="pt-2">
                      <h4 className="font-bold text-accent-foreground text-sm">Clima Desejado:</h4>
                      <p className="text-xs text-muted-foreground">{aiBrief.desiredMood}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full text-[10px] text-muted-foreground" onClick={() => setAiBrief(null)}>Descartar e refazer</Button>
                </div>
              ) : (
                <div className="text-center py-12 px-4 border-2 border-dashed border-accent/20 rounded-2xl">
                  <p className="text-xs text-muted-foreground italic">Escreva suas notas e clique em "Melhorar com IA" para ver a mágica acontecer.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-primary/5">
            <CardContent className="p-6 space-y-3">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Dica do Local
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {selectedLocationId 
                  ? locations?.find(l => l.id === selectedLocationId)?.description 
                  : "Selecione um local para ver dicas de iluminação e posicionamento."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
