'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, Plus, Trash2, Loader2, ListPlus, Save, Timer, AlertCircle, CalendarIcon, ShieldAlert, Copy, Filter, BookOpen, LayoutGrid, Download, Upload } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp, setDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { toast } from '@/hooks/use-toast';
import { TimeSlot, Class, Segment, ScheduleBlock, AppSettings, Subject } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import * as XLSX from 'xlsx';


const DAYS_OF_WEEK = [
  { id: '1', label: 'Segunda', short: 'Seg' },
  { id: '2', label: 'Terça', short: 'Ter' },
  { id: '3', label: 'Quarta', short: 'Qua' },
  { id: '4', label: 'Quinta', short: 'Qui' },
  { id: '5', label: 'Sexta', short: 'Sex' },
  { id: '6', label: 'Sábado', short: 'Sáb' },
  { id: '0', label: 'Domingo', short: 'Dom' },
];

const PREDEFINED_COLORS = [
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Verde', value: '#10b981' },
  { name: 'Amarelo', value: '#f59e0b' },
  { name: 'Vermelho', value: '#ef4444' },
  { name: 'Roxo', value: '#8b5cf6' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Ciano', value: '#06b6d4' },
  { name: 'Laranja', value: '#f97316' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Slate', value: '#64748b' },
];

export default function SlotAdminPage() {
  const db = useFirestore();
  
  const slotsRef = useMemoFirebase(() => db ? collection(db, 'available_time_slots') : null, [db]);
  const classesRef = useMemoFirebase(() => db ? collection(db, 'school_classes') : null, [db]);
  const segmentsRef = useMemoFirebase(() => db ? collection(db, 'school_segments') : null, [db]);
  const blocksRef = useMemoFirebase(() => db ? collection(db, 'schedule_blocks') : null, [db]);
  const settingsRef = useMemoFirebase(() => db ? doc(db, 'app_settings', 'general') : null, [db]);
  const subjectsRef = useMemoFirebase(() => db ? collection(db, 'school_subjects') : null, [db]);

  const { data: slots, isLoading: loadingSlots } = useCollection<TimeSlot>(slotsRef);
  const { data: rawClasses } = useCollection<Class>(classesRef);
  const { data: rawSegments } = useCollection<Segment>(segmentsRef);
  const { data: blocks, isLoading: loadingBlocks } = useCollection<ScheduleBlock>(blocksRef);
  const { data: appSettings } = useDoc<AppSettings>(settingsRef);
  const { data: rawSubjects } = useCollection<Subject>(subjectsRef);

  const sortedSegments = rawSegments ? [...rawSegments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];
  const sortedClasses = rawClasses ? [...rawClasses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];

  const sortedSubjects = rawSubjects ? [...rawSubjects].sort((a, b) => a.name.localeCompare(b.name)) : [];

  // Filtros de Visualização
  const [filterType, setFilterType] = useState<'all' | 'global' | 'segment' | 'class'>('all');
  const [filterId, setFilterId] = useState('');

  // Novo Horário
  const [selectedDays, setSelectedDays] = useState<string[]>(['1', '2', '3', '4', '5']);
  const [bulkTimes, setBulkTimes] = useState('08:00, 09:00-30, 10:00');
  const [defaultDuration, setDefaultDuration] = useState('50');
  const [defaultSubject, setDefaultSubject] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [targetType, setTargetType] = useState<'global' | 'segment' | 'class'>('global');
  const [targetId, setTargetId] = useState('');
  
  // Bloqueios
  const [blockDate, setBlockDate] = useState<Date>();
  const [blockMultipleDates, setBlockMultipleDates] = useState<Date[]>([]);
  const [blockStart, setBlockStart] = useState('07:00');
  const [blockEnd, setBlockEnd] = useState('18:00');
  const [blockReason, setBlockReason] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkDatesText, setBulkDatesText] = useState('');

  // Duplicação (Exportar)
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [copySourceType, setCopySourceType] = useState<'global' | 'segment' | 'class'>('global');
  const [copySourceId, setCopySourceId] = useState('');
  const [copyDestType, setCopyDestType] = useState<'segment' | 'class'>('segment');
  const [copyDestId, setCopyDestId] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isSavingRules, setIsSavingRules] = useState(false);

  const [bookingDays, setBookingDays] = useState(1);
  const [bookingHours, setBookingHours] = useState(0);
  const [rescheduleDays, setRescheduleDays] = useState(1);
  const [rescheduleHours, setRescheduleHours] = useState(0);

  // Grade Curricular
  const [gridClassId, setGridClassId] = useState('');
  const [editingGridSlot, setEditingGridSlot] = useState<TimeSlot | null>(null);
  const [tempSubject, setTempSubject] = useState('');
  const [selectedRepeatDays, setSelectedRepeatDays] = useState<string[]>([]);
  const [selectedRepeatTimes, setSelectedRepeatTimes] = useState<string[]>([]);
  
  // Estados para Disciplinas com Cores
  const [newSubjectColor, setNewSubjectColor] = useState('#3b82f6');
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  const [editSubjectColor, setEditSubjectColor] = useState('');
  
  // Categorização de Disciplinas (Múltipla)
  const [subjectTargetType, setSubjectTargetType] = useState<'global' | 'segment' | 'class'>('global');
  const [subjectTargetIds, setSubjectTargetIds] = useState<string[]>([]);
  const [editSubjectTargetType, setEditSubjectTargetType] = useState<'global' | 'segment' | 'class'>('global');
  const [editSubjectTargetIds, setEditSubjectTargetIds] = useState<string[]>([]);

  // Preview de Importação
  const [importPreviewData, setImportPreviewData] = useState<TimeSlot[]>([]);
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('replace');
  const [newSubjectsToRegister, setNewSubjectsToRegister] = useState<string[]>([]);
  const [newSubjectColorsMap, setNewSubjectColorsMap] = useState<Record<string, string>>({});
  const [importFileClassIds, setImportFileClassIds] = useState<string[]>([]);
  const [importFileSegmentIds, setImportFileSegmentIds] = useState<string[]>([]);

  const filteredSubjectsForGrid = useMemo(() => {
    if (!sortedSubjects || !editingGridSlot) return [];
    
    const currentClass = sortedClasses.find(c => c.id === editingGridSlot.schoolClassId);
    const currentSegmentId = editingGridSlot.schoolSegmentId || currentClass?.schoolSegmentId;
    
    return sortedSubjects.filter(s => {
      // Global
      if ((!s.schoolSegmentIds || s.schoolSegmentIds.length === 0) && (!s.schoolClassIds || s.schoolClassIds.length === 0)) return true;
      
      // Segment match
      if (currentSegmentId && s.schoolSegmentIds?.includes(currentSegmentId)) return true;
      
      // Class match
      if (editingGridSlot.schoolClassId && s.schoolClassIds?.includes(editingGridSlot.schoolClassId)) return true;
      
      return false;
    });
  }, [sortedSubjects, editingGridSlot, sortedClasses]);

  const getContrastColor = (hexColor?: string) => {
    if (!hexColor) return 'inherit';
    const hex = hexColor.replace('#', '');
    if (hex.length < 6) return '#000000';
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const subjectsImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (appSettings) {
      setBookingDays(appSettings.minAdvanceBookingDays ?? 1);
      setBookingHours(appSettings.minAdvanceBookingHours ?? 0);
      setRescheduleDays(appSettings.minAdvanceRescheduleDays ?? 1);
      setRescheduleHours(appSettings.minAdvanceRescheduleHours ?? 0);
    }
  }, [appSettings]);

  const filteredSlots = useMemo(() => {
    if (!slots) return [];
    return slots.filter(s => {
      if (filterType === 'all') return true;
      if (filterType === 'global') return !s.schoolSegmentId && !s.schoolClassId;
      if (filterType === 'segment') return s.schoolSegmentId === filterId;
      if (filterType === 'class') return s.schoolClassId === filterId;
      return true;
    });
  }, [slots, filterType, filterId]);

  const handleSaveRules = async () => {
    if (!db || !settingsRef) return;
    setIsSavingRules(true);
    try {
      await setDoc(settingsRef, {
        minAdvanceBookingDays: bookingDays,
        minAdvanceBookingHours: bookingHours,
        minAdvanceRescheduleDays: rescheduleDays,
        minAdvanceRescheduleHours: rescheduleHours,
      }, { merge: true });
      toast({ title: "Regras Atualizadas" });
    } catch (e) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsSavingRules(false);
    }
  };

  const handleToggleDay = (dayId: string) => {
    setSelectedDays(prev => 
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
    );
  };

  const handleBatchAdd = async () => {
    if (!db || selectedDays.length === 0 || !bulkTimes.trim()) {
      toast({ title: "Preencha os dias e horários", variant: "destructive" });
      return;
    }
    
    const timeEntries = bulkTimes.split(',').map(t => t.trim()).filter(Boolean);
    const parsedEntries: { startTime: string; duration: number; subject: string }[] = [];

    for (const entry of timeEntries) {
      const parts = entry.split('-');
      const time = parts[0];
      const dur = parts[1];
      const subject = parts[2] || defaultSubject;

      if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
        parsedEntries.push({ 
          startTime: time, 
          duration: parseInt(dur) || parseInt(defaultDuration),
          subject: subject.trim()
        });
      }
    }

    if (parsedEntries.length === 0) {
      toast({ title: "Nenhum horário válido. Use HH:mm, HH:mm-dur ou HH:mm-dur-Matéria", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const slotsCol = collection(db, 'available_time_slots');
      
      selectedDays.forEach(day => {
        parsedEntries.forEach(entry => {
          const newRef = doc(slotsCol);
          batch.set(newRef, {
            dayOfWeek: day,
            startTime: entry.startTime,
            durationMinutes: entry.duration,
            subject: entry.subject,
            schoolSegmentId: targetType === 'segment' ? targetId : null,
            schoolClassId: targetType === 'class' ? targetId : null,
            isActive: true
          });
        });
      });

      await batch.commit();
      toast({ title: `${parsedEntries.length * selectedDays.length} horários criados!` });
      setBulkTimes('');
    } catch (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicateGrade = async () => {
    if (!db || !copyDestId) {
      toast({ title: "Selecione o destino", variant: "destructive" });
      return;
    }

    setIsCopying(true);
    try {
      const slotsCol = collection(db, 'available_time_slots');
      let q;
      if (copySourceType === 'global') {
        q = query(slotsCol, where('schoolSegmentId', '==', null), where('schoolClassId', '==', null));
      } else if (copySourceType === 'segment') {
        q = query(slotsCol, where('schoolSegmentId', '==', copySourceId));
      } else {
        q = query(slotsCol, where('schoolClassId', '==', copySourceId));
      }

      const snap = await getDocs(q);
      if (snap.empty) {
        toast({ title: "Origem não possui horários." });
        setIsCopying(false);
        return;
      }

      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        const data = d.data();
        const newRef = doc(slotsCol);
        batch.set(newRef, {
          ...(data as object),
          schoolSegmentId: copyDestType === 'segment' ? copyDestId : null,
          schoolClassId: copyDestType === 'class' ? copyDestId : null,
        });
      });

      await batch.commit();
      toast({ title: `Sucesso! ${snap.size} horários duplicados.` });
      setIsCopyDialogOpen(false);
    } catch (e) {
      toast({ title: "Erro ao duplicar", variant: "destructive" });
    } finally {
      setIsCopying(false);
    }
  };

  const handleAddBlock = async () => {
    if (!db || !blockReason) {
      toast({ title: "Preencha o motivo", variant: "destructive" });
      return;
    }

    const datesToBlock = isBulkMode ? blockMultipleDates : (blockDate ? [blockDate] : []);

    if (datesToBlock.length === 0) {
      toast({ title: "Escolha as datas", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const blocksCol = collection(db, 'schedule_blocks');

      datesToBlock.forEach(d => {
        const newRef = doc(blocksCol);
        batch.set(newRef, {
          date: format(d, 'yyyy-MM-dd'),
          startTime: blockStart,
          endTime: blockEnd,
          reason: blockReason,
          createdAt: serverTimestamp()
        });
      });

      await batch.commit();
      toast({ title: "Bloqueio Realizado" });
      setBlockReason('');
      setBlockDate(undefined);
      setBlockMultipleDates([]);
    } catch (e) {
      toast({ title: "Erro ao bloquear", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleProcessBulkText = () => {
    if (!bulkDatesText.trim()) return;
    const lines = bulkDatesText.split('\n');
    const parsedDates: Date[] = [];
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        let d: Date;
        if (trimmed.includes('/')) d = parse(trimmed, 'dd/MM/yyyy', new Date());
        else d = parse(trimmed, 'yyyy-MM-dd', new Date());
        if (!isNaN(d.getTime())) parsedDates.push(d);
      } catch (e) {}
    });

    if (parsedDates.length > 0) {
      setBlockMultipleDates(prev => [...prev, ...parsedDates]);
      setIsBulkMode(true);
      setIsBulkImportOpen(false);
      setBulkDatesText('');
      toast({ title: `${parsedDates.length} datas identificadas.` });
    }
  };

  const handleRemoveBlock = (id: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'schedule_blocks', id));
    toast({ title: "Bloqueio Removido" });
  };

  const handleRemoveSlot = (id: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'available_time_slots', id));
    toast({ title: "Horário Removido" });
  };

  const getTargetName = (slot: TimeSlot) => {
    if (slot.schoolClassId) {
      const cls = sortedClasses.find(c => c.id === slot.schoolClassId);
      return `Turma: ${cls?.name || '...'}`;
    }
    if (slot.schoolSegmentId) {
      const seg = sortedSegments.find(s => s.id === slot.schoolSegmentId);
      return `Seg: ${seg?.name || '...'}`;
    }
    return 'Global';
  };

  // Funções da Matriz Curricular
  const uniqueTimesForGrid = useMemo(() => {
    if (!slots || !gridClassId) return [];
    const classSlots = slots.filter(s => s.schoolClassId === gridClassId);
    const times: string[] = Array.from(new Set<string>(classSlots.map(s => s.startTime))).sort();
    return times;
  }, [slots, gridClassId]);

  const handleSaveGridSubject = async () => {
    if (!db || !editingGridSlot || !gridClassId) return;
    
    try {
      const batch = writeBatch(db);
      const slotsCol = collection(db, 'available_time_slots');
      
      // Itere sobre todos os dias e horários selecionados para replicação
      for (const dayId of selectedRepeatDays) {
        for (const timeStr of selectedRepeatTimes) {
          // Procure se já existe um slot nesta turma, neste dia e neste horário
          const existing = slots?.find(s => 
            s.schoolClassId === gridClassId && 
            s.dayOfWeek === dayId && 
            s.startTime === timeStr
          );

          if (existing) {
            // Se existe, apenas atualiza a matéria
            batch.update(doc(slotsCol, existing.id), { subject: tempSubject });
          } else {
            // Se não existe, cria um novo slot baseado no modelo do que está sendo editado
            const newRef = doc(slotsCol);
            batch.set(newRef, {
              dayOfWeek: dayId,
              startTime: timeStr,
              durationMinutes: editingGridSlot.durationMinutes || 50,
              schoolClassId: gridClassId,
              schoolSegmentId: editingGridSlot.schoolSegmentId || null,
              subject: tempSubject,
              isActive: true
            });
          }
        }
      }

      await batch.commit();
      toast({ title: "Grade atualizada e replicada!" });
      setEditingGridSlot(null);
      setSelectedRepeatDays([]);
      setSelectedRepeatTimes([]);
    } catch (e) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  const handleExportExcel = () => {
    if (!slots) {
      toast({ title: 'Nenhum horário para exportar', variant: 'destructive' });
      return;
    }

    // 1. Filtrar se houver filtro ativo
    const dataToExport = slots.filter(s => {
      if (filterType === 'all') return true;
      if (filterType === 'global') return !s.schoolSegmentId && !s.schoolClassId;
      if (filterType === 'segment') return s.schoolSegmentId === filterId;
      if (filterType === 'class') return s.schoolClassId === filterId;
      return true;
    });

    if (dataToExport.length === 0) {
      toast({ title: 'Nenhum horário encontrado para os filtros atuais', variant: 'destructive' });
      return;
    }

    // 2. Agrupar por Alvo (Turma, Segmento ou Global)
    const groupedByTarget: Record<string, Record<string, TimeSlot[]>> = {};
    
    dataToExport.forEach(s => {
      const target = getTargetName(s);
      if (!groupedByTarget[target]) groupedByTarget[target] = {};
      if (!groupedByTarget[target][s.dayOfWeek]) groupedByTarget[target][s.dayOfWeek] = [];
      groupedByTarget[target][s.dayOfWeek].push(s);
    });

    // 4. Preparar as linhas para o Excel
    let finalRows: any[][] = [];

    if (filterType === 'class' || filterType === 'segment') {
      // FORMATO MATRIZ (IGUAL AO DA TELA): LINHAS = HORÁRIOS, COLUNAS = DIAS
      const targetName = filterType === 'class' 
        ? (sortedClasses.find(c => c.id === filterId)?.name || 'Turma')
        : (sortedSegments.find(s => s.id === filterId)?.name || 'Segmento');

      finalRows.push([filterType === 'class' ? 'Turma:' : 'Segmento:', targetName]);
      finalRows.push([]); // Linha em branco

      const headers = ['Horário', 'Duração (min)', ...DAYS_OF_WEEK.map(d => d.label)];
      finalRows.push(headers);

      // Obter todos os horários únicos ordenados
      const uniqueTimes = Array.from(new Set(dataToExport.map(s => s.startTime))).sort();

      uniqueTimes.forEach(time => {
        // Para cada horário, pegamos a duração do primeiro slot encontrado (geralmente é a mesma para todos os dias no mesmo horário)
        const sampleSlot = dataToExport.find(s => s.startTime === time);
        const duration = sampleSlot?.durationMinutes || 50;

        const row = [time, duration];
        DAYS_OF_WEEK.forEach(day => {
          const slot = dataToExport.find(s => s.startTime === time && s.dayOfWeek === day.id);
          row.push(slot?.subject || '-');
        });
        finalRows.push(row);
      });
    } else {
      // FORMATO RESUMO (TODOS): LINHAS = TURMAS, COLUNAS = DIAS
      const headers = ['Vínculo', ...DAYS_OF_WEEK.map(d => d.label)];
      finalRows.push(headers);

      const groupedByTarget: Record<string, Record<string, any[]>> = {};
      dataToExport.forEach(s => {
        const target = getTargetName(s);
        if (!groupedByTarget[target]) groupedByTarget[target] = {};
        if (!groupedByTarget[target][s.dayOfWeek]) groupedByTarget[target][s.dayOfWeek] = [];
        groupedByTarget[target][s.dayOfWeek].push(s);
      });

      Object.entries(groupedByTarget).forEach(([targetName, days]) => {
        const row = [targetName];
        DAYS_OF_WEEK.forEach(day => {
          const daySlots = days[day.id] || [];
          const cellValue = daySlots
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map(s => `${s.startTime} [${s.durationMinutes || 50}]${s.subject ? ` (${s.subject})` : ''}`)
            .join(', ');
          row.push(cellValue || '-');
        });
        finalRows.push(row);
      });
    }

    // 5. Gerar XLSX
    try {
      const worksheet = XLSX.utils.aoa_to_sheet(finalRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Grade de Horários");
      
      // Nome dinâmico do arquivo
      let fileName = `Grade_Horarios_${format(new Date(), 'dd_MM_yyyy')}`;
      if (filterType === 'class' && filterId) {
        const cls = sortedClasses.find(c => c.id === filterId);
        if (cls) fileName += `_Turma_${cls.name.replace(/\s+/g, '_')}`;
      } else if (filterType === 'segment' && filterId) {
        const seg = sortedSegments.find(s => s.id === filterId);
        if (seg) fileName += `_Seg_${seg.name.replace(/\s+/g, '_')}`;
      }

      XLSX.writeFile(workbook, `${fileName}.xlsx`);
      toast({ title: 'Exportação (Matriz) concluída!' });
    } catch (error) {
      toast({ title: 'Erro ao gerar Excel', variant: 'destructive' });
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db) return;

    setIsSaving(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          toast({ title: "Arquivo vazio ou inválido", variant: "destructive" });
          setIsSaving(false);
          return;
        }

        let count = 0;
        const previewSlots: TimeSlot[] = [];
        
        let currentFileClassId: string | null = null;
        let currentFileSegmentId: string | null = null;
        let currentHeaders: string[] = [];
        let inMatrixSection = false;

        for (const row of jsonData) {
          if (!row || row.length === 0) continue;

          // 1. Verificar se a linha é um Marcador de Alvo (Turma: ou Segmento:)
          let foundTargetInRow = false;
          row.forEach((cell, cellIdx) => {
            const val = cell?.toString().trim();
            const nextVal = row[cellIdx + 1]?.toString().trim();
            
            if (val === 'Turma:' && nextVal) {
              const cls = sortedClasses.find(c => c.name.toLowerCase() === nextVal.toLowerCase());
              if (cls) {
                currentFileClassId = cls.id;
                currentFileSegmentId = null;
                foundTargetInRow = true;
              }
            } else if (val === 'Segmento:' && nextVal) {
              const seg = sortedSegments.find(s => s.name.toLowerCase() === nextVal.toLowerCase());
              if (seg) {
                currentFileSegmentId = seg.id;
                currentFileClassId = null;
                foundTargetInRow = true;
              }
            }
          });

          if (foundTargetInRow) {
            inMatrixSection = false; // Reset section when new target found
            continue;
          }

          // 2. Verificar se a linha é um Cabeçalho (Horário ou Vínculo)
          const isHeaderRow = row.some(cell => {
            const val = cell?.toString().trim().toUpperCase();
            return val === 'HORÁRIO' || val === 'VÍNCULO';
          });

          if (isHeaderRow) {
            currentHeaders = row.map(h => h?.toString().trim().toUpperCase() || '');
            inMatrixSection = currentHeaders.includes('HORÁRIO');
            continue;
          }

          // 3. Processar Dados
          if (inMatrixSection) {
            const startTime = rowIndexToStartTime(row[0]); 
            if (!startTime) continue;

            const hasDurationCol = currentHeaders.includes('DURAÇÃO (MIN)');
            const duration = hasDurationCol ? (parseInt(row[currentHeaders.indexOf('DURAÇÃO (MIN)')], 10) || 50) : 50;
            const startDayIdx = hasDurationCol ? 2 : 1;

            DAYS_OF_WEEK.forEach((day, idx) => {
              const cellValue = row[idx + startDayIdx]; 
              if (cellValue && cellValue !== '-' && cellValue !== '') {
                const subjects = cellValue.toString().split(',').map((s: string) => s.trim());
                subjects.forEach((subj: string) => {
                  let finalSubj = subj;
                  let finalStartTime = startTime;
                  let finalDuration = duration;
                  
                  const complexMatch = subj.match(/^(\d{2}:\d{2})\s*(?:\[(\d+)\])?\s*(?:\((.*)\))?$/);
                  if (complexMatch) {
                    finalStartTime = complexMatch[1];
                    if (complexMatch[2]) finalDuration = parseInt(complexMatch[2], 10);
                    finalSubj = complexMatch[3] || '';
                  } else {
                    const simpleMatch = subj.match(/^(\d{2}:\d{2})\s*\((.*)\)$/);
                    if (simpleMatch) {
                      finalStartTime = simpleMatch[1];
                      finalSubj = simpleMatch[2];
                    }
                  }

                  previewSlots.push({
                    dayOfWeek: day.id,
                    startTime: finalStartTime,
                    durationMinutes: finalDuration,
                    subject: finalSubj === '-' ? '' : finalSubj,
                    schoolSegmentId: currentFileSegmentId || (filterType === 'segment' ? filterId : null),
                    schoolClassId: currentFileClassId || (filterType === 'class' ? filterId : null),
                  } as TimeSlot);
                  count++;
                });
              }
            });
          } else if (currentHeaders.includes('VÍNCULO')) {
            const targetStr = row[0]?.toString() || '';
            let rowSegmentId = null;
            let rowClassId = null;

            if (targetStr.startsWith('Turma:')) {
              const name = targetStr.replace('Turma:', '').trim();
              const cls = sortedClasses.find(c => c.name.toLowerCase() === name.toLowerCase());
              if (cls) rowClassId = cls.id;
            } else if (targetStr.startsWith('Seg:')) {
              const name = targetStr.replace('Seg:', '').trim();
              const seg = sortedSegments.find(s => s.name.toLowerCase() === name.toLowerCase());
              if (seg) rowSegmentId = seg.id;
            }

            DAYS_OF_WEEK.forEach((day, idx) => {
              const cellValue = row[idx + 1];
              if (cellValue && cellValue !== '-' && cellValue !== '') {
                const entries = cellValue.toString().split(',').map((s: string) => s.trim());
                entries.forEach((entry: string) => {
                  const match = entry.match(/^(\d{2}:\d{2})\s*(?:\[(\d+)\])?\s*(?:\((.*)\))?$/);
                  if (match) {
                    previewSlots.push({
                      dayOfWeek: day.id,
                      startTime: match[1],
                      durationMinutes: match[2] ? parseInt(match[2], 10) : 50,
                      subject: match[3] || '',
                      schoolSegmentId: rowSegmentId || (filterType === 'segment' ? filterId : null),
                      schoolClassId: rowClassId || (filterType === 'class' ? filterId : null),
                    } as TimeSlot);
                    count++;
                  }
                });
              }
            });
          }
        }

        if (count > 0) {
          // Detectar novas disciplinas
          const existingSubjectNames = new Set(sortedSubjects.map(s => s.name.trim().toLowerCase()));
          const newSubjects = Array.from(new Set(
            previewSlots
              .map(s => s.subject?.trim() || '')
              .filter(name => name !== '' && !existingSubjectNames.has(name.toLowerCase()))
          ));

          const initialColors: Record<string, string> = {};
          newSubjects.forEach((name, idx) => {
            initialColors[name] = PREDEFINED_COLORS[idx % PREDEFINED_COLORS.length].value;
          });

          const discoveredClassIds = Array.from(new Set(previewSlots.map(s => s.schoolClassId).filter(Boolean)));
          const discoveredSegmentIds = Array.from(new Set(previewSlots.map(s => s.schoolSegmentId).filter(Boolean)));

          setImportFileClassIds(discoveredClassIds as string[]);
          setImportFileSegmentIds(discoveredSegmentIds as string[]);
          setNewSubjectsToRegister(newSubjects);
          setNewSubjectColorsMap(initialColors);
          setImportPreviewData(previewSlots);
          setIsImportPreviewOpen(true);
          toast({ title: `${count} horários identificados. ${newSubjects.length} novas disciplinas.` });
        } else {
          toast({ title: "Nenhum horário válido encontrado no arquivo.", variant: "destructive" });
        }
      } catch (err) {
        toast({ title: 'Erro ao importar arquivo', variant: 'destructive' });
      } finally {
        setIsSaving(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async (mode: 'append' | 'replace') => {
    if (!db || importPreviewData.length === 0) return;
    
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const slotsCol = collection(db, 'available_time_slots');

      if (mode === 'replace') {
        // Encontrar slots existentes que colidem (mesma turma/segmento, mesmo dia e mesmo horário)
        for (const newSlot of importPreviewData) {
          const existing = slots?.find(s => 
            s.dayOfWeek === newSlot.dayOfWeek && 
            s.startTime === newSlot.startTime && 
            s.schoolClassId === newSlot.schoolClassId && 
            s.schoolSegmentId === newSlot.schoolSegmentId
          );
          
          if (existing) {
            batch.delete(doc(db, 'available_time_slots', existing.id));
          }
        }
      }

      // 1. Registrar novas disciplinas, se houver
      if (newSubjectsToRegister.length > 0) {
        for (const name of newSubjectsToRegister) {
          const color = newSubjectColorsMap[name];
          const newSubjRef = doc(collection(db, 'school_subjects'));
          batch.set(newSubjRef, {
            name,
            color,
            schoolSegmentIds: importFileSegmentIds.length > 0 ? importFileSegmentIds : (filterType === 'segment' ? [filterId] : []),
            schoolClassIds: importFileClassIds.length > 0 ? importFileClassIds : (filterType === 'class' ? [filterId] : []),
          });
        }
      }

      // 2. Adicionar novos slots
      importPreviewData.forEach(s => {
        const newRef = doc(slotsCol);
        batch.set(newRef, { ...s, isActive: true });
      });

      await batch.commit();
      toast({ title: mode === 'replace' ? "Horários substituídos com sucesso!" : "Horários acrescentados com sucesso!" });
      setIsImportPreviewOpen(false);
      setImportPreviewData([]);
      setImportFileClassIds([]);
      setImportFileSegmentIds([]);
      setNewSubjectsToRegister([]);
      setNewSubjectColorsMap({});
    } catch (e) {
      toast({ title: "Erro ao salvar horários", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Helper para limpar o tempo
  const rowIndexToStartTime = (val: any): string | null => {
    if (val === undefined || val === null) return null;
    
    // Se for número (Excel armazena tempo como fração do dia)
    if (typeof val === 'number') {
      const totalMinutes = Math.round(val * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    const str = val.toString().trim();
    const match = str.match(/^(\d{1,2}:\d{2})/);
    if (!match) return null;
    let time = match[1];
    if (time.length === 4) time = '0' + time;
    return time;
  };

  const handleCleanCorrupted = async () => {
    if (!slots || !db) return;
    const corrupted = slots.filter(s => s.startTime.length > 10 || s.startTime.includes('PK') || s.startTime.includes('xl/'));
    
    if (corrupted.length === 0) {
      toast({ title: 'Nenhum horário corrompido encontrado!' });
      return;
    }

    try {
      const batch = writeBatch(db);
      corrupted.forEach(s => {
        batch.delete(doc(db, 'available_time_slots', s.id));
      });
      await batch.commit();
      toast({ title: `${corrupted.length} horários corrompidos removidos com sucesso!` });
    } catch (e) {
      toast({ title: "Erro ao remover itens", variant: "destructive" });
    }
  };

  const handleAddSubject = async () => {
    if (!db || !newSubjectName.trim()) return;
    try {
      const newRef = doc(collection(db, 'school_subjects'));
      await setDoc(newRef, { 
        name: newSubjectName.trim(),
        color: newSubjectColor,
        schoolSegmentIds: subjectTargetType === 'segment' ? subjectTargetIds : [],
        schoolClassIds: subjectTargetType === 'class' ? subjectTargetIds : []
      });
      setNewSubjectName('');
      setNewSubjectColor('#3b82f6');
      setSubjectTargetIds([]);
      toast({ title: 'Disciplina adicionada!' });
    } catch (e) {
      toast({ title: 'Erro ao adicionar', variant: 'destructive' });
    }
  };

  const handleUpdateSubject = async () => {
    if (!db || !editingSubject || !editSubjectName.trim()) return;
    try {
      await updateDoc(doc(db, 'school_subjects', editingSubject.id), {
        name: editSubjectName.trim(),
        color: editSubjectColor,
        schoolSegmentIds: editSubjectTargetType === 'segment' ? editSubjectTargetIds : [],
        schoolClassIds: editSubjectTargetType === 'class' ? editSubjectTargetIds : []
      });
      setEditingSubject(null);
      toast({ title: 'Disciplina atualizada!' });
    } catch (e) {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  const handleExportSubjects = () => {
    if (!sortedSubjects) return;
    
    const data = sortedSubjects.map(s => ({
      Nome: s.name,
      Cor: s.color || '#3b82f6',
      Segmentos: s.schoolSegmentIds?.map(id => sortedSegments.find(seg => seg.id === id)?.name).filter(Boolean).join(', ') || '',
      Turmas: s.schoolClassIds?.map(id => sortedClasses.find(c => c.id === id)?.name).filter(Boolean).join(', ') || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Disciplinas");
    XLSX.writeFile(workbook, "disciplinas_agenda_facil.xlsx");
    toast({ title: 'Exportação concluída!' });
  };

  const handleImportSubjects = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const batch = writeBatch(db);
        let count = 0;

        for (const row of data) {
          const name = row.Nome || row.name || row.disciplina || row.Disciplina;
          if (!name) continue;

          const color = row.Cor || row.color || '#3b82f6';
          const segmentNames = (row.Segmentos || row.segments || row.segmentos || '').toString().split(',').map((s: string) => s.trim()).filter(Boolean);
          const classNames = (row.Turmas || row.classes || row.turmas || '').toString().split(',').map((s: string) => s.trim()).filter(Boolean);

          const schoolSegmentIds = segmentNames.map((n: string) => sortedSegments.find(s => s.name.toLowerCase() === n.toLowerCase())?.id).filter(Boolean) as string[];
          const schoolClassIds = classNames.map((n: string) => sortedClasses.find(c => c.name.toLowerCase() === n.toLowerCase())?.id).filter(Boolean) as string[];

          const newRef = doc(collection(db, 'school_subjects'));
          batch.set(newRef, {
            name,
            color,
            schoolSegmentIds,
            schoolClassIds
          });
          count++;
        }

        await batch.commit();
        toast({ title: `${count} disciplinas importadas!` });
        if (subjectsImportRef.current) subjectsImportRef.current.value = '';
      } catch (err) {
        toast({ title: 'Erro ao importar arquivo', variant: 'destructive' });
      }
    };
    reader.readAsBinaryString(file);
  };


  const handleRemoveSubject = async (id: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'school_subjects', id));
    toast({ title: 'Disciplina removida!' });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <datalist id="subjectsList">
        {sortedSubjects.map(s => <option key={s.id} value={s.name} />)}
      </datalist>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Grade e Bloqueios</h1>
          <p className="text-muted-foreground">Gerencie a estrutura de horários e as matérias associadas.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button onClick={handleCleanCorrupted} variant="outline" className="flex-1 md:flex-none rounded-xl gap-2 h-11 bg-red-50 border-red-600 text-red-600 hover:bg-red-100">
            <Trash2 className="w-4 h-4" />
            Limpar Corrompidos
          </Button>
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleImportExcel} 
          />
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex-1 md:flex-none rounded-xl gap-2 h-11 bg-white border-blue-600 text-blue-600 hover:bg-blue-50" disabled={isSaving}>
            <Upload className="w-4 h-4" />
            Importar Excel
          </Button>
          <Button onClick={handleExportExcel} variant="outline" className="flex-1 md:flex-none rounded-xl gap-2 h-11 bg-white border-green-600 text-green-600 hover:bg-green-50">
            <Download className="w-4 h-4" />
            Exportar Excel
          </Button>
          <Button onClick={() => setIsCopyDialogOpen(true)} variant="outline" className="flex-1 md:flex-none rounded-xl gap-2 h-11 bg-white border-primary text-primary hover:bg-primary/5">
            <Copy className="w-4 h-4" />
            Duplicar Grade
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-white p-1 border shadow-sm">
              <TabsTrigger value="create" className="rounded-lg">Novo Horário</TabsTrigger>
              <TabsTrigger value="block" className="rounded-lg">Bloquear Data</TabsTrigger>
            </TabsList>
            
            <TabsContent value="create">
              <Card className="shadow-md border-none">
                <CardHeader><CardTitle className="text-lg">Gerar Grade em Lote</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-4 gap-1">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day.id} className="flex flex-col items-center p-2 rounded-lg border bg-muted/10">
                        <Checkbox 
                          id={`day-chk-${day.id}`} 
                          name={`day-${day.id}`}
                          checked={selectedDays.includes(day.id)}
                          onCheckedChange={() => handleToggleDay(day.id)}
                        />
                        <Label htmlFor={`day-chk-${day.id}`} className="text-[9px] mt-1 font-bold cursor-pointer">{day.short}</Label>
                      </div>
                    ))}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="bulk-times-input" className="text-xs font-bold">Horários (HH:mm-dur-Matéria)</Label>
                    <Input 
                      id="bulk-times-input" 
                      placeholder="Ex: 08:00-50-Artes, 09:00-50-Inglês" 
                      value={bulkTimes} 
                      onChange={(e) => setBulkTimes(e.target.value)} 
                      className="rounded-xl h-10" 
                    />
                    <p className="text-[9px] text-muted-foreground leading-tight italic">
                      Dica: Use vírgula. Ex: HH:mm (usa padrão), HH:mm-dur ou HH:mm-dur-Matéria.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="slot-duration-input" className="text-xs font-bold">Duração Padrão (min)</Label>
                      <Input id="slot-duration-input" name="duration" type="number" value={defaultDuration} onChange={(e) => setDefaultDuration(e.target.value)} className="rounded-xl h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slot-subject-input" className="text-xs font-bold">Matéria Padrão</Label>
                      <Input id="slot-subject-input" name="subject" list="subjectsList" placeholder="Ex: Matemática" value={defaultSubject} onChange={(e) => setDefaultSubject(e.target.value)} className="rounded-xl h-10" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Vínculo</Label>
                    <Select value={targetType} onValueChange={(v: any) => { setTargetType(v); setTargetId(''); }}>
                      <SelectTrigger className="rounded-xl h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">Global</SelectItem>
                        <SelectItem value="segment">Segmento</SelectItem>
                        <SelectItem value="class">Turma</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {targetType !== 'global' && (
                    <div className="space-y-2 animate-in slide-in-from-top-2">
                      <Label className="text-xs font-bold">{targetType === 'segment' ? "Escolha o Segmento" : "Escolha a Turma"}</Label>
                      <Select onValueChange={setTargetId} value={targetId}>
                        <SelectTrigger className="rounded-xl h-10">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {targetType === 'segment' ? sortedSegments.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>) : sortedClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>) }
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Button onClick={handleBatchAdd} className="w-full rounded-xl gap-2 shadow-lg h-12" disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    Cadastrar Horários
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="block">
              <Card className="shadow-md border-none border-t-4 border-t-destructive">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-destructive" /> Travar Período</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setIsBulkImportOpen(true)} className="h-8 rounded-lg text-primary text-[10px] font-bold"><ListPlus className="w-3 h-3 mr-1" /> Importar Lista</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={isBulkMode ? "default" : "outline"} className="cursor-pointer rounded-lg text-[10px]" onClick={() => { setIsBulkMode(p => !p); if (!isBulkMode) setBlockDate(undefined); else setBlockMultipleDates([]); }}>{isBulkMode ? "Múltiplas Datas Ativado" : "Clique para selecionar várias"}</Badge>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Data(s) do Evento</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full h-10 justify-start rounded-xl", ((!isBulkMode && !blockDate) || (isBulkMode && blockMultipleDates.length === 0)) && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {isBulkMode ? (blockMultipleDates.length > 0 ? `${blockMultipleDates.length} datas` : "Escolha as datas") : (blockDate ? format(blockDate, "dd/MM/yyyy") : "Escolha a data")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        {isBulkMode ? <Calendar mode="multiple" required selected={blockMultipleDates} onSelect={setBlockMultipleDates} locale={ptBR} /> : <Calendar mode="single" required selected={blockDate} onSelect={setBlockDate} locale={ptBR} />}
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="block-start-input" className="text-xs font-bold">Bloquear De:</Label>
                      <Input id="block-start-input" name="blockStart" type="time" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} className="rounded-xl h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="block-end-input" className="text-xs font-bold">Até:</Label>
                      <Input id="block-end-input" name="blockEnd" type="time" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} className="rounded-xl h-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="block-reason-input" className="text-xs font-bold">Motivo do Bloqueio</Label>
                    <Input id="block-reason-input" name="reason" placeholder="Ex: Feriado, Reunião..." value={blockReason} onChange={(e) => setBlockReason(e.target.value)} className="rounded-xl h-10" />
                  </div>
                  <Button onClick={handleAddBlock} variant="destructive" className="w-full rounded-xl gap-2" disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                    {isBulkMode ? `Bloquear ${blockMultipleDates.length} Dias` : "Ativar Bloqueio"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card className="shadow-md border-none overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 py-4"><CardTitle className="text-sm font-bold flex items-center gap-2"><Timer className="w-4 h-4 text-primary" /> Regras de Antecedência</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest border-b pb-1">Novas Reservas</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="booking-days-input" className="text-[10px] font-bold">Dias</Label>
                    <Input id="booking-days-input" name="bookingDays" type="number" value={bookingDays} onChange={(e) => setBookingDays(parseInt(e.target.value) || 0)} className="h-9 rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="booking-hours-input" className="text-[10px] font-bold">Horas</Label>
                    <Input id="booking-hours-input" name="bookingHours" type="number" value={bookingHours} onChange={(e) => setBookingHours(parseInt(e.target.value) || 0)} className="h-9 rounded-lg" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest border-b pb-1">Reagendamentos</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="reschedule-days-input" className="text-[10px] font-bold">Dias</Label>
                    <Input id="reschedule-days-input" name="rescheduleDays" type="number" value={rescheduleDays} onChange={(e) => setRescheduleDays(parseInt(e.target.value) || 0)} className="h-9 rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="reschedule-hours-input" className="text-[10px] font-bold">Horas</Label>
                    <Input id="reschedule-hours-input" name="rescheduleHours" type="number" value={rescheduleHours} onChange={(e) => setRescheduleHours(parseInt(e.target.value) || 0)} className="h-9 rounded-lg" />
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveRules} className="w-full rounded-xl gap-2 h-11" disabled={isSavingRules}>
                {isSavingRules ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                Salvar Regras
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2 shadow-md border-none overflow-hidden bg-white">
          <CardHeader className="bg-muted/10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle className="text-xl">Gestão da Agenda</CardTitle>
                <CardDescription>Visualize e filtre a grade padrão do sistema.</CardDescription>
              </div>
              
              <div className="flex items-center gap-2 bg-white p-2 rounded-xl border shadow-sm w-full md:w-auto">
                <Filter className="w-4 h-4 text-muted-foreground ml-2" />
                <Select value={filterType} onValueChange={(v: any) => { setFilterType(v); setFilterId(''); }}>
                  <SelectTrigger className="w-[120px] h-9 border-none bg-transparent shadow-none focus:ring-0">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="global">Grade Global</SelectItem>
                    <SelectItem value="segment">Por Segmento</SelectItem>
                    <SelectItem value="class">Por Turma</SelectItem>
                  </SelectContent>
                </Select>
                {(filterType === 'segment' || filterType === 'class') && (
                  <>
                    <div className="w-px h-6 bg-slate-200" />
                    <Select value={filterId} onValueChange={setFilterId}>
                      <SelectTrigger className="w-[180px] h-9 border-none bg-transparent shadow-none focus:ring-0">
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filterType === 'segment' 
                          ? sortedSegments.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>) 
                          : sortedClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                        }
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <Tabs defaultValue="slots" className="w-full">
              <TabsList className="flex gap-1 bg-muted/20 p-1 mb-6 rounded-xl border w-full sm:w-fit flex-wrap">
                <TabsTrigger value="slots" className="rounded-lg px-6"><Clock className="w-4 h-4 mr-2" /> Grade Padrão</TabsTrigger>
                <TabsTrigger value="curriculum" className="rounded-lg px-6"><LayoutGrid className="w-4 h-4 mr-2" /> Grade Curricular</TabsTrigger>
                <TabsTrigger value="blocks" className="rounded-lg px-6"><ShieldAlert className="w-4 h-4 mr-2" /> Datas Bloqueadas</TabsTrigger>
                <TabsTrigger value="subjects" className="rounded-lg px-6"><BookOpen className="w-4 h-4 mr-2" /> Disciplinas</TabsTrigger>
              </TabsList>

              <TabsContent value="slots" className="space-y-6">
                {loadingSlots ? <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-primary" /></div> : (
                  <Tabs defaultValue="1" className="w-full">
                    <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/5 p-1 mb-6 rounded-xl border">
                      {DAYS_OF_WEEK.map(d => <TabsTrigger key={d.id} value={d.id} className="rounded-lg flex-1 text-xs py-2">{d.short}</TabsTrigger>)}
                    </TabsList>
                    {DAYS_OF_WEEK.map(d => {
                      const daySlots = filteredSlots?.filter(s => s.dayOfWeek === d.id) || [];
                      return (
                        <TabsContent key={d.id} value={d.id}>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {daySlots.length > 0 ? daySlots.sort((a,b) => a.startTime.localeCompare(b.startTime)).map(s => (
                              <div key={s.id} className="bg-muted/10 p-4 rounded-xl border flex justify-between items-center group hover:bg-white transition-all shadow-sm">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-3 h-3 text-muted-foreground" />
                                    <span className="font-bold">{s.startTime}</span>
                                    <span className="text-xs text-muted-foreground">({s.durationMinutes} min)</span>
                                  </div>
                                  {s.subject && (
                                    (() => {
                                      const subjectObj = sortedSubjects.find(sub => sub.name === s.subject);
                                      const color = subjectObj?.color || '#3b82f6';
                                      return (
                                        <div className="flex items-center gap-1.5 mt-1 text-xs font-bold" style={{ color }}>
                                          <BookOpen className="w-3 h-3" />
                                          {s.subject}
                                        </div>
                                      );
                                    })()
                                  )}
                                  <div className="mt-2">
                                    <Badge variant="outline" className="text-[10px] bg-white border-primary/20 text-primary">{getTargetName(s)}</Badge>
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleRemoveSlot(s.id)} aria-label="Remover horário"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            )) : <div className="p-10 text-center text-muted-foreground border-2 border-dashed rounded-2xl col-span-2">Nenhum horário padrão encontrado para este filtro.</div>}
                          </div>
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                )}
              </TabsContent>

              <TabsContent value="curriculum" className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1">
                    <Label className="text-xs font-bold mb-1 block">Selecionar Turma para Visualizar Matriz</Label>
                    <Select value={gridClassId} onValueChange={setGridClassId}>
                      <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Escolha uma turma..." /></SelectTrigger>
                      <SelectContent>
                        {sortedClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {gridClassId ? (
                  <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
                    <Table>
                      <TableHeader className="bg-primary/5">
                        <TableRow>
                          <TableHead className="font-bold border-r w-24">Horário</TableHead>
                          {DAYS_OF_WEEK.slice(0, 5).map(day => (
                            <TableHead key={day.id} className="font-bold text-center">{day.label}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uniqueTimesForGrid.length > 0 ? uniqueTimesForGrid.map(time => (
                          <TableRow key={time}>
                            <TableCell className="font-bold border-r bg-muted/5">{time}</TableCell>
                            {DAYS_OF_WEEK.slice(0, 5).map(day => {
                              const slot = slots?.find(s => s.schoolClassId === gridClassId && s.dayOfWeek === day.id && s.startTime === time);
                              return (
                                <TableCell key={day.id} className="p-1 h-16">
                                  {slot ? (
                                    (() => {
                                      const subjectObj = sortedSubjects.find(s => s.name === slot.subject);
                                      const bgColor = (slot.subject && subjectObj?.color) ? subjectObj.color : (slot.subject ? '#3b82f6' : 'transparent');
                                      const textColor = slot.subject ? getContrastColor(bgColor) : 'inherit';
                                      
                                      return (
                                        <button 
                                          onClick={() => { 
                                            setEditingGridSlot(slot); 
                                            setTempSubject(slot.subject || '');
                                            setSelectedRepeatDays([slot.dayOfWeek]);
                                            setSelectedRepeatTimes([slot.startTime]);
                                          }}
                                          className={cn(
                                            "w-full h-full rounded-lg text-[10px] font-bold p-2 transition-all text-center flex flex-col items-center justify-center gap-1 hover:brightness-95 shadow-sm",
                                            !slot.subject && "bg-muted/30 text-muted-foreground border border-dashed"
                                          )}
                                          style={slot.subject ? { 
                                            backgroundColor: bgColor, 
                                            color: textColor,
                                            border: `1px solid ${bgColor}44`
                                          } : {}}
                                        >
                                          <BookOpen className="w-3 h-3 opacity-50" />
                                          {slot.subject || "Sem matéria"}
                                        </button>
                                      );
                                    })()
                                  ) : (
                                    <button 
                                      onClick={() => { 
                                        setEditingGridSlot({
                                          id: 'new',
                                          dayOfWeek: day.id,
                                          startTime: time,
                                          durationMinutes: 50,
                                          schoolClassId: gridClassId,
                                          isActive: true
                                        } as TimeSlot);
                                        setTempSubject('');
                                        setSelectedRepeatDays([day.id]);
                                        setSelectedRepeatTimes([time]);
                                      }}
                                      className="w-full h-full flex items-center justify-center opacity-10 hover:opacity-100 hover:bg-primary/5 rounded-lg transition-all"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={6} className="h-40 text-center italic text-muted-foreground">Nenhum horário cadastrado para esta turma.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-20 text-center text-muted-foreground border-2 border-dashed rounded-3xl flex flex-col items-center gap-3">
                    <LayoutGrid className="w-10 h-10 opacity-20" />
                    <p>Selecione uma turma acima para configurar a grade curricular.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="blocks">
                {loadingBlocks ? <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-primary" /></div> : (
                  <div className="space-y-4">
                    {blocks && blocks.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="font-bold">Data</TableHead>
                            <TableHead className="font-bold">Horário</TableHead>
                            <TableHead className="font-bold">Motivo</TableHead>
                            <TableHead className="text-right font-bold">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {blocks.sort((a,b) => b.date.localeCompare(a.date)).map(b => (
                            <TableRow key={b.id} className="hover:bg-muted/5">
                              <TableCell className="font-medium">{format(new Date(b.date + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                              <TableCell className="text-xs font-mono">{b.startTime} - {b.endTime}</TableCell>
                              <TableCell><Badge variant="secondary" className="font-normal">{b.reason}</Badge></TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="text-destructive rounded-full hover:bg-destructive/10" onClick={() => handleRemoveBlock(b.id)} aria-label="Remover bloqueio"><Trash2 className="w-4 h-4" /></Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="p-20 text-center text-muted-foreground border-2 border-dashed rounded-3xl flex flex-col items-center gap-3">
                        <AlertCircle className="w-8 h-8 opacity-20" />
                        <p>Nenhuma data bloqueada no momento.</p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="subjects">
                <div className="space-y-6">
                  {/* Header com Importação/Exportação */}
                  <div className="flex items-center gap-3 justify-end px-1">
                    <input 
                      type="file" 
                      ref={subjectsImportRef} 
                      onChange={handleImportSubjects} 
                      accept=".xlsx, .xls, .csv" 
                      className="hidden" 
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-xl gap-2 h-9 text-[10px] font-bold uppercase border-primary/20 hover:bg-primary/5 shadow-sm"
                      onClick={() => subjectsImportRef.current?.click()}
                    >
                      <Upload className="w-3 h-3 text-primary" /> Importar Excel
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-xl gap-2 h-9 text-[10px] font-bold uppercase border-primary/20 hover:bg-primary/5 shadow-sm"
                      onClick={handleExportSubjects}
                    >
                      <Download className="w-3 h-3 text-primary" /> Exportar Excel
                    </Button>
                  </div>

                  <div className="flex flex-col gap-4 bg-muted/20 p-4 rounded-2xl border border-dashed">
                    <div className="flex items-end gap-3">
                      <div className="flex-1 space-y-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Nome da Disciplina</Label>
                        <Input 
                          placeholder="Ex: Matemática, Português..." 
                          value={newSubjectName} 
                          onChange={(e) => setNewSubjectName(e.target.value)} 
                          className="rounded-xl h-12"
                        />
                      </div>
                      <Button onClick={handleAddSubject} className="rounded-xl gap-2 h-12 px-6 font-bold shadow-sm">
                        <Plus className="w-4 h-4" /> Cadastrar
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Cor de Destaque</Label>
                      <div className="flex flex-wrap gap-2 items-center">
                        {PREDEFINED_COLORS.map(c => (
                          <button
                            key={c.value}
                            onClick={() => setNewSubjectColor(c.value)}
                            type="button"
                            className={cn(
                              "w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center shadow-sm",
                              newSubjectColor === c.value ? "border-primary scale-110 shadow-md" : "border-transparent hover:scale-105"
                            )}
                            style={{ backgroundColor: c.value }}
                            title={c.name}
                          >
                            {newSubjectColor === c.value && <div className="w-3 h-3 rounded-full bg-white shadow-sm" />}
                          </button>
                        ))}
                        
                        <div className="w-px h-6 bg-slate-200 mx-1" />
                        
                        <div className="flex items-center gap-2 group p-1 pr-3 rounded-full bg-white border border-dashed hover:border-primary transition-all">
                          <input 
                            type="color" 
                            value={newSubjectColor} 
                            onChange={(e) => setNewSubjectColor(e.target.value)}
                            className="w-8 h-8 p-0 border-none rounded-full cursor-pointer bg-transparent overflow-hidden" 
                          />
                          <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors">Personalizada</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-4 pt-2 border-t border-dashed">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-bold whitespace-nowrap">Vincular a:</Label>
                        <Select value={subjectTargetType} onValueChange={(v: any) => { setSubjectTargetType(v); setSubjectTargetIds([]); }}>
                          <SelectTrigger className="h-9 w-[120px] rounded-lg bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="global">Global</SelectItem>
                            <SelectItem value="segment">Segmentos</SelectItem>
                            <SelectItem value="class">Turmas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {subjectTargetType !== 'global' && (
                        <div className="flex flex-col gap-2 p-3 bg-white border rounded-xl animate-in slide-in-from-left-2 w-full">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                            {subjectTargetType === 'segment' ? "Selecionar Segmentos" : "Selecionar Turmas"}
                          </Label>
                          <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto pr-2">
                            {(subjectTargetType === 'segment' ? sortedSegments : sortedClasses).map(item => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setSubjectTargetIds(prev => 
                                    prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                                  );
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all",
                                  subjectTargetIds.includes(item.id) 
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                                    : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50"
                                )}
                              >
                                {item.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {sortedSubjects.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {sortedSubjects.map(s => (
                        <div key={s.id} className="flex justify-between items-center p-3 border rounded-xl bg-muted/5 group hover:bg-white shadow-sm transition-all">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-8 h-8 rounded-lg shadow-sm flex items-center justify-center text-[10px] font-bold" 
                              style={{ backgroundColor: s.color || '#3b82f6', color: getContrastColor(s.color || '#3b82f6') }}
                            >
                              {s.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-sm">{s.name}</span>
                              {(() => {
                                if (s.schoolClassIds && s.schoolClassIds.length > 0) {
                                  const names = s.schoolClassIds.map(id => sortedClasses.find(c => c.id === id)?.name).filter(Boolean);
                                  return <span className="text-[10px] text-muted-foreground italic line-clamp-1" title={names.join(', ')}>Turmas: {names.join(', ')}</span>;
                                }
                                if (s.schoolSegmentIds && s.schoolSegmentIds.length > 0) {
                                  const names = s.schoolSegmentIds.map(id => sortedSegments.find(seg => seg.id === id)?.name).filter(Boolean);
                                  return <span className="text-[10px] text-muted-foreground italic line-clamp-1" title={names.join(', ')}>Segs: {names.join(', ')}</span>;
                                }
                                return <span className="text-[10px] text-muted-foreground italic opacity-50">Global</span>;
                              })()}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-primary" 
                              onClick={() => {
                                setEditingSubject(s);
                                setEditSubjectName(s.name);
                                setEditSubjectColor(s.color || '#3b82f6');
                                setEditSubjectTargetType(s.schoolClassIds?.length ? 'class' : (s.schoolSegmentIds?.length ? 'segment' : 'global'));
                                setEditSubjectTargetIds(s.schoolClassIds || s.schoolSegmentIds || []);
                              }}
                            >
                              <ListPlus className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveSubject(s.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-20 text-center text-muted-foreground border-2 border-dashed rounded-3xl flex flex-col items-center gap-3">
                      <BookOpen className="w-8 h-8 opacity-20" />
                      <p>Nenhuma disciplina cadastrada nesta listagem rápida.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Edição de Matéria na Matriz */}
      <Dialog open={!!editingGridSlot} onOpenChange={() => { setEditingGridSlot(null); setSelectedRepeatDays([]); setSelectedRepeatTimes([]); }}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Definir Matéria</DialogTitle>
            <DialogDescription>
              {editingGridSlot && `${editingGridSlot.startTime} - ${editingGridSlot.durationMinutes}min`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Disciplina</Label>
              <Select value={tempSubject} onValueChange={setTempSubject}>
                <SelectTrigger className="rounded-xl h-12 bg-white font-medium">
                  <SelectValue placeholder="Escolha a disciplina..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubjectsForGrid.map(s => (
                    <SelectItem key={s.id} value={s.name}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: s.color || '#3b82f6' }} />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                  <div className="h-px bg-muted my-1" />
                  <SelectItem value="_manual_">✎ Outra (Digitar)...</SelectItem>
                </SelectContent>
              </Select>
              {tempSubject === '_manual_' && (
                <Input 
                  placeholder="Nome da disciplina..." 
                  className="rounded-xl h-11 animate-in slide-in-from-top-1" 
                  autoFocus
                  onChange={(e) => setTempSubject(e.target.value)} 
                />
              )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Replicar nos dias:</Label>
                <button 
                  onClick={() => {
                    const allDays = DAYS_OF_WEEK.slice(0, 5).map(d => d.id);
                    setSelectedRepeatDays(selectedRepeatDays.length === 5 ? [] : allDays);
                  }}
                  className="text-[10px] text-primary font-bold hover:underline"
                >
                  {selectedRepeatDays.length === 5 ? "Desmarcar Todos" : "Marcar Todos (Seg-Sex)"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.slice(0, 6).map(day => (
                  <button
                    key={day.id}
                    onClick={() => {
                      setSelectedRepeatDays(prev => 
                        prev.includes(day.id) ? prev.filter(id => id !== day.id) : [...prev, day.id]
                      );
                    }}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-bold border transition-all",
                      selectedRepeatDays.includes(day.id) 
                        ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                        : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50"
                    )}
                  >
                    {day.short}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Replicar nos horários:</Label>
                <button 
                  onClick={() => {
                    setSelectedRepeatTimes(selectedRepeatTimes.length === uniqueTimesForGrid.length ? [] : uniqueTimesForGrid);
                  }}
                  className="text-[10px] text-primary font-bold hover:underline"
                >
                  {selectedRepeatTimes.length === uniqueTimesForGrid.length ? "Desmarcar Todos" : "Marcar Todos"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[40px]">
                {uniqueTimesForGrid.map(t => (
                  <button
                    key={t}
                    onClick={() => {
                      setSelectedRepeatTimes(prev => 
                        prev.includes(t) ? prev.filter(time => time !== t) : [...prev, t]
                      );
                    }}
                    className={cn(
                      "px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all",
                      selectedRepeatTimes.includes(t) 
                        ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                        : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => { setEditingGridSlot(null); setSelectedRepeatDays([]); setSelectedRepeatTimes([]); }}>Cancelar</Button>
            <Button className="rounded-xl font-bold px-6" onClick={handleSaveGridSubject}>Salvar e Replicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição de Disciplina */}
      <Dialog open={!!editingSubject} onOpenChange={() => setEditingSubject(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Disciplina</DialogTitle>
            <DialogDescription>Altere as informações da disciplina abaixo.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            <div className="space-y-2">
              <Label>Nome da Disciplina</Label>
              <Input 
                value={editSubjectName} 
                onChange={(e) => setEditSubjectName(e.target.value)} 
                placeholder="Ex: Matemática" 
                className="rounded-xl h-12"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Cor de Destaque</Label>
              <div className="flex flex-wrap gap-2 items-center">
                {PREDEFINED_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setEditSubjectColor(c.value)}
                    type="button"
                    className={cn(
                      "w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center shadow-sm",
                      editSubjectColor === c.value ? "border-primary scale-110 shadow-md" : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  >
                    {editSubjectColor === c.value && <div className="w-2 h-2 rounded-full bg-white shadow-sm" />}
                  </button>
                ))}
                
                <div className="w-px h-6 bg-slate-200 mx-1" />
                
                <div className="flex items-center gap-2 group p-1 pr-3 rounded-full bg-white border border-dashed hover:border-primary transition-all">
                  <input 
                    type="color" 
                    value={editSubjectColor} 
                    onChange={(e) => setEditSubjectColor(e.target.value)}
                    className="w-8 h-8 p-0 border-none rounded-full cursor-pointer bg-transparent overflow-hidden" 
                  />
                  <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors">Personalizada</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Vínculo</Label>
              <div className="space-y-3">
                <Select value={editSubjectTargetType} onValueChange={(v: any) => { setEditSubjectTargetType(v); setEditSubjectTargetIds([]); }}>
                  <SelectTrigger className="rounded-xl h-11 bg-white font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="segment">Segmentos</SelectItem>
                    <SelectItem value="class">Turmas</SelectItem>
                  </SelectContent>
                </Select>
                
                {editSubjectTargetType !== 'global' && (
                  <div className="flex flex-col gap-2 p-3 bg-white border rounded-xl animate-in slide-in-from-top-2 w-full">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                      {editSubjectTargetType === 'segment' ? "Selecionar Segmentos" : "Selecionar Turmas"}
                    </Label>
                    <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto pr-2">
                      {(editSubjectTargetType === 'segment' ? sortedSegments : sortedClasses).map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setEditSubjectTargetIds(prev => 
                              prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                            );
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all",
                            editSubjectTargetIds.includes(item.id) 
                              ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                              : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50"
                          )}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => setEditingSubject(null)}>Cancelar</Button>
            <Button className="rounded-xl font-bold px-6 shadow-md" onClick={handleUpdateSubject}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
        <DialogContent className="rounded-3xl max-w-xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="bg-primary p-8 text-white">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Copy className="w-6 h-6" /> Duplicar Grade de Horários
            </DialogTitle>
            <DialogDescription className="text-white/70">
              Copie toda a estrutura de horários de uma origem para um novo destino.
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-8">
            <div className="space-y-4">
              <Label className="text-xs font-bold uppercase tracking-widest text-primary">Origem (De onde copiar)</Label>
              <div className="grid grid-cols-2 gap-4">
                <Select value={copySourceType} onValueChange={(v: any) => { setCopySourceType(v); setCopySourceId(''); }}>
                  <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Grade Global</SelectItem>
                    <SelectItem value="segment">Por Segmento</SelectItem>
                    <SelectItem value="class">Por Turma</SelectItem>
                  </SelectContent>
                </Select>
                {copySourceType !== 'global' && (
                  <Select value={copySourceId} onValueChange={setCopySourceId}>
                    <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {copySourceType === 'segment' ? sortedSegments.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>) : sortedClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>) }
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-xs font-bold uppercase tracking-widest text-primary">Destino (Para onde copiar)</Label>
              <div className="grid grid-cols-2 gap-4">
                <Select value={copyDestType} onValueChange={(v: any) => { setCopyDestType(v); setCopyDestId(''); }}>
                  <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="segment">Segmento</SelectItem>
                    <SelectItem value="class">Turma</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={copyDestId} onValueChange={setCopyDestId}>
                  <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {copyDestType === 'segment' ? sortedSegments.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>) : sortedClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="bg-muted/30 p-4 rounded-2xl border border-dashed flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">Isso criará cópias idênticas dos horários de origem para o destino selecionado. Verifique se o destino já possui horários para evitar duplicidade.</p>
            </div>
          </div>
          <DialogFooter className="p-8 bg-slate-50 border-t gap-3">
            <Button variant="outline" onClick={() => setIsCopyDialogOpen(false)} className="rounded-xl h-12 px-8">Cancelar</Button>
            <Button onClick={handleDuplicateGrade} disabled={isCopying || !copyDestId || (copySourceType !== 'global' && !copySourceId)} className="rounded-xl h-12 px-10 font-bold shadow-lg">
              {isCopying ? <Loader2 className="animate-spin w-5 h-5" /> : "Confirmar Duplicação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Importar Lista de Datas</DialogTitle>
            <DialogDescription>Cole datas separadas por linha para bloquear em massa no sistema.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="bulk-dates-input">Lista de Datas</Label>
            <Textarea id="bulk-dates-input" name="bulkDates" placeholder="01/01/2025&#10;02/01/2025" className="rounded-xl min-h-[200px] mt-2" value={bulkDatesText} onChange={(e) => setBulkDatesText(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkImportOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleProcessBulkText} className="rounded-xl">Identificar Datas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview de Importação */}
      <Dialog open={isImportPreviewOpen} onOpenChange={setIsImportPreviewOpen}>
        <DialogContent className="rounded-3xl max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-primary text-white">
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Upload className="w-6 h-6" /> Pré-visualização da Importação
            </DialogTitle>
            <DialogDescription className="text-white/80">
              Revise os horários encontrados no arquivo antes de salvar. {importPreviewData.length} itens identificados.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Dia</TableHead>
                  <TableHead className="font-bold">Horário</TableHead>
                  <TableHead className="font-bold">Matéria</TableHead>
                  <TableHead className="font-bold">Vínculo</TableHead>
                  <TableHead className="font-bold text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importPreviewData.map((s, idx) => {
                  const existing = slots?.find(ex => 
                    ex.dayOfWeek === s.dayOfWeek && 
                    ex.startTime === s.startTime && 
                    ex.schoolClassId === s.schoolClassId && 
                    ex.schoolSegmentId === s.schoolSegmentId
                  );
                  return (
                    <TableRow key={idx}>
                      <TableCell>{DAYS_OF_WEEK.find(d => d.id === s.dayOfWeek)?.label}</TableCell>
                      <TableCell className="font-mono">{s.startTime}</TableCell>
                      <TableCell className="font-bold text-primary">{s.subject || '-'}</TableCell>
                      <TableCell>{getTargetName(s)}</TableCell>
                      <TableCell className="text-center">
                        {existing ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Existe (Será atualizado)</Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Novo</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Novas Disciplinas */}
            {newSubjectsToRegister.length > 0 && (
              <div className="mt-8 bg-amber-50 border border-amber-200 rounded-3xl p-8 space-y-6">
                <div className="flex items-center gap-3 text-amber-900 font-bold text-xl">
                  <div className="bg-amber-200 p-2 rounded-xl">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  Novas Disciplinas Identificadas
                </div>
                <p className="text-amber-800 leading-relaxed">
                  As seguintes disciplinas foram encontradas no arquivo mas não estão cadastradas no sistema. 
                  O sistema irá cadastrá-las automaticamente. Escolha uma cor para cada uma:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {newSubjectsToRegister.map(name => (
                    <Card key={name} className="border-amber-100 shadow-sm overflow-hidden rounded-2xl">
                      <div className="p-5 flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-bold text-lg text-slate-800 truncate">{name}</span>
                          <div 
                            className="w-8 h-8 rounded-full border-4 border-white shadow-md ring-1 ring-slate-200" 
                            style={{ backgroundColor: newSubjectColorsMap[name] }} 
                          />
                        </div>
                        <div className="flex gap-2 flex-wrap justify-start">
                          {PREDEFINED_COLORS.map(color => (
                            <button
                              key={color.value}
                              onClick={() => setNewSubjectColorsMap(prev => ({ ...prev, [name]: color.value }))}
                              className={cn(
                                "w-7 h-7 rounded-lg border-2 transition-all hover:scale-110",
                                newSubjectColorsMap[name] === color.value 
                                  ? "border-slate-900 shadow-inner scale-105" 
                                  : "border-transparent opacity-80"
                              )}
                              style={{ backgroundColor: color.value }}
                              title={color.name}
                            />
                          ))}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 bg-muted/20 border-t flex-col sm:flex-row gap-4">
            <div className="flex-1 text-sm text-muted-foreground">
              Escolha como deseja lidar com os horários que já existem no sistema.
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setIsImportPreviewOpen(false)} disabled={isSaving}>Cancelar</Button>
              <Button 
                variant="outline" 
                className="border-primary text-primary hover:bg-primary/5"
                onClick={() => handleConfirmImport('append')}
                disabled={isSaving}
              >
                Acrescentar Novos
              </Button>
              <Button 
                className="bg-primary font-bold px-8 shadow-lg shadow-primary/20"
                onClick={() => handleConfirmImport('replace')}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Substituir e Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}