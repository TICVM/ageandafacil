"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useFirestore, useCollection, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { type Student, type SchoolSegment, type SchoolClass } from "@/lib/types";
import PageHeader from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Search, 
  Users, 
  FilterX, 
  Loader2, 
  LayoutGrid,
  UserCircle,
  ListFilter,
  Layers,
  Camera,
  ScanFace,
  RefreshCw,
  UserCheck,
  ChevronRight,
  List,
  Filter
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { identifyStudent } from "@/ai/flows/identify-student-flow";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import StudentList from "@/components/student-list";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function HomePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSegmentoId, setFilterSegmentoId] = useState<string | null>(null);
  const [filterTurma, setFilterTurma] = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState("carometro");
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Estados Camera/Reconhecimento
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identifiedStudent, setIdentifiedStudent] = useState<Student | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  const firestore = useFirestore();
  const { user } = useUser();

  const alunosCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'alunos');
  }, [firestore, user]);

  const segmentosCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'segmentos'), orderBy('ordem', 'asc'));
  }, [firestore, user]);

  const turmasCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'turmas'), orderBy('ordem', 'asc'));
  }, [firestore, user]);

  const { data: studentsData, isLoading } = useCollection<Student>(alunosCollection);
  const { data: segmentsData } = useCollection<SchoolSegment>(segmentosCollection);
  const { data: classesData } = useCollection<SchoolClass>(turmasCollection);

  const students = (studentsData || []).filter(s => s.ativo !== false);
  const schoolSegments = segmentsData || [];
  const schoolClasses = classesData || [];

  const classCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach(s => {
      counts[s.turma] = (counts[s.turma] || 0) + 1;
    });
    return counts;
  }, [students]);

  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach(s => {
      counts[s.segmento] = (counts[s.segmento] || 0) + 1;
    });
    return counts;
  }, [students]);

  const filteredStudents = useMemo(() => {
    let result = [...students];
    if (filterSegmentoId) {
      const seg = schoolSegments.find(s => s.id === filterSegmentoId);
      if (seg) result = result.filter(s => s.segmento === seg.nome);
    }
    if (filterTurma) {
      result = result.filter(s => s.turma === filterTurma);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s => s.nome.toLowerCase().includes(term));
    }
    return result.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [students, filterSegmentoId, filterTurma, searchTerm, schoolSegments]);

  // Lógica de Câmera
  const startCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
    } catch (error) {
      console.error('Erro ao acessar camera:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Câmera Bloqueada',
        description: 'Por favor, permita o acesso à câmera nas configurações do navegador.',
      });
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleCaptureAndIdentify = async () => {
    if (!videoRef.current || students.length === 0) {
      toast({ variant: "destructive", title: "Câmera não pronta", description: "Aguarde a inicialização da câmera." });
      return;
    }
    
    setIsIdentifying(true);
    setIdentifiedStudent(null);
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas context error");
      
      ctx.drawImage(videoRef.current, 0, 0);
      const photoDataUri = canvas.toDataURL('image/jpeg', 0.8);

      // Pegamos candidatos que possuem foto base64 (o fluxo de IA requer fotos locais/base64 para processar o media part)
      // Priorizamos os filtrados, senão pegamos os primeiros da lista geral
      const candidatesList = filteredStudents.length > 0 ? filteredStudents : students;
      const candidates = candidatesList
        .filter(s => !!s.fotoUrl && s.fotoUrl.startsWith('data:'))
        .slice(0, 20)
        .map(s => ({
          id: s.id,
          nome: s.nome,
          fotoUrl: s.fotoUrl
        }));

      if (candidates.length === 0) {
        toast({ variant: "destructive", title: "Sem dados", description: "Não há alunos com fotos de referência para comparar." });
        setIsIdentifying(false);
        return;
      }

      const result = await identifyStudent({ photoDataUri, candidates });

      if (result.studentId) {
        const found = students.find(s => s.id === result.studentId);
        if (found) {
          setIdentifiedStudent(found);
          toast({ title: "Aluno Identificado!", description: `Identificado como ${found.nome}` });
        }
      } else {
        toast({ 
          variant: "destructive", 
          title: "Não Identificado", 
          description: "Nenhum aluno correspondente encontrado no banco de dados." 
        });
      }
    } catch (error) {
      console.error("Erro no reconhecimento:", error);
      toast({ variant: "destructive", title: "Erro na IA", description: "Falha ao processar a identificação facial." });
    } finally {
      setIsIdentifying(false);
    }
  };

  useEffect(() => {
    if (activeMainTab === "facial") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeMainTab]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader />
      
      <main className="container mx-auto p-4 md:p-8">
        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-primary flex items-center gap-2">
                <Users className="h-8 w-8" />
                Portal do Aluno
              </h2>
              <p className="text-muted-foreground">Sistema de identificação e visualização estudantil.</p>
            </div>
            
            <TabsList className="bg-muted/50 border shadow-sm h-11">
              <TabsTrigger value="carometro" className="gap-2 px-6">
                <LayoutGrid size={16} /> Carômetro
              </TabsTrigger>
              <TabsTrigger value="facial" className="gap-2 px-6">
                <ScanFace size={16} /> Busca Facial
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="carometro" className="space-y-6">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar aluno por nome..." 
                    className="pl-10 h-12 text-lg shadow-sm bg-card"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border shadow-sm">
                  <Button 
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className={cn("h-10 gap-2 px-4 font-bold text-xs", viewMode === 'grid' && "bg-background shadow-sm")}
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGrid size={16} /> Grade
                  </Button>
                  <Button 
                    variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className={cn("h-10 gap-2 px-4 font-bold text-xs", viewMode === 'table' && "bg-background shadow-sm")}
                    onClick={() => setViewMode('table')}
                  >
                    <List size={16} /> Lista
                  </Button>
                </div>
              </div>

              <div className="bg-card p-6 rounded-xl border shadow-sm space-y-8">
                {/* Filtros Duplos: Lista (Dropdown) e Botões (Pills) */}
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2 tracking-widest">
                        <ListFilter size={12} className="text-primary" /> Filtrar por Segmento (Lista)
                      </label>
                      <Select 
                        value={filterSegmentoId || "all"} 
                        onValueChange={(val) => { 
                          setFilterSegmentoId(val === "all" ? null : val); 
                          setFilterTurma(null); 
                        }}
                      >
                        <SelectTrigger className="h-11"><SelectValue placeholder="Selecione o segmento" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os Segmentos ({students.length})</SelectItem>
                          {schoolSegments.map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.nome} ({segmentCounts[s.nome] || 0})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2 tracking-widest">
                        <Filter size={12} className="text-primary" /> Filtrar por Turma (Lista)
                      </label>
                      <Select 
                        value={filterTurma || "all"} 
                        onValueChange={(val) => setFilterTurma(val === "all" ? null : val)}
                      >
                        <SelectTrigger className="h-11"><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as Turmas</SelectItem>
                          {schoolClasses
                            .filter(c => !filterSegmentoId || c.segmentoId === filterSegmentoId)
                            .map(t => (
                              <SelectItem key={t.id} value={t.nome}>
                                {t.nome} ({classCounts[t.nome] || 0})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t">
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
                            "rounded-full h-9 px-6 text-xs font-bold transition-all shadow-sm",
                            filterSegmentoId === null ? "shadow-primary/20" : "bg-background"
                          )}
                        >
                          Todos
                        </Button>
                        {schoolSegments.map((seg) => (
                          <Button 
                            key={seg.id}
                            variant={filterSegmentoId === seg.id ? "default" : "outline"} 
                            size="sm" 
                            onClick={() => { setFilterSegmentoId(seg.id); setFilterTurma(null); }}
                            className={cn(
                              "rounded-full h-9 px-6 text-xs font-bold whitespace-nowrap transition-all shadow-sm",
                              filterSegmentoId === seg.id ? "shadow-primary/20" : "bg-background"
                            )}
                          >
                            {seg.nome} 
                            <span className={cn(
                              "ml-2 text-[10px] opacity-70",
                              filterSegmentoId === seg.id ? "text-white" : "text-primary"
                            )}>
                              ({segmentCounts[seg.nome] || 0})
                            </span>
                          </Button>
                        ))}
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </div>

                  {filterSegmentoId && (
                    <div className="space-y-3 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1 tracking-widest">
                        <LayoutGrid size={12} className="text-primary" /> Atalhos por Turma (Botões)
                      </label>
                      <ScrollArea className="w-full pb-2">
                        <div className="flex gap-2">
                          <Button 
                            variant={filterTurma === null ? "secondary" : "ghost"} 
                            size="sm" 
                            onClick={() => setFilterTurma(null)}
                            className="rounded-full h-8 px-4 text-xs font-medium border"
                          >
                            Todas as Turmas
                          </Button>
                          {schoolClasses
                            .filter(c => c.segmentoId === filterSegmentoId)
                            .map((turma) => (
                              <Button 
                                key={turma.id}
                                variant={filterTurma === turma.nome ? "secondary" : "ghost"} 
                                size="sm" 
                                onClick={() => setFilterTurma(turma.nome)}
                                className={cn(
                                  "rounded-full h-8 px-4 text-xs font-medium border",
                                  filterTurma === turma.nome && "bg-primary/10 text-primary border-primary/20"
                                )}
                              >
                                {turma.nome}
                                <span className="ml-2 text-[10px] opacity-60">({classCounts[turma.nome] || 0})</span>
                              </Button>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Sincronizando portal...</p>
              </div>
            ) : filteredStudents.length > 0 ? (
              viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                  {filteredStudents.map((student) => (
                    <Card key={student.id} className="overflow-hidden group hover:shadow-xl transition-all border-2 hover:border-primary/50 relative">
                      <CardContent className="p-0">
                        <div className="aspect-[3/4] relative bg-muted overflow-hidden">
                          {student.fotoUrl ? (
                            <img src={student.fotoUrl} alt={student.nome} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <UserCircle className="h-12 w-12 text-muted-foreground/30" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-3">
                             <Button variant="secondary" size="sm" className="h-7 text-[10px] font-bold w-full gap-1" onClick={() => {
                               toast({ title: student.nome, description: `${student.segmento} - ${student.turma}` });
                             }}>
                               Ver Detalhes <ChevronRight size={10} />
                             </Button>
                          </div>
                        </div>
                        <div className="p-3 text-center bg-card flex flex-col gap-1 min-h-[70px] justify-center border-t">
                          <p className="text-[11px] font-bold uppercase leading-tight whitespace-pre-wrap truncate" title={student.nome}>
                            {student.nome}
                          </p>
                          <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest bg-muted/50 rounded-full px-2 py-0.5 inline-block mx-auto">
                            {student.turma}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="shadow-sm overflow-hidden">
                  <StudentList 
                    students={filteredStudents} 
                    models={[]} 
                    allStudents={students} 
                    onUpdate={() => {}} 
                    onDelete={() => {}} 
                    viewMode="table" 
                    segments={schoolSegments} 
                    classes={schoolClasses} 
                  />
                </Card>
              )
            ) : (
              <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
                <FilterX className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                <p className="text-muted-foreground font-medium">Nenhum aluno encontrado para os filtros.</p>
                <Button variant="link" onClick={() => { setFilterSegmentoId(null); setFilterTurma(null); setSearchTerm(""); }} className="mt-2">Limpar todos os filtros</Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="facial" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="border-2 border-primary/20 shadow-xl overflow-hidden">
                <CardHeader className="bg-primary text-white py-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Camera size={20} />
                    Identificação Facial
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 bg-black relative aspect-video flex items-center justify-center overflow-hidden">
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                  
                  {isIdentifying && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4 z-10">
                      <div className="relative">
                        <ScanFace className="h-16 w-16 text-primary animate-pulse" />
                        <Loader2 className="h-20 w-20 text-primary animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50" />
                      </div>
                      <p className="text-white font-bold text-sm tracking-widest uppercase animate-pulse">Cruzando Dados...</p>
                    </div>
                  )}

                  {hasCameraPermission === false && (
                    <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                      <Alert variant="destructive">
                        <AlertTitle>Câmera Indisponível</AlertTitle>
                        <AlertDescription>Habilite a câmera nas permissões do seu navegador para usar esta função.</AlertDescription>
                      </Alert>
                    </div>
                  )}

                  <div className="absolute inset-0 pointer-events-none border-[30px] border-transparent">
                     <div className="w-full h-full border-2 border-primary/40 rounded-3xl relative">
                        <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-2xl"></div>
                        <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-2xl"></div>
                        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-2xl"></div>
                        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-2xl"></div>
                     </div>
                  </div>
                </CardContent>
                <div className="p-4 bg-muted/30 border-t flex flex-col gap-4">
                  <Button 
                    className="w-full h-14 text-xl font-bold gap-3 shadow-lg" 
                    onClick={handleCaptureAndIdentify}
                    disabled={isIdentifying || hasCameraPermission === false}
                  >
                    {isIdentifying ? <Loader2 className="animate-spin" /> : <ScanFace size={24} />}
                    Identificar Aluno
                  </Button>
                  <Button variant="outline" className="h-10 w-full gap-2 text-xs font-bold" onClick={startCamera}>
                    <RefreshCw size={14} /> Reiniciar Câmera
                  </Button>
                </div>
              </Card>

              <div className="space-y-6">
                <Card className={cn(
                  "border-2 transition-all duration-700 min-h-[450px] flex flex-col",
                  identifiedStudent ? "border-green-500 shadow-green-100 shadow-2xl bg-green-50/10" : "border-dashed border-muted-foreground/30 bg-muted/5"
                )}>
                  <CardHeader className={cn(
                    "py-4 border-b",
                    identifiedStudent ? "bg-green-500 text-white" : "bg-muted/50"
                  )}>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {identifiedStudent ? <UserCheck /> : <UserCircle />}
                      {identifiedStudent ? "Correspondência Encontrada!" : "Aguardando Captura"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    {identifiedStudent ? (
                      <div className="animate-in zoom-in-95 duration-500 space-y-6 w-full">
                        <div className="relative mx-auto w-44 h-56 rounded-2xl overflow-hidden border-4 border-white shadow-2xl bg-white">
                          <img src={identifiedStudent.fotoUrl} className="w-full h-full object-cover" alt={identifiedStudent.nome} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-center p-3">
                             <Badge className="bg-green-500 hover:bg-green-600 border-none shadow-sm">VERIFICADO</Badge>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <h3 className="text-2xl font-black text-primary uppercase tracking-tight leading-tight">{identifiedStudent.nome}</h3>
                          <div className="flex flex-wrap items-center justify-center gap-2">
                             <Badge variant="secondary" className="px-4 py-1.5 font-bold bg-white border text-primary">{identifiedStudent.segmento}</Badge>
                             <Badge variant="outline" className="px-4 py-1.5 font-bold border-primary text-primary bg-primary/5">{identifiedStudent.turma}</Badge>
                          </div>
                          <div className="pt-4 flex flex-col items-center">
                            <span className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Registro Acadêmico</span>
                            <span className="text-lg font-mono font-bold text-muted-foreground">{identifiedStudent.matricula}</span>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          className="w-full mt-6 border-green-500 text-green-700 font-bold hover:bg-green-100/50"
                          onClick={() => setIdentifiedStudent(null)}
                        >
                          Limpar e Nova Identificação
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-6 opacity-40">
                        <div className="bg-muted p-8 rounded-full inline-block">
                           <ScanFace size={64} className="text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xl font-black text-muted-foreground uppercase tracking-widest">Biometria Facial</p>
                          <p className="text-sm text-muted-foreground mt-2 font-medium">Posicione o aluno no centro da moldura e clique no botão azul.</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Alert className="bg-primary/10 border-primary/20 shadow-sm">
                  <ScanFace className="h-5 w-5 text-primary" />
                  <AlertTitle className="text-primary font-bold">Dica para Melhor Identificação</AlertTitle>
                  <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
                    A IA funciona melhor se você filtrar o <strong>Segmento</strong> ou <strong>Turma</strong> no Carômetro antes de iniciar a busca facial. Isso reduz o campo de busca e aumenta a precisão.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
