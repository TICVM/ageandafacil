
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { type Student, type BadgeModel, type SchoolSegment, type SchoolClass, type SystemConfig } from "@/lib/types";
import PageHeader from "@/components/page-header";
import AddStudentCard from "@/components/add-student-card";
import StudentList from "@/components/student-list";
import { 
  useFirestore, 
  useCollection, 
  useUser, 
  useMemoFirebase,
  useAuth,
  useDoc
} from "@/firebase";
import { 
  updateDocumentNonBlocking, 
  addDocumentNonBlocking, 
  deleteDocumentNonBlocking,
  setDocumentNonBlocking
} from "@/firebase/non-blocking-updates";
import { collection, doc, query, orderBy, writeBatch, getDocs, where, addDoc, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, signInAnonymously } from "firebase/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  School,
  Database,
  Search,
  Plus,
  Trash2,
  Layers,
  ArrowRightLeft,
  UserMinus,
  UserCheck,
  Archive,
  Loader2,
  Settings,
  UserPlus,
  ListFilter,
  Palette,
  RefreshCw,
  Info,
  Globe,
  Code,
  FileJson,
  CheckCircle2,
  XCircle,
  CheckSquare,
  Square,
  Eye,
  EyeOff,
  UserCircle,
  Lock,
  Filter,
  Pencil,
  ChevronRight,
  ArrowRight,
  TrendingUp,
  Save,
  MoveHorizontal
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BulkImportCard from "@/components/bulk-import-card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const registerSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(6, "Mínimo 6 caracteres."),
  confirmPassword: z.string().min(6, "Mínimo 6 caracteres."),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

type RegisterValues = z.infer<typeof registerSchema>;

/**
 * Utilitário para converter o formato de turma do Activesoft
 */
function parseSigaTurma(raw: string) {
  if (!raw || !raw.includes('/')) return { segmento: 'Sincronizado', turma: raw || 'SIGA' };
  
  const parts = raw.split('/').map(p => p.trim());
  let segmento = parts[0];
  
  // Mapeamento padronizado de siglas
  if (segmento === 'EI' || segmento === 'INF') segmento = 'Educação Infantil';
  else if (segmento === 'EF' || segmento === 'FUND') segmento = 'Ensino Fundamental';
  else if (segmento === 'EM' || segmento === 'MED') segmento = 'Ensino Médio';
  
  const ano = parts[1] || '';
  const turmaLetra = parts[2]?.split('-')[0].trim() || '';
  const turma = `${ano} ${turmaLetra}`.trim();
  
  return { segmento, turma };
}

export default function GestaoPage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("alunos");
  const [showTransferred, setShowTransferred] = useState(false);
  const [isRegisteringAdmin, setIsRegisteringAdmin] = useState(false);
  
  const [filterSegmentoId, setFilterSegmentoId] = useState<string | null>(null);
  const [filterTurma, setFilterTurma] = useState<string | null>(null);

  const [isSyncingSiga, setIsSyncingSiga] = useState(false);
  const [isProcessingManual, setIsProcessingManual] = useState(false);
  
  const [jsonAlunos, setJsonAlunos] = useState("");
  const [jsonFotos, setJsonFotos] = useState("");
  const [jsonTurmas, setJsonTurmas] = useState("");
  const [previewImportList, setPreviewImportList] = useState<any[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [previewSearchTerm, setPreviewSearchTerm] = useState("");

  // Estrutura - Criação
  const [newSegmentName, setNewSegmentName] = useState("");
  const [newSegmentOrder, setNewSegmentOrder] = useState(1);
  const [segmentSearch, setSegmentSearch] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [newClassOrder, setNewClassOrder] = useState(1);
  const [newClassSegmentId, setNewClassSegmentId] = useState("");
  const [classSearch, setClassSearch] = useState("");
  const [classFilterSegmentId, setClassFilterSegmentId] = useState<string>("all");

  // Estrutura - Edição
  const [editingSegment, setEditingSegment] = useState<SchoolSegment | null>(null);
  const [isEditSegDialogOpen, setIsEditSegDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [isEditClassDialogOpen, setIsEditClassDialogOpen] = useState(false);

  // Migração Massiva (Aba Estrutura)
  const [migrationSourceTurma, setMigrationSourceTurma] = useState("");
  const [migrationTargetTurma, setMigrationTargetTurma] = useState("");
  const [migrationTargetSegmentId, setMigrationTargetSegmentId] = useState("");
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationSourceSegName, setMigrationSourceSegName] = useState("");
  const [migrationTargetSegId, setMigrationTargetSegId] = useState("");
  const [isMigratingSeg, setIsMigratingSeg] = useState(false);

  // Migração de Selecionados (Aba Alunos)
  const [targetSelectedSegmentId, setTargetSelectedSegmentId] = useState("");
  const [targetSelectedTurmaName, setTargetSelectedTurmaName] = useState("");
  const [isMigratingSelected, setIsMigratingSelected] = useState(false);

  // Sistema
  const [logoBase64, setLogoBase64] = useState("");
  const [logoHeight, setLogoHeight] = useState(48);
  const [sigaUrl, setSigaUrl] = useState("");
  const [sigaToken, setSigaToken] = useState("");
  const [sigaUsername, setSigaUsername] = useState("");
  const [sigaPassword, setSigaPassword] = useState("");

  const configRef = useMemoFirebase(() => firestore ? doc(firestore, 'configuracoes', 'geral') : null, [firestore]);
  const { data: configData } = useDoc<SystemConfig>(configRef);

  useEffect(() => {
    if (configData?.logoUrl) setLogoBase64(configData.logoUrl);
    if (configData?.logoHeight) setLogoHeight(configData.logoHeight);
    if (configData?.sigaUrl) setSigaUrl(configData.sigaUrl);
    if (configData?.sigaToken) setSigaToken(configData.sigaToken);
    if (configData?.sigaUsername) setSigaUsername(configData.sigaUsername);
    if (configData?.sigaPassword) setSigaPassword(configData.sigaPassword);
  }, [configData]);

  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!isUserLoading && (!user || user.isAnonymous)) {
      toast({ variant: "destructive", title: "Acesso Negado", description: "Faça login como administrador." });
      router.replace("/login");
    }
  }, [user, isUserLoading, router, toast]);

  const alunosCollection = useMemoFirebase(() => firestore && user ? collection(firestore, 'alunos') : null, [firestore, user]);
  const segmentosCollection = useMemoFirebase(() => firestore && user ? query(collection(firestore, 'segmentos'), orderBy('ordem', 'asc')) : null, [firestore, user]);
  const turmasCollection = useMemoFirebase(() => firestore && user ? query(collection(firestore, 'turmas'), orderBy('ordem', 'asc')) : null, [firestore, user]);
  const modelosCollection = useMemoFirebase(() => firestore && user ? collection(firestore, 'modelosCracha') : null, [firestore, user]);

  const { data: studentsData } = useCollection<Student>(alunosCollection);
  const { data: segmentsData } = useCollection<SchoolSegment>(segmentosCollection);
  const { data: classesData } = useCollection<SchoolClass>(turmasCollection);
  const { data: modelsData } = useCollection<BadgeModel>(modelosCollection);

  const allStudents = studentsData || [];
  const schoolSegments = segmentsData || [];
  const schoolClasses = classesData || [];
  const models = modelsData || [];

  const classCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allStudents.forEach(s => {
      if (s.ativo !== false) {
        counts[s.turma] = (counts[s.turma] || 0) + 1;
      }
    });
    return counts;
  }, [allStudents]);

  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allStudents.forEach(s => {
      if (s.ativo !== false) {
        counts[s.segmento] = (counts[s.segmento] || 0) + 1;
      }
    });
    return counts;
  }, [allStudents]);

  const filteredStudents = useMemo(() => {
    let result = allStudents.filter(s => showTransferred ? s.ativo === false : s.ativo !== false);
    if (filterSegmentoId) result = result.filter(s => s.segmento === filterSegmentoId);
    if (filterTurma) result = result.filter(s => s.turma === filterTurma);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s => s.nome.toLowerCase().includes(term) || String(s.matricula).toLowerCase().includes(term));
    }
    return result.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allStudents, showTransferred, searchTerm, filterSegmentoId, filterTurma]);

  const selectedInFilter = useMemo(() => filteredStudents.filter(s => s.enabled === true), [filteredStudents]);

  const handleBulkToggleEnabled = async (enabled: boolean, onlySelected: boolean = false) => {
    if (filteredStudents.length === 0 || !firestore) return;
    const list = onlySelected ? selectedInFilter : filteredStudents;
    const batch = writeBatch(firestore);
    list.slice(0, 500).forEach(s => batch.update(doc(firestore, 'alunos', s.id), { enabled }));
    await batch.commit();
    toast({ title: enabled ? "Seleção de impressão atualizada" : "Seleção removida" });
  };

  const handleBulkToggleAtivo = async (ativo: boolean, apenasSelecionados: boolean = false) => {
    if (filteredStudents.length === 0 || !firestore) return;
    const listToUpdate = apenasSelecionados ? selectedInFilter : filteredStudents;
    const batch = writeBatch(firestore);
    listToUpdate.slice(0, 500).forEach(s => batch.update(doc(firestore, 'alunos', s.id), { ativo }));
    await batch.commit();
    toast({ title: ativo ? "Alunos reativados" : "Alunos transferidos" });
  };

  const handleBulkToggleVisibilidade = async (visivel: boolean, apenasSelecionados: boolean = false) => {
    if (filteredStudents.length === 0 || !firestore) return;
    const listToUpdate = apenasSelecionados ? selectedInFilter : filteredStudents;
    const batch = writeBatch(firestore);
    listToUpdate.slice(0, 500).forEach(s => batch.update(doc(firestore, 'alunos', s.id), { visivelFila: visivel }));
    await batch.commit();
    toast({ title: visivel ? "Alunos exibidos na fila" : "Alunos ocultos da fila" });
  };

  const handleBulkMigrateSelected = async () => {
    if (selectedInFilter.length === 0 || !firestore) {
      toast({ variant: "destructive", title: "Nenhum selecionado", description: "Marque os alunos com o check azul primeiro." });
      return;
    }
    if (!targetSelectedSegmentId || !targetSelectedTurmaName) {
      toast({ variant: "destructive", title: "Destino incompleto", description: "Selecione o segmento e a turma de destino." });
      return;
    }

    setIsMigratingSelected(true);
    try {
      const targetSeg = schoolSegments.find(s => s.id === targetSelectedSegmentId);
      if (!targetSeg) throw new Error("Segmento não encontrado.");

      const batch = writeBatch(firestore);
      selectedInFilter.slice(0, 500).forEach(s => {
        batch.update(doc(firestore, 'alunos', s.id), {
          segmento: targetSeg.nome,
          turma: targetSelectedTurmaName
        });
      });
      await batch.commit();
      toast({ title: "Migração Concluída!", description: `${selectedInFilter.length} alunos movidos.` });
      setTargetSelectedSegmentId(""); setTargetSelectedTurmaName("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na migração", description: e.message });
    } finally {
      setIsMigratingSelected(false);
    }
  };

  const handleMigrateStudents = async () => {
    if (!migrationSourceTurma || !firestore) {
      toast({ variant: "destructive", title: "Seleção incompleta", description: "Escolha pelo menos a turma de origem." });
      return;
    }
    setIsMigrating(true);
    try {
      const q = query(collection(firestore, 'alunos'), where('turma', '==', migrationSourceTurma));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast({ variant: "destructive", title: "Nenhum aluno", description: "Não há alunos na turma de origem." });
        return;
      }
      const batch = writeBatch(firestore);
      const updates: any = {};
      if (migrationTargetTurma && migrationTargetTurma !== "UNCHANGED") updates.turma = migrationTargetTurma;
      if (migrationTargetSegmentId && migrationTargetSegmentId !== "UNCHANGED") {
        const seg = schoolSegments.find(s => s.id === migrationTargetSegmentId);
        if (seg) updates.segmento = seg.nome;
      }
      if (Object.keys(updates).length === 0) {
        toast({ variant: "destructive", title: "Ação vazia", description: "Selecione um destino (Turma ou Segmento)." });
        return;
      }
      snap.docs.forEach(d => batch.update(d.ref, updates));
      await batch.commit();
      toast({ title: "Migração Concluída!", description: `${snap.size} alunos movidos.` });
      setMigrationSourceTurma(""); setMigrationTargetTurma(""); setMigrationTargetSegmentId("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na migração", description: e.message });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleMigrateSegment = async () => {
    if (!migrationSourceSegName || !migrationTargetSegId || !firestore) {
      toast({ variant: "destructive", title: "Seleção incompleta", description: "Escolha os segmentos de origem e destino." });
      return;
    }
    setIsMigratingSeg(true);
    try {
      const targetSeg = schoolSegments.find(s => s.id === migrationTargetSegId);
      if (!targetSeg) throw new Error("Segmento de destino não encontrado.");
      const q = query(collection(firestore, 'alunos'), where('segmento', '==', migrationSourceSegName));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast({ variant: "destructive", title: "Nenhum aluno", description: "Não há alunos no segmento de origem." });
        return;
      }
      const batch = writeBatch(firestore);
      snap.docs.forEach(d => batch.update(d.ref, { segmento: targetSeg.nome }));
      await batch.commit();
      toast({ title: "Migração de Segmento Concluída!", description: `${snap.size} alunos movidos para ${targetSeg.nome}.` });
      setMigrationSourceSegName(""); setMigrationTargetSegId("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na migração", description: e.message });
    } finally {
      setIsMigratingSeg(false);
    }
  };

  const handleAnalyzeManualJson = () => {
    if (!jsonAlunos) {
      toast({ variant: "destructive", title: "Dados Ausentes", description: "O campo de Alunos é obrigatório." });
      return;
    }
    try {
      const alunosRaw = JSON.parse(jsonAlunos);
      const alunosList = alunosRaw.results || alunosRaw;
      let fotosList: any[] = [];
      let turmasList: any[] = [];
      try { if (jsonFotos) fotosList = JSON.parse(jsonFotos); } catch (e) {}
      try { if (jsonTurmas) turmasList = JSON.parse(jsonTurmas); } catch (e) {}
      const photosMap = new Map(fotosList.map(p => [p.id, p.s3]));
      const classesMap = new Map(turmasList.map(c => [c.id, c.turma_oficial]));
      const analyzed = alunosList.map((item: any) => {
        const { nome, matricula, id, ativo } = item;
        const photoUrl = photosMap.get(id) || "";
        const rawTurma = classesMap.get(id) || "";
        const { segmento, turma } = parseSigaTurma(rawTurma);
        return { nome: (nome || "").trim(), matricula: String(matricula || ""), segmento, turma, fotoUrl: photoUrl, ativo: ativo !== undefined ? !!ativo : true, idActivesoft: id };
      }).filter((a: any) => a.nome && a.matricula);
      setPreviewImportList(analyzed);
      setSelectedIndices(new Set(analyzed.map((_: any, i: number) => i)));
      toast({ title: "Análise concluída!", description: `${analyzed.length} alunos encontrados.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro no JSON", description: "Verifique o formato dos dados." });
    }
  };

  const handleManualJsonProcess = async () => {
    if (selectedIndices.size === 0 || !firestore) {
      toast({ variant: "destructive", title: "Nenhuma seleção", description: "Selecione pelo menos um aluno." });
      return;
    }
    setIsProcessingManual(true);
    try {
      const listToImport = previewImportList.filter((_, i) => selectedIndices.has(i));
      const segmentMap = new Map();
      const classMap = new Map();
      schoolSegments.forEach(s => segmentMap.set(s.nome, s.id));
      schoolClasses.forEach(c => classMap.set(`${c.nome}-${c.segmentoId}`, c.id));
      let created = 0;
      let updated = 0;
      for (const student of listToImport) {
        let segmentId = segmentMap.get(student.segmento);
        if (!segmentId) {
          const newSegRef = await addDoc(collection(firestore, 'segmentos'), { nome: student.segmento, ordem: segmentMap.size + 1 });
          segmentId = newSegRef.id;
          segmentMap.set(student.segmento, segmentId);
        }
        const classKey = `${student.turma}-${segmentId}`;
        let classId = classMap.get(classKey);
        if (!classId) {
          const newClassRef = await addDoc(collection(firestore, 'turmas'), { nome: student.turma, segmentoId: segmentId, ordem: classMap.size + 1 });
          classId = newClassRef.id;
          classMap.set(classKey, classId);
        }
        const matStr = student.matricula;
        const q = query(collection(firestore, 'alunos'), where('matricula', '==', matStr));
        const snap = await getDocs(q);
        const studentData = { ...student, visivelFila: true, enabled: true, updatedAt: new Date().toISOString() };
        delete (studentData as any).idActivesoft;
        if (!snap.empty) {
          await updateDoc(doc(firestore, 'alunos', snap.docs[0].id), studentData);
          updated++;
        } else {
          await addDoc(collection(firestore, 'alunos'), studentData);
          created++;
        }
      }
      toast({ title: "Importação Concluída!", description: `${created} novos, ${updated} atualizados.` });
      setPreviewImportList([]); setSelectedIndices(new Set()); setJsonAlunos(""); setJsonFotos(""); setJsonTurmas("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na Gravação", description: e.message });
    } finally {
      setIsProcessingManual(false);
    }
  };

  const handlePullSigaSync = async () => {
    if (!sigaUrl) {
      toast({ variant: "destructive", title: "URL Ausente", description: "Defina a URL do SIGA em Sistema." });
      return;
    }
    setIsSyncingSiga(true);
    let currentToken = sigaToken;
    try {
      if (!currentToken && sigaUsername && sigaPassword) {
        const authResponse = await fetch('/api/siga-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: sigaUrl, action: 'login', username: sigaUsername, password: sigaPassword })
        });
        if (authResponse.ok) {
          const authData = await authResponse.json();
          currentToken = authData.token;
        } else {
          const errData = await authResponse.json();
          throw new Error(errData.details || 'Falha na autenticação.');
        }
      }
      if (!currentToken) throw new Error('Credenciais ausentes.');
      const response = await fetch('/api/siga-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sigaUrl, token: currentToken })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || 'Erro na conexão com o SIGA.');
      }
      const body = await response.json();
      const items = body.results || body;
      if (!Array.isArray(items)) throw new Error('Resposta inválida.');
      let created = 0;
      let updated = 0;
      for (const item of items) {
        const { nome, matricula, ativo, turma_oficial, s3, fotoUrl } = item;
        if (!nome || !matricula) continue;
        const matStr = String(matricula);
        const q = query(collection(firestore!, 'alunos'), where('matricula', '==', matStr));
        const snap = await getDocs(q);
        const { segmento, turma } = parseSigaTurma(turma_oficial);
        const studentData = { nome: nome.trim(), matricula: matStr, segmento, turma, fotoUrl: s3 || fotoUrl || '', ativo: ativo !== undefined ? !!ativo : true, visivelFila: true, enabled: true, updatedAt: new Date().toISOString() };
        if (!snap.empty) {
          await updateDoc(doc(firestore!, 'alunos', snap.docs[0].id), studentData);
          updated++;
        } else {
          await addDoc(collection(firestore!, 'alunos'), studentData);
          created++;
        }
      }
      toast({ title: "Sincronização Concluída!", description: `${created} novos, ${updated} atualizados.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Falha na sincronização", description: e.message });
    } finally {
      setIsSyncingSiga(false);
    }
  };

  const saveVisualSettings = () => {
    if (!firestore) return;
    setDocumentNonBlocking(doc(firestore, 'configuracoes', 'geral'), { 
      logoUrl: logoBase64, logoHeight, sigaUrl, sigaToken, sigaUsername, sigaPassword
    }, { merge: true });
    toast({ title: "Configurações salvas!" });
  };

  // Funções de Edição de Estrutura
  const handleEditSegment = (seg: SchoolSegment) => {
    setEditingSegment(seg);
    setIsEditSegDialogOpen(true);
  };

  const onUpdateSegment = () => {
    if (!editingSegment || !firestore) return;
    updateDocumentNonBlocking(doc(firestore, 'segmentos', editingSegment.id), {
      nome: editingSegment.nome,
      ordem: editingSegment.ordem
    });
    setIsEditSegDialogOpen(false);
    toast({ title: "Segmento atualizado!" });
  };

  const handleEditClass = (cls: SchoolClass) => {
    setEditingClass(cls);
    setIsEditClassDialogOpen(true);
  };

  const onUpdateClass = () => {
    if (!editingClass || !firestore) return;
    updateDocumentNonBlocking(doc(firestore, 'turmas', editingClass.id), {
      nome: editingClass.nome,
      ordem: editingClass.ordem,
      segmentoId: editingClass.segmentoId
    });
    setIsEditClassDialogOpen(false);
    toast({ title: "Turma atualizada!" });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader />
      <main className="container mx-auto p-4 md:p-8">
        <div className="flex flex-col gap-8">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-bold text-primary flex items-center gap-2"><Database className="h-8 w-8" /> Gestão Administrativa</h2>
              <p className="text-muted-foreground">Controle central de alunos e integração SIGA.</p>
            </div>
            <Button onClick={handlePullSigaSync} disabled={isSyncingSiga} className="gap-2 shadow-lg bg-green-600 hover:bg-green-700">
              {isSyncingSiga ? <Loader2 className="animate-spin" /> : <RefreshCw size={18} />}
              Sincronizar com SIGA
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-12 mb-8 shadow-sm">
              <TabsTrigger value="alunos" className="gap-2"><Users size={16}/> Alunos</TabsTrigger>
              <TabsTrigger value="estrutura" className="gap-2"><School size={16}/> Estrutura</TabsTrigger>
              <TabsTrigger value="importacao" className="gap-2"><ArrowRightLeft size={16}/> Importação</TabsTrigger>
              <TabsTrigger value="sistema" className="gap-2"><Settings size={16}/> Sistema</TabsTrigger>
            </TabsList>

            <TabsContent value="alunos" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1 flex flex-col gap-6">
                  <AddStudentCard onAddStudent={(s) => addDocumentNonBlocking(alunosCollection!, { ...s, enabled: true, visivelFila: true, ativo: true })} models={models} students={allStudents} segments={schoolSegments} classes={schoolClasses} />
                  
                  <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-muted/20 flex items-center gap-2">
                        <ListFilter size={18} className="text-primary"/>
                        <span className="font-bold text-sm">Controle de Fluxo</span>
                    </div>
                    
                    <Tabs defaultValue="filtros" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 h-10 bg-transparent border-b rounded-none">
                        <TabsTrigger value="filtros" className="text-[10px] uppercase font-bold tracking-widest data-[state=active]:bg-background">Filtros</TabsTrigger>
                        <TabsTrigger value="lote" className="text-[10px] uppercase font-bold tracking-widest data-[state=active]:bg-background">Ações em Lote</TabsTrigger>
                      </TabsList>

                      <TabsContent value="filtros" className="p-4 space-y-4 animate-in fade-in duration-200">
                         <div className="space-y-2">
                            <label className="text-[9px] font-bold uppercase text-muted-foreground">Segmento (Lista)</label>
                            <Select value={filterSegmentoId || "all"} onValueChange={(val) => { setFilterSegmentoId(val === "all" ? null : val); setFilterTurma(null); }}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todos ({allStudents.filter(s => s.ativo !== false).length})</SelectItem>
                                {schoolSegments.map(s => (
                                  <SelectItem key={s.id} value={s.nome}>
                                    {s.nome} ({segmentCounts[s.nome] || 0})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[9px] font-bold uppercase text-muted-foreground">Turma (Lista)</label>
                            <Select value={filterTurma || "all"} onValueChange={(val) => setFilterTurma(val === "all" ? null : val)}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                {schoolClasses.filter(c => !filterSegmentoId || c.segmentoId === schoolSegments.find(s => s.nome === filterSegmentoId)?.id).map(t => (
                                  <SelectItem key={t.id} value={t.nome}>
                                    {t.nome} ({classCounts[t.nome] || 0})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                         </div>
                         <Button variant={showTransferred ? "secondary" : "outline"} size="sm" onClick={() => setShowTransferred(!showTransferred)} className="w-full h-9 text-[10px] font-bold uppercase tracking-wider">
                            {showTransferred ? <UserCheck size={14} className="mr-2"/> : <Archive size={14} className="mr-2"/>} 
                            {showTransferred ? "Ver Ativos" : "Ver Arquivados"}
                          </Button>
                      </TabsContent>

                      <TabsContent value="lote" className="p-4 space-y-6 animate-in fade-in duration-200">
                         <div className="space-y-3">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block border-b pb-1">Para todos filtrados ({filteredStudents.length})</span>
                            <div className="grid grid-cols-1 gap-2">
                              <Button variant="outline" className="h-9 justify-start gap-3 text-[10px] uppercase font-bold bg-background" onClick={() => handleBulkToggleEnabled(true)}>
                                <CheckSquare size={14} className="text-primary"/> Selecionar Todos p/ Impressão
                              </Button>
                              <Button variant="outline" className="h-9 justify-start gap-3 text-[10px] uppercase font-bold bg-background" onClick={() => handleBulkToggleEnabled(false)}>
                                <Square size={14} className="text-muted-foreground"/> Deselecionar Todos p/ Impressão
                              </Button>
                              <Button variant="outline" className="h-9 justify-start gap-3 text-[10px] uppercase font-bold bg-background" onClick={() => handleBulkToggleVisibilidade(true)}>
                                <Eye size={14} className="text-primary"/> Habilitar Todos na Fila
                              </Button>
                              <Button variant="outline" className="h-9 justify-start gap-3 text-[10px] uppercase font-bold bg-background" onClick={() => handleBulkToggleVisibilidade(false)}>
                                <EyeOff size={14} className="text-muted-foreground"/> Ocultar Todos da Fila
                              </Button>
                              <Button variant="outline" className="h-9 justify-start gap-3 text-[10px] uppercase font-bold bg-orange-50/50 text-orange-600 border-orange-200" onClick={() => handleBulkToggleAtivo(false)}>
                                <UserMinus size={14}/> Transferir Todos Filtrados
                              </Button>
                              <Button variant="outline" className="h-9 justify-start gap-3 text-[10px] uppercase font-bold bg-green-50/50 text-green-600 border-green-200" onClick={() => handleBulkToggleAtivo(true)}>
                                <UserCheck size={14}/> Reativar Todos Filtrados
                              </Button>
                            </div>
                         </div>

                         <div className="space-y-4 pt-4 border-t">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block border-b pb-1">Para selecionados ({selectedInFilter.length})</span>
                            <div className="flex flex-col gap-2">
                              <Button variant="outline" className="h-9 justify-start gap-3 text-[10px] uppercase font-bold bg-background" onClick={() => handleBulkToggleVisibilidade(true, true)}>
                                <Eye size={14} className="text-primary"/> Mostrar Selecionados na Fila
                              </Button>
                              <Button variant="outline" className="h-9 justify-start gap-3 text-[10px] uppercase font-bold bg-background" onClick={() => handleBulkToggleVisibilidade(false, true)}>
                                <EyeOff size={14} className="text-muted-foreground"/> Ocultar Selecionados da Fila
                              </Button>
                              <Button variant="outline" className="h-9 justify-start gap-3 text-[10px] uppercase font-bold bg-orange-50/50 text-orange-600 border-orange-200" onClick={() => handleBulkToggleAtivo(false, true)}>
                                <UserMinus size={14}/> Transferir Selecionados
                              </Button>
                              <Button variant="outline" className="h-9 justify-start gap-3 text-[10px] uppercase font-bold bg-green-50/50 text-green-600 border-green-200" onClick={() => handleBulkToggleAtivo(true, true)}>
                                <UserCheck size={14}/> Reativar Selecionados
                              </Button>

                              <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-3">
                                <span className="text-[10px] font-bold uppercase text-primary flex items-center gap-2"><MoveHorizontal size={14}/> Migrar Selecionados</span>
                                <div className="space-y-2">
                                  <Select value={targetSelectedSegmentId} onValueChange={setTargetSelectedSegmentId}>
                                    <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="Novo Segmento..." /></SelectTrigger>
                                    <SelectContent>{schoolSegments.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                                  </Select>
                                  <Select value={targetSelectedTurmaName} onValueChange={setTargetSelectedTurmaName}>
                                    <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="Nova Turma..." /></SelectTrigger>
                                    <SelectContent>
                                      {schoolClasses.filter(c => !targetSelectedSegmentId || c.segmentoId === targetSelectedSegmentId).map(t => <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <Button className="w-full h-8 text-[10px] uppercase font-bold" onClick={handleBulkMigrateSelected} disabled={isMigratingSelected || !targetSelectedSegmentId || !targetSelectedTurmaName}>
                                    {isMigratingSelected ? <Loader2 className="animate-spin" /> : "Mover Selecionados"}
                                  </Button>
                                </div>
                              </div>
                            </div>
                         </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>

                <div className="lg:col-span-3">
                  <Card className="shadow-sm">
                    <CardHeader className="flex flex-col gap-6 py-6 border-b">
                      <div className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-bold text-primary">{showTransferred ? "Alunos Arquivados" : "Alunos Ativos"}</CardTitle>
                            <CardDescription className="text-xs font-medium">{filteredStudents.length} registros encontrados</CardDescription>
                        </div>
                        <div className="relative w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar por nome ou matrícula..." className="pl-9 h-10 text-xs" value={searchTerm ?? ""} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                      </div>

                      {/* Filtro por Botões (Pills) na Gestão */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1 tracking-widest">
                          <Layers size={12} className="text-primary" /> Atalhos por Segmento (Botões)
                        </label>
                        <ScrollArea className="w-full pb-2">
                          <div className="flex gap-2">
                            <Button 
                              variant={filterSegmentoId === null ? "default" : "outline"} 
                              size="sm" 
                              onClick={() => { setFilterSegmentoId(null); setFilterTurma(null); }}
                              className={cn(
                                "rounded-full h-8 px-4 text-[10px] font-bold transition-all shadow-sm",
                                filterSegmentoId === null ? "shadow-primary/20" : "bg-background"
                              )}
                            >
                              Todos
                            </Button>
                            {schoolSegments.map((seg) => (
                              <Button 
                                key={seg.id}
                                variant={filterSegmentoId === seg.nome ? "default" : "outline"} 
                                size="sm" 
                                onClick={() => { setFilterSegmentoId(seg.nome); setFilterTurma(null); }}
                                className={cn(
                                  "rounded-full h-8 px-4 text-[10px] font-bold whitespace-nowrap transition-all shadow-sm",
                                  filterSegmentoId === seg.nome ? "shadow-primary/20" : "bg-background"
                                )}
                              >
                                {seg.nome}
                                <span className={cn(
                                  "ml-2 text-[9px] opacity-70",
                                  filterSegmentoId === seg.nome ? "text-white" : "text-primary"
                                )}>
                                  ({segmentCounts[seg.nome] || 0})
                                </span>
                              </Button>
                            ))}
                          </div>
                          <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                      </div>
                    </CardHeader>
                    <StudentList students={filteredStudents} models={models} allStudents={allStudents} onUpdate={(s) => updateDocumentNonBlocking(doc(firestore!, 'alunos', s.id), s)} onDelete={(id) => deleteDocumentNonBlocking(doc(firestore!, 'alunos', id))} viewMode="table" segments={schoolSegments} classes={schoolClasses} />
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="estrutura" className="space-y-8">
               {/* Conteúdo de Estrutura permanece igual */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card className="shadow-sm border-2">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <CardTitle className="text-xl flex items-center gap-2"><Layers size={20} className="text-primary"/> Segmentos</CardTitle>
                          <CardDescription className="text-xs">Cadastre e ordene os níveis de ensino.</CardDescription>
                        </div>
                        <Badge variant="outline" className="font-mono">{schoolSegments.length}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2 bg-muted/20 p-2 rounded-lg border">
                        <Input placeholder="Novo Segmento" value={newSegmentName ?? ""} onChange={(e) => setNewSegmentName(e.target.value)} className="bg-background h-10" />
                        <Input type="number" placeholder="Ordem" value={newSegmentOrder ?? 0} onChange={(e) => setNewSegmentOrder(Number(e.target.value))} className="w-20 bg-background h-10" />
                        <Button onClick={() => { if (!newSegmentName) return; addDocumentNonBlocking(collection(firestore!, 'segmentos'), { nome: newSegmentName, ordem: newSegmentOrder }); setNewSegmentName(""); setNewSegmentOrder(p => p + 1); }} className="h-10 px-3"><Plus size={18}/></Button>
                      </div>
                      
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Filtrar segmentos..." className="pl-9 h-9 text-xs" value={segmentSearch ?? ""} onChange={(e) => setSegmentSearch(e.target.value)} />
                      </div>

                      <ScrollArea className="h-[400px] border rounded-xl overflow-hidden shadow-inner bg-muted/5">
                        <div className="divide-y">
                          {schoolSegments.filter(s => !segmentSearch || s.nome.toLowerCase().includes(segmentSearch.toLowerCase())).map(seg => (
                            <div key={seg.id} className="p-4 flex justify-between items-center hover:bg-muted/30 transition-colors group">
                              <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{seg.ordem}</span>
                                <div className="flex flex-col">
                                  <span className="font-bold text-sm">{seg.nome}</span>
                                  <span className="text-[10px] text-muted-foreground">{segmentCounts[seg.nome] || 0} alunos</span>
                                </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEditSegment(seg)}><Pencil size={14}/></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteDocumentNonBlocking(doc(firestore!, 'segmentos', seg.id))}><Trash2 size={14}/></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-2">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <CardTitle className="text-xl flex items-center gap-2"><School size={20} className="text-primary"/> Turmas</CardTitle>
                          <CardDescription className="text-xs">Vincule turmas aos segmentos.</CardDescription>
                        </div>
                        <Badge variant="outline" className="font-mono">{schoolClasses.length}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-muted/20 p-2 rounded-lg border">
                          <Select value={newClassSegmentId} onValueChange={setNewClassSegmentId}>
                             <SelectTrigger className="bg-background h-10"><SelectValue placeholder="Segmento..." /></SelectTrigger>
                             <SelectContent>{schoolSegments.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                          </Select>
                          <div className="flex gap-2">
                            <Input placeholder="Nome da Turma" value={newClassName ?? ""} onChange={(e) => setNewClassName(e.target.value)} className="bg-background h-10" />
                            <Input type="number" placeholder="Ordem" value={newClassOrder ?? 0} onChange={(e) => setNewClassOrder(Number(e.target.value))} className="w-16 bg-background h-10" />
                            <Button onClick={() => { if (!newClassName || !newClassSegmentId) return; addDocumentNonBlocking(collection(firestore!, 'turmas'), { nome: newClassName, segmentoId: newClassSegmentId, ordem: newClassOrder }); setNewClassName(""); setNewClassOrder(p => p + 1); }} className="h-10 px-3"><Plus size={18}/></Button>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Filtrar turmas..." className="pl-9 h-9 text-xs" value={classSearch ?? ""} onChange={(e) => setClassSearch(e.target.value)} />
                          </div>
                          <Select value={classFilterSegmentId} onValueChange={setClassFilterSegmentId}>
                             <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Filtrar Segmento" /></SelectTrigger>
                             <SelectContent>
                               <SelectItem value="all">Todos os Segmentos</SelectItem>
                               {schoolSegments.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                             </SelectContent>
                          </Select>
                        </div>

                      <ScrollArea className="h-[400px] border rounded-xl overflow-hidden shadow-inner bg-muted/5">
                        <div className="divide-y">
                          {schoolClasses.filter(t => (classFilterSegmentId === "all" || t.segmentoId === classFilterSegmentId) && (!classSearch || t.nome.toLowerCase().includes(classSearch.toLowerCase()))).map(t => (
                            <div key={t.id} className="p-4 flex justify-between items-center hover:bg-muted/30 transition-colors group">
                              <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{t.ordem}</span>
                                <div>
                                  <div className="font-bold text-sm flex items-center gap-2">
                                    {t.nome}
                                    <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-primary/10 text-primary border-none">
                                      {classCounts[t.nome] || 0} alunos
                                    </Badge>
                                  </div>
                                  <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">{schoolSegments.find(s => s.id === t.segmentoId)?.nome}</div>
                                </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEditClass(t)}><Pencil size={14}/></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteDocumentNonBlocking(doc(firestore!, 'turmas', t.id))}><Trash2 size={14}/></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card className="border-primary/20 shadow-lg bg-primary/5">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl flex items-center gap-3 text-primary">
                        <div className="bg-primary text-white p-2 rounded-lg shadow-sm"><ArrowRightLeft size={20}/></div>
                        Migração Massiva de Turmas
                      </CardTitle>
                      <CardDescription className="text-sm font-medium">Mova alunos de uma turma específica para outra.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">1. Turma de Origem</label>
                          <Select value={migrationSourceTurma} onValueChange={migrationSourceTurma => setMigrationSourceTurma(migrationSourceTurma)}>
                            <SelectTrigger className="h-11 bg-background"><SelectValue placeholder="Escolha a turma..." /></SelectTrigger>
                            <SelectContent>
                              {Array.from(new Set(allStudents.map(s => s.turma))).sort().map(t => (
                                <SelectItem key={`source-${t}`} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">2. Nova Turma</label>
                            <Select value={migrationTargetTurma} onValueChange={migrationTargetTurma => setMigrationTargetTurma(migrationTargetTurma)}>
                              <SelectTrigger className="h-11 bg-background"><SelectValue placeholder="Manter atual..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="UNCHANGED">Manter atual...</SelectItem>
                                {schoolClasses.map(t => <SelectItem key={`target-${t.id}`} value={t.nome}>{t.nome}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">3. Novo Segmento</label>
                            <Select value={migrationTargetSegmentId} onValueChange={migrationTargetSegmentId => setMigrationTargetSegmentId(migrationTargetSegmentId)}>
                              <SelectTrigger className="h-11 bg-background"><SelectValue placeholder="Manter atual..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="UNCHANGED">Manter atual...</SelectItem>
                                {schoolSegments.map(s => <SelectItem key={`target-seg-${s.id}`} value={s.id}>{s.nome}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button className="h-11 font-bold gap-2 text-md shadow-lg w-full mt-2" onClick={handleMigrateStudents} disabled={isMigrating || !migrationSourceTurma}>
                          {isMigrating ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18}/>}
                          Executar Migração por Turma
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-accent/20 shadow-lg bg-accent/5">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl flex items-center gap-3 text-accent">
                        <div className="bg-accent text-white p-2 rounded-lg shadow-sm"><TrendingUp size={20}/></div>
                        Migração de Segmento Inteiro
                      </CardTitle>
                      <CardDescription className="text-sm font-medium">Mova todos os alunos de um nível para outro.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">1. Segmento de Origem</label>
                          <Select value={migrationSourceSegName} onValueChange={migrationSourceSegName => setMigrationSourceSegName(migrationSourceSegName)}>
                            <SelectTrigger className="h-11 bg-background"><SelectValue placeholder="Escolha o segmento..." /></SelectTrigger>
                            <SelectContent>
                              {schoolSegments.map(s => <SelectItem key={`source-seg-${s.id}`} value={s.nome}>{s.nome}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">2. Segmento de Destino</label>
                          <Select value={migrationTargetSegId} onValueChange={migrationTargetSegId => setMigrationTargetSegId(migrationTargetSegId)}>
                            <SelectTrigger className="h-11 bg-background"><SelectValue placeholder="Novo segmento..." /></SelectTrigger>
                            <SelectContent>
                              {schoolSegments.map(s => <SelectItem key={`target-seg-bulk-${s.id}`} value={s.id}>{s.nome}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button className="h-11 font-bold gap-2 text-md shadow-lg w-full mt-2 bg-accent hover:bg-accent/90" onClick={handleMigrateSegment} disabled={isMigratingSeg || !migrationSourceSegName || !migrationTargetSegId}>
                          {isMigratingSeg ? <Loader2 className="animate-spin" /> : <TrendingUp size={18}/>}
                          Mover Todos do Segmento
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
               </div>
            </TabsContent>
            
            <TabsContent value="importacao" className="space-y-8">
              {/* Conteúdo de Importação permanece igual */}
              <Tabs defaultValue="excel" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-10 mb-6">
                  <TabsTrigger value="excel" className="gap-2">Excel e Fotos</TabsTrigger>
                  <TabsTrigger value="manual-json" className="gap-2 text-primary font-bold"><Code size={16}/> Activesoft (JSON Manual)</TabsTrigger>
                </TabsList>
                
                <TabsContent value="excel">
                  <BulkImportCard onImport={(newOnes) => newOnes.forEach(s => addDocumentNonBlocking(alunosCollection!, { ...s, enabled: true, visivelFila: true, ativo: true }))} models={models} />
                </TabsContent>
                
                <TabsContent value="manual-json">
                  <div className="max-w-5xl mx-auto space-y-6">
                    {previewImportList.length === 0 ? (
                      <>
                        <Alert className="bg-primary/5 border-primary/20">
                          <FileJson className="h-4 w-4 text-primary" />
                          <AlertTitle className="text-primary font-bold">Conversor Inteligente Activesoft</AlertTitle>
                          <AlertDescription className="text-xs text-muted-foreground">
                            Cole os blocos de código JSON abaixo. O sistema fará o cruzamento dos IDs e mostrará uma prévia antes de importar.
                          </AlertDescription>
                        </Alert>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">1. Lista de Alunos (results)</Label>
                            <Textarea placeholder='[{"id": 5620, "nome": "Kauê...", "matricula": "20240425"...}, ...]' className="h-48 font-mono text-[10px]" value={jsonAlunos ?? ""} onChange={(e) => setJsonAlunos(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">2. Lista de Fotos (s3)</Label>
                            <Textarea placeholder='[{"id": 5620, "s3": "https://..."}, ...]' className="h-48 font-mono text-[10px]" value={jsonFotos ?? ""} onChange={(e) => setJsonFotos(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">3. Lista de Turmas (oficial)</Label>
                            <Textarea placeholder='[{"id": 5620, "turma_oficial": "EM / 3º Ano..."}, ...]' className="h-48 font-mono text-[10px]" value={jsonTurmas ?? ""} onChange={(e) => setJsonTurmas(e.target.value)} />
                          </div>
                        </div>
                        <Button className="w-full h-12 text-lg font-bold gap-2 shadow-lg" onClick={handleAnalyzeManualJson} disabled={!jsonAlunos}><Search /> Analisar e Ver Prévia</Button>
                      </>
                    ) : (
                      <Card className="border-primary shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <CardHeader className="bg-primary/5 flex flex-row items-center justify-between border-b py-4">
                          <div className="flex items-center gap-3">
                             <div className="bg-primary text-white p-2 rounded-lg"><Users size={20}/></div>
                             <div>
                               <CardTitle className="text-lg">Revisar Importação</CardTitle>
                               <CardDescription className="text-[10px] font-bold uppercase">{selectedIndices.size} de {previewImportList.length} selecionados</CardDescription>
                             </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setPreviewImportList([])} className="text-destructive h-8 gap-1 font-bold text-[10px] uppercase"><XCircle size={14} /> Cancelar</Button>
                        </CardHeader>
                        <div className="p-4 bg-muted/20 border-b flex flex-col sm:flex-row gap-4 justify-between items-center">
                          <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Filtrar prévia..." className="pl-9 h-9 text-xs" value={previewSearchTerm ?? ""} onChange={(e) => setPreviewSearchTerm(e.target.value)} /></div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="h-8 gap-2 text-xs" onClick={() => setSelectedIndices(new Set(previewImportList.map((_, i) => i)))}><CheckSquare size={14}/> Todos</Button>
                            <Button variant="outline" size="sm" className="h-8 gap-2 text-xs" onClick={() => setSelectedIndices(new Set())}><Square size={14}/> Nenhum</Button>
                          </div>
                        </div>
                        <ScrollArea className="h-[400px]">
                          <div className="divide-y">
                            {previewImportList.filter(s => !previewSearchTerm || s.nome.toLowerCase().includes(previewSearchTerm.toLowerCase())).map((item, index) => {
                              const originalIndex = previewImportList.indexOf(item);
                              const isSelected = selectedIndices.has(originalIndex);
                              return (
                                <div key={`preview-${originalIndex}`} className={cn("p-3 flex items-center gap-4 hover:bg-muted/30 transition-colors", !isSelected && "opacity-60 grayscale")}>
                                  <Checkbox checked={isSelected} onCheckedChange={(val) => {
                                      const newSet = new Set(selectedIndices);
                                      if (val) newSet.add(originalIndex); else newSet.delete(originalIndex);
                                      setSelectedIndices(newSet);
                                    }} />
                                  <Avatar className="h-10 w-10 border"><AvatarImage src={item.fotoUrl} className="object-cover" /><AvatarFallback><UserCircle /></AvatarFallback></Avatar>
                                  <div className="flex-1 min-w-0"><p className="text-xs font-bold truncate">{item.nome}</p><p className="text-[9px] text-muted-foreground font-mono">MT: {item.matricula}</p></div>
                                  <div className="text-right shrink-0"><p className="text-[10px] font-bold text-primary">{item.turma}</p><p className="text-[9px] text-muted-foreground uppercase">{item.segmento}</p></div>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                        <CardFooter className="bg-primary/5 border-t p-6"><Button className="w-full h-14 text-xl font-bold gap-3 shadow-lg" onClick={handleManualJsonProcess} disabled={isProcessingManual || selectedIndices.size === 0}>{isProcessingManual ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={24}/>} Importar {selectedIndices.size} Alunos Agora</Button></CardFooter>
                      </Card>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="sistema" className="space-y-8">
               {/* Conteúdo de Sistema permanece igual */}
              <div className="max-w-4xl mx-auto space-y-8">
                <Card className="border-primary/20 shadow-lg">
                  <CardHeader><div className="flex items-center gap-3"><Palette className="text-primary"/><CardTitle>Identidade Visual</CardTitle></div></CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                      <div className="w-64 h-32 bg-muted/30 border rounded-xl flex items-center justify-center p-4">
                        {logoBase64 ? <img src={logoBase64} alt="Logo" className="max-w-full object-contain" style={{ height: `${logoHeight}px` }} /> : <Globe className="text-muted-foreground/20" />}
                      </div>
                      <div className="flex-1 w-full space-y-4">
                        <Input type="file" accept="image/*" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setLogoBase64(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }
                        }} />
                        <div className="space-y-2">
                           <div className="flex justify-between text-xs font-bold"><span>Altura do Logo</span><span>{logoHeight}px</span></div>
                           <Slider value={[logoHeight]} onValueChange={(val) => setLogoHeight(val[0])} min={20} max={100} step={1} />
                        </div>
                        <Button className="w-full font-bold h-11" onClick={saveVisualSettings}>Salvar Identidade</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-primary/20 shadow-lg overflow-hidden">
                  <CardHeader className="bg-primary text-white"><div className="flex items-center gap-3"><RefreshCw size={24}/><CardTitle>Integração SIGA (Activesoft)</CardTitle></div></CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2"><Label className="text-xs font-bold uppercase text-muted-foreground">URL da API do Activesoft</Label><Input placeholder="http://siga03.activesoft.com.br/api/v1/alunos/..." value={sigaUrl ?? ""} onChange={(e) => setSigaUrl(e.target.value)} /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                      <div className="space-y-2"><Label className="text-xs font-bold uppercase text-muted-foreground">Usuário do SIGA</Label><div className="relative"><Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Seu login" value={sigaUsername ?? ""} onChange={(e) => setSigaUsername(e.target.value)} className="pl-9" /></div></div>
                      <div className="space-y-2"><Label className="text-xs font-bold uppercase text-muted-foreground">Senha do SIGA</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="password" placeholder="Sua senha" value={sigaPassword ?? ""} onChange={(e) => setSigaPassword(e.target.value)} className="pl-9" /></div></div>
                    </div>
                    <div className="space-y-2 border-t pt-4"><Label className="text-xs font-bold uppercase text-muted-foreground">Token Manual (Opcional)</Label><Input type="password" placeholder="Apenas se já possuir um token" value={sigaToken ?? ""} onChange={(e) => setSigaToken(e.target.value)} /></div>
                    <Button variant="outline" className="w-full font-bold h-11 border-primary text-primary" onClick={saveVisualSettings}>Salvar Configurações de Conexão</Button>
                  </CardContent>
                </Card>

                <Card className="border-primary/20 shadow-lg">
                  <CardHeader><div className="flex items-center gap-3"><UserPlus className="text-primary"/><CardTitle>Novo Administrador do Sistema</CardTitle></div></CardHeader>
                  <CardContent>
                    <Form {...registerForm}>
                      <form onSubmit={registerForm.handleSubmit(async (data) => {
                        setIsRegisteringAdmin(true);
                        try {
                          await createUserWithEmailAndPassword(auth!, data.email, data.password);
                          toast({ title: "Admin cadastrado!" }); registerForm.reset();
                        } catch (e) { toast({ variant: "destructive", title: "Erro no cadastro" }); }
                        finally { setIsRegisteringAdmin(false); }
                      })} className="space-y-4">
                        <FormField control={registerForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>E-mail</FormLabel><FormControl><Input placeholder="admin@escola.com" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={registerForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Senha</FormLabel><FormControl><Input type="password" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={registerForm.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel>Confirmar</FormLabel><FormControl><Input type="password" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <Button type="submit" className="w-full h-11 font-bold" disabled={isRegisteringAdmin}>{isRegisteringAdmin ? <Loader2 className="animate-spin" /> : "Registrar Admin"}</Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Diálogos de Edição de Estrutura */}
      <Dialog open={isEditSegDialogOpen} onOpenChange={setIsEditSegDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Segmento</DialogTitle></DialogHeader>
          {editingSegment && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome do Segmento</Label>
                <Input value={editingSegment.nome ?? ""} onChange={(e) => setEditingSegment({...editingSegment, nome: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Ordem de Exibição</Label>
                <Input type="number" value={editingSegment.ordem ?? 0} onChange={(e) => setEditingSegment({...editingSegment, ordem: Number(e.target.value)})} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditSegDialogOpen(false)}>Cancelar</Button>
            <Button onClick={onUpdateSegment} className="gap-2"><Save size={16}/> Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditClassDialogOpen} onOpenChange={setIsEditClassDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Turma</DialogTitle></DialogHeader>
          {editingClass && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Segmento</Label>
                <Select value={editingClass.segmentoId ?? ""} onValueChange={(val) => setEditingClass({...editingClass, segmentoId: val})}>
                  <SelectTrigger><SelectValue placeholder="Selecione o segmento" /></SelectTrigger>
                  <SelectContent>{schoolSegments.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nome da Turma</Label>
                <Input value={editingClass.nome ?? ""} onChange={(e) => setEditingClass({...editingClass, nome: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Ordem de Exibição</Label>
                <Input type="number" value={editingClass.ordem ?? 0} onChange={(e) => setEditingClass({...editingClass, ordem: Number(e.target.value)})} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditClassDialogOpen(false)}>Cancelar</Button>
            <Button onClick={onUpdateClass} className="gap-2"><Save size={16}/> Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
