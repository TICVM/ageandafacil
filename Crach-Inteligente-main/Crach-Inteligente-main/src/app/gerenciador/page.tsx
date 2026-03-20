
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { type Student, type BadgeModel, type SchoolSegment, type SchoolClass } from "@/lib/types";
import { generatePdf } from "@/lib/pdf-generator";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import PageHeader from "@/components/page-header";
import CustomizeCard from "@/components/customize-card";
import StudentList from "@/components/student-list";
import StudentBadge from "@/components/student-badge";
import ModelsListCard from "@/components/models-list-card";
import AddStudentCard from "@/components/add-student-card";
import { Button } from "@/components/ui/button";
import { 
  FileDown, Printer, Loader2, ChevronLeft, ChevronRight, LayoutGrid, List, 
  Search, Filter, ListFilter, CheckSquare, Square,
  Eye, EyeOff, CheckCircle2, UserMinus, UserCheck, Settings2, Trash2
} from "lucide-react";
import { type BadgeStyleConfig, defaultBadgeStyle } from "@/lib/badge-styles";
import { useFirestore, useCollection, useMemoFirebase, useUser, useAuth } from "@/firebase";
import { deleteDocumentNonBlocking, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { collection, doc, query, orderBy, writeBatch } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function GerenciadorPage() {
  const [activeModel, setActiveModel] = useState<BadgeModel | null>(null);
  const [liveStyle, setLiveStyle] = useState<BadgeStyleConfig>(defaultBadgeStyle);
  const [liveBackground, setLiveBackground] = useState<string>(PlaceHolderImages.find(img => img.id === 'default-background')?.imageUrl || "");
  const [liveModelName, setLiveModelName] = useState("");

  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  const [viewMode, setViewMode] = useState<'table' | 'grid' | 'hidden'>('table');
  const [lastViewMode, setLastViewMode] = useState<'table' | 'grid'>('table');
  
  const [previewIndex, setPreviewIndex] = useState(0);
  
  // Estados de Filtro
  const [filterSegmentoId, setFilterSegmentoId] = useState<string | null>(null);
  const [filterTurma, setFilterTurma] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  
  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading: isAuthLoading } = useUser();

  useEffect(() => {
    setIsMounted(true);
    if (auth && !user && !isAuthLoading) {
      signInAnonymously(auth).catch((error) => console.error("Erro auth:", error));
    }
  }, [auth, user, isAuthLoading]);

  const isAdmin = user && !user.isAnonymous;

  const alunosCollection = useMemoFirebase(() => firestore && user ? collection(firestore, 'alunos') : null, [firestore, user]);
  const modelosCollection = useMemoFirebase(() => firestore && user ? collection(firestore, 'modelosCracha') : null, [firestore, user]);
  const segmentosCollection = useMemoFirebase(() => firestore && user ? query(collection(firestore, 'segmentos'), orderBy('ordem', 'asc')) : null, [firestore, user]);
  const turmasCollection = useMemoFirebase(() => firestore && user ? query(collection(firestore, 'turmas'), orderBy('ordem', 'asc')) : null, [firestore, user]);

  const { data: studentsData, isLoading: studentsLoading } = useCollection<Student>(alunosCollection);
  const { data: modelsData, isLoading: isModelsLoading } = useCollection<BadgeModel>(modelosCollection);
  const { data: segmentsData } = useCollection<SchoolSegment>(segmentosCollection);
  const { data: classesData } = useCollection<SchoolClass>(turmasCollection);
  
  const students = (studentsData || []).filter(s => s.visivelFila !== false && s.ativo !== false);
  const models = modelsData || [];
  const schoolSegments = segmentsData || [];
  const schoolClasses = classesData || [];

  const classCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach(s => {
      counts[s.turma] = (counts[s.turma] || 0) + 1;
    });
    return counts;
  }, [students]);

  const filteredStudents = useMemo(() => {
    let result = students;
    if (showOnlySelected) result = result.filter(s => s.enabled === true);
    if (filterSegmentoId) {
      const seg = schoolSegments.find(s => s.id === filterSegmentoId);
      if (seg) result = result.filter(s => s.segmento === seg.nome);
    }
    if (filterTurma) result = result.filter(s => s.turma === filterTurma);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s => s.nome.toLowerCase().includes(term));
    }
    return result;
  }, [students, filterSegmentoId, filterTurma, searchTerm, schoolSegments, showOnlySelected]);

  const selectedStudents = useMemo(() => students.filter(s => s.enabled !== false), [students]);

  useEffect(() => {
    if (!isModelsLoading && models.length > 0 && !activeModel) {
      setActiveModel(models[0]);
    }
  }, [models, isModelsLoading, activeModel]);

  useEffect(() => {
    if (activeModel) {
      setLiveStyle(activeModel.badgeStyle);
      setLiveBackground(activeModel.fundoCrachaUrl);
      setLiveModelName(activeModel.nomeModelo);
    }
  }, [activeModel]);

  const handleSaveModel = () => {
    if (!modelosCollection || !user || !firestore || !liveModelName) return;
    if (activeModel?.id) {
      updateDocumentNonBlocking(doc(firestore, 'modelosCracha', activeModel.id), {
        nomeModelo: liveModelName, fundoCrachaUrl: liveBackground, badgeStyle: liveStyle
      });
      toast({ title: "Modelo atualizado!" });
    } else {
      addDocumentNonBlocking(modelosCollection, {
        nomeModelo: liveModelName, fundoCrachaUrl: liveBackground, badgeStyle: liveStyle, userId: user.uid
      }).then(docRef => {
        if (docRef) setActiveModel({ id: docRef.id, nomeModelo: liveModelName, fundoCrachaUrl: liveBackground, badgeStyle: liveStyle });
      });
      toast({ title: "Novo modelo criado!" });
    }
  };

  const handleGeneratePdf = async () => {
    if (selectedStudents.length === 0) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione alunos para imprimir." });
      return;
    }
    setIsPdfLoading(true);
    try {
      await generatePdf(selectedStudents, liveBackground, liveStyle, models);
      toast({ title: "PDF gerado!" });
    } catch (e) { toast({ variant: "destructive", title: "Erro no PDF" }); }
    finally { setIsPdfLoading(false); }
  };

  const handleBulkToggleEnabled = async (enabled: boolean, onlySelected: boolean = false) => {
    if (filteredStudents.length === 0 || !firestore) return;
    const list = onlySelected ? selectedStudents : filteredStudents;
    const batch = writeBatch(firestore);
    list.slice(0, 500).forEach(s => batch.update(doc(firestore, 'alunos', s.id), { enabled }));
    await batch.commit();
    toast({ title: enabled ? "Seleção atualizada" : "Seleção removida" });
  };

  const handleBulkToggleVisibilidade = async (visivel: boolean, apenasSelecionados: boolean = false) => {
    if (filteredStudents.length === 0 || !firestore) return;
    const listToUpdate = apenasSelecionados ? selectedStudents : filteredStudents;

    if (listToUpdate.length === 0) {
      toast({ variant: "destructive", title: "Nenhum aluno", description: "Lista vazia para esta ação." });
      return;
    }

    const batch = writeBatch(firestore);
    listToUpdate.slice(0, 500).forEach(s => batch.update(doc(firestore, 'alunos', s.id), { visivelFila: visivel }));
    await batch.commit();
    toast({ title: visivel ? "Alunos exibidos" : "Alunos ocultos" });
  };

  const handleBulkToggleAtivo = async (ativo: boolean, apenasSelecionados: boolean = false) => {
    if (filteredStudents.length === 0 || !firestore) return;
    const listToUpdate = apenasSelecionados ? selectedStudents : filteredStudents;
    const batch = writeBatch(firestore);
    listToUpdate.slice(0, 500).forEach(s => batch.update(doc(firestore, 'alunos', s.id), { ativo }));
    await batch.commit();
    toast({ title: ativo ? "Alunos reativados" : "Alunos transferidos" });
  };

  const previewList = selectedStudents.length > 0 ? selectedStudents : filteredStudents;
  const currentPreviewStudent = previewList.length > 0 ? previewList[previewIndex % previewList.length] : {
    id: "preview", nome: "NOME DO ALUNO", segmento: "SEGMENTO", turma: "TURMA",
    fotoUrl: PlaceHolderImages.find(i => i.id === 'avatar-placeholder')?.imageUrl || "",
    enabled: true, visivelFila: true, ativo: true
  };
  
  const isLoading = !isMounted || isAuthLoading || isModelsLoading;

  const toggleVisibility = () => {
    if (viewMode === 'hidden') {
      setViewMode(lastViewMode);
    } else {
      setLastViewMode(viewMode);
      setViewMode('hidden');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader />
      <main className="container mx-auto p-4 md:p-8 no-print">
        {isLoading ? (
            <div className="flex flex-col justify-center items-center h-96 gap-4">
                <Loader2 className="animate-spin h-12 w-12 text-primary" />
                <p className="text-muted-foreground">Sincronizando fila...</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 flex flex-col gap-8 no-print">
                <AddStudentCard 
                  onAddStudent={(s) => addDocumentNonBlocking(alunosCollection!, { ...s, enabled: true, visivelFila: true, ativo: true })} 
                  models={models} 
                  activeModelId={activeModel?.id} 
                  students={students} 
                  segments={schoolSegments} 
                  classes={schoolClasses} 
                />
                
                <ModelsListCard 
                  models={models} 
                  activeModelId={activeModel?.id} 
                  onSelect={setActiveModel} 
                  onDelete={id => deleteDocumentNonBlocking(doc(firestore!, 'modelosCracha', id))} 
                  onDuplicate={m => addDocumentNonBlocking(modelosCollection!, { ...m, nomeModelo: `${m.nomeModelo} (Cópia)`, userId: user!.uid })} 
                />

                {isAdmin && (
                  <CustomizeCard 
                    modelName={liveModelName} 
                    setModelName={setLiveModelName} 
                    background={liveBackground} 
                    setBackground={setLiveBackground} 
                    badgeStyle={liveStyle} 
                    setBadgeStyle={setLiveStyle} 
                    onSave={handleSaveModel} 
                    onNew={() => setActiveModel(null)} 
                    isEdit={!!activeModel} 
                  />
                )}
              </div>

              <div className="lg:col-span-2 flex flex-col gap-8">
                <div className="bg-primary/5 p-6 rounded-lg shadow-sm border border-primary/20">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-primary">Fila de Impressão</h2>
                    <span className="text-sm font-bold bg-primary/10 px-3 py-1 rounded-full text-primary">
                      {selectedStudents.length} crachás para gerar
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                     <Button className="flex-1 h-12 text-lg" onClick={handleGeneratePdf} disabled={isPdfLoading || selectedStudents.length === 0}>
                      {isPdfLoading ? <Loader2 className="animate-spin mr-2" /> : <FileDown className="mr-2" />} Gerar PDF
                    </Button>
                    <Button variant="outline" className="flex-1 h-12 text-lg" onClick={() => window.print()} disabled={selectedStudents.length === 0}><Printer className="mr-2" /> Imprimir A4</Button>
                  </div>
                </div>

                <div className="bg-card p-6 rounded-lg shadow-sm border">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-primary">Prévia do Design</h2>
                      {previewList.length > 1 && (
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setPreviewIndex(i => (i - 1 + previewList.length) % previewList.length)}><ChevronLeft /></Button>
                          <span className="text-sm font-medium">{previewIndex + 1} / {previewList.length}</span>
                          <Button variant="ghost" size="icon" onClick={() => setPreviewIndex(i => (i + 1) % previewList.length)}><ChevronRight /></Button>
                        </div>
                      )}
                    </div>
                    <div className="max-w-md mx-auto">
                        <StudentBadge student={currentPreviewStudent as Student} background={activeModel?.fundoCrachaUrl || liveBackground} styles={activeModel?.badgeStyle || liveStyle} />
                    </div>
                </div>

                <div className="bg-card rounded-xl shadow-md border overflow-hidden">
                    <div className="p-6 space-y-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-2">
                            <ListFilter className="text-primary" size={24} />
                            <h2 className="text-2xl font-bold text-primary">Controle de Fluxo</h2>
                        </div>
                        
                        <div className="flex items-center gap-0.5 bg-muted/60 p-1 rounded-md border shadow-sm">
                          <Button 
                            variant={viewMode === 'hidden' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={toggleVisibility}
                          >
                            {viewMode === 'hidden' ? <Eye size={16} /> : <EyeOff size={16} />}
                          </Button>
                          <div className="w-[1px] h-4 bg-muted-foreground/20 mx-1.5" />
                          <Button 
                            variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className={cn("h-8 gap-2 text-xs px-3 font-medium", viewMode === 'table' && "bg-background shadow-sm")}
                            onClick={() => { setViewMode('table'); setLastViewMode('table'); }}
                          >
                            <List size={14} /> Tabela
                          </Button>
                          <Button 
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className={cn("h-8 gap-2 text-xs px-3 font-medium", viewMode === 'grid' && "bg-background shadow-sm")}
                            onClick={() => { setViewMode('grid'); setLastViewMode('grid'); }}
                          >
                            <LayoutGrid size={14} /> Grade
                          </Button>
                        </div>
                      </div>

                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Buscar por nome..." 
                          className="pl-9 h-11 bg-muted/20" 
                          value={searchTerm ?? ""} 
                          onChange={(e) => setSearchTerm(e.target.value)} 
                        />
                      </div>

                      <div className="bg-muted/30 rounded-xl p-1 border">
                        <Tabs defaultValue="filtros" className="w-full">
                          <TabsList className="grid w-full grid-cols-2 h-12 bg-transparent">
                            <TabsTrigger value="filtros" className="data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold text-[10px] uppercase tracking-widest">Filtros</TabsTrigger>
                            <TabsTrigger value="lote" className="data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold text-[10px] uppercase tracking-widest">Ações em Lote</TabsTrigger>
                          </TabsList>

                          <TabsContent value="filtros" className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               <div className="space-y-2">
                                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Segmento</label>
                                  <Select value={filterSegmentoId || "all"} onValueChange={(val) => { setFilterSegmentoId(val === "all" ? null : val); setFilterTurma(null); }}>
                                    <SelectTrigger className="h-10 bg-background"><SelectValue placeholder="Todos" /></SelectTrigger>
                                    <SelectContent><SelectItem value="all">Todos os Segmentos</SelectItem>{schoolSegments.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                                  </Select>
                               </div>
                               <div className="space-y-2">
                                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Turma</label>
                                  <Select value={filterTurma || "all"} onValueChange={setFilterTurma}>
                                    <SelectTrigger className="h-10 bg-background"><SelectValue placeholder="Todas" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">Todas as Turmas</SelectItem>
                                      {schoolClasses.filter(c => !filterSegmentoId || c.segmentoId === filterSegmentoId).map(t => (
                                        <SelectItem key={t.id} value={t.nome}>
                                          {t.nome} ({classCounts[t.nome] || 0})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                               </div>
                             </div>
                             <Button 
                                variant="outline" 
                                className={cn("w-full h-10 gap-2 font-bold text-xs transition-all", showOnlySelected ? "bg-primary/10 text-primary border-primary/30" : "bg-background text-muted-foreground")}
                                onClick={() => setShowOnlySelected(!showOnlySelected)}
                              >
                                {showOnlySelected ? <CheckCircle2 size={16} /> : <Filter size={16} />}
                                {showOnlySelected ? "Mostrando apenas selecionados para impressão" : "Mostrar todos na fila atual"}
                              </Button>
                          </TabsContent>

                          <TabsContent value="lote" className="p-4 space-y-6 animate-in fade-in slide-in-from-top-1 duration-200">
                             <div className="space-y-3">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block border-b pb-2">Ações para todos filtrados ({filteredStudents.length})</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <Button variant="outline" className="h-10 justify-start gap-3 text-xs bg-background" onClick={() => handleBulkToggleEnabled(true)}>
                                    <CheckSquare size={16} className="text-primary"/> Selecionar Todos p/ Impressão
                                  </Button>
                                  <Button variant="outline" className="h-10 justify-start gap-3 text-xs bg-background" onClick={() => handleBulkToggleEnabled(false)}>
                                    <Square size={16} className="text-muted-foreground"/> Deselecionar Todos p/ Impressão
                                  </Button>
                                  <Button variant="outline" className="h-10 justify-start gap-3 text-xs bg-background" onClick={() => handleBulkToggleVisibilidade(true)}>
                                    <Eye size={16} className="text-primary"/> Habilitar Todos na Fila
                                  </Button>
                                  <Button variant="outline" className="h-10 justify-start gap-3 text-xs bg-background" onClick={() => handleBulkToggleVisibilidade(false)}>
                                    <EyeOff size={16} className="text-muted-foreground"/> Ocultar Todos da Fila
                                  </Button>
                                  <Button variant="outline" className="h-10 justify-start gap-3 text-xs bg-orange-50/50 text-orange-600 border-orange-200 hover:bg-orange-100" onClick={() => handleBulkToggleAtivo(false)}>
                                    <UserMinus size={16}/> Transferir Todos Filtrados
                                  </Button>
                                  <Button variant="outline" className="h-10 justify-start gap-3 text-xs bg-green-50/50 text-green-600 border-green-200 hover:bg-green-100" onClick={() => handleBulkToggleAtivo(true)}>
                                    <UserCheck size={16}/> Reativar Todos Filtrados
                                  </Button>
                                </div>
                             </div>

                             <div className="space-y-3">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block border-b pb-2">Ações para selecionados ({selectedStudents.length})</span>
                                <div className="flex flex-col gap-2">
                                  <Button variant="outline" className="h-10 justify-start gap-3 text-xs bg-background" onClick={() => handleBulkToggleVisibilidade(true, true)}>
                                    <Eye size={16} className="text-primary"/> Mostrar Selecionados na Fila
                                  </Button>
                                  <Button variant="outline" className="h-10 justify-start gap-3 text-xs bg-background" onClick={() => handleBulkToggleVisibilidade(false, true)}>
                                    <EyeOff size={16} className="text-muted-foreground"/> Ocultar Selecionados da Fila
                                  </Button>
                                  <Button variant="outline" className="h-10 justify-start gap-3 text-xs bg-orange-50/50 text-orange-600 border-orange-200 hover:bg-orange-100" onClick={() => handleBulkToggleAtivo(false, true)}>
                                    <UserMinus size={16}/> Transferir Selecionados
                                  </Button>
                                  <Button variant="outline" className="h-10 justify-start gap-3 text-xs bg-green-50/50 text-green-600 border-green-200 hover:bg-green-100" onClick={() => handleBulkToggleAtivo(true, true)}>
                                    <UserCheck size={16}/> Reativar Selecionados
                                  </Button>
                                </div>
                             </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </div>

                    {viewMode !== 'hidden' && (
                      <div className="border-t">
                        <StudentList 
                          students={filteredStudents} 
                          models={models} 
                          allStudents={students} 
                          onUpdate={(s) => updateDocumentNonBlocking(doc(firestore!, 'alunos', s.id), s)} 
                          onDelete={(id) => deleteDocumentNonBlocking(doc(firestore!, 'alunos', id))} 
                          viewMode={viewMode === 'hidden' ? 'table' : viewMode} 
                          segments={schoolSegments} 
                          classes={schoolClasses}
                          currentLiveBackground={activeModel?.fundoCrachaUrl || liveBackground}
                          currentLiveStyle={activeModel?.badgeStyle || liveStyle}
                        />
                      </div>
                    )}
                </div>
              </div>
            </div>
        )}
      </main>
      
      <div id="printable-area">
          <div className="print-grid">
          {selectedStudents.map((student) => {
              const studentModel = models.find(m => m.id === student.modeloId) || activeModel;
              return (
                <div key={`print-${student.id}`} className="print-item">
                    <StudentBadge student={student} background={studentModel?.fundoCrachaUrl || liveBackground} styles={studentModel?.badgeStyle || liveStyle} />
                </div>
              );
          })}
          </div>
      </div>
    </div>
  );
}
