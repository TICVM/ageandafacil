
"use client";

import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { type Student, type BadgeModel, type SchoolSegment, type SchoolClass } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Loader2, Plus, Sparkles, Hash, Camera, Link as LinkIcon, Upload, Trash2 } from "lucide-react";
import React, { useEffect, useState, useMemo, useRef } from "react";
import { compressImage } from "@/lib/image-utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AddStudentCardProps {
  onAddStudent: (student: Omit<Student, "id">) => void;
  models: BadgeModel[];
  activeModelId?: string;
  students: Student[];
  segments?: SchoolSegment[];
  classes?: SchoolClass[];
}

export default function AddStudentCard({ 
  onAddStudent, 
  models, 
  activeModelId, 
  students,
  segments = [],
  classes = []
}: AddStudentCardProps) {
  const { toast } = useToast();
  const [showNewSegmentoInput, setShowNewSegmentoInput] = useState(false);
  const [showNewTurmaInput, setShowNewTurmaInput] = useState(false);
  
  // Camera states
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [linkInput, setLinkInput] = useState("");
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  const formSchema = z.object({
    nome: z.string().min(2, "O nome deve ter pelo menos 2 caracteres."),
    matricula: z.string().min(1, "A matrícula é obrigatória."),
    segmento: z.string().min(1, "O segmento é obrigatório."),
    turma: z.string().min(1, "A turma é obrigatória."),
    fotoUrl: z.string().min(1, "A foto é obrigatória."),
    modeloId: z.string().optional(),
  }).refine((data) => {
    const exists = students.some(s => s.matricula === data.matricula);
    return !exists;
  }, {
    message: "Esta matrícula já está cadastrada para outro aluno.",
    path: ["matricula"],
  });
  
  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      matricula: "",
      segmento: "",
      turma: "",
      fotoUrl: "",
      modeloId: activeModelId || "",
    },
  });

  const selectedSegmentoName = form.watch("segmento");
  const typedTurma = form.watch("turma");
  const currentFotoUrl = form.watch("fotoUrl");

  // Encontrar ID do segmento selecionado pelo nome para filtrar turmas
  const selectedSegmentoId = useMemo(() => {
    return segments.find(s => s.nome === selectedSegmentoName)?.id;
  }, [segments, selectedSegmentoName]);

  const availableTurmas = useMemo(() => {
    if (!selectedSegmentoId && segments.length > 0) return [];
    if (classes.length > 0) {
      return classes.filter(c => !selectedSegmentoId || c.segmentoId === selectedSegmentoId);
    }
    // Fallback para dados existentes nos alunos se a estrutura estiver vazia
    const set = new Set(
      students
        .filter(s => !selectedSegmentoName || s.segmento === selectedSegmentoName)
        .map(s => s.turma)
        .filter(Boolean)
    );
    return Array.from(set).sort().map(name => ({ id: name, nome: name }));
  }, [classes, students, selectedSegmentoId, selectedSegmentoName, segments]);

  const availableSegments = useMemo(() => {
    if (segments.length > 0) return segments;
    // Fallback
    const set = new Set(students.map(s => s.segmento).filter(Boolean));
    return Array.from(set).sort().map(name => ({ id: name, nome: name }));
  }, [segments, students]);

  useEffect(() => {
    if (!typedTurma) return;
    const t = typedTurma.toLowerCase();
    let suggestedSeg = "";
    if (t.includes("2º") || t.includes("3º") || t.includes("4º") || t.includes("5º")) {
      suggestedSeg = "Ensino Fundamental I";
    } else if (t.includes("6º") || t.includes("7º") || t.includes("8º") || t.includes("9º")) {
      suggestedSeg = "Ensino Fundamental II";
    }
    if (suggestedSeg && !selectedSegmentoName && availableSegments.some(s => s.nome === suggestedSeg)) {
      form.setValue("segmento", suggestedSeg);
    }
  }, [typedTurma, selectedSegmentoName, form, availableSegments]);

  useEffect(() => {
    if (activeModelId) {
      form.setValue('modeloId', activeModelId);
    }
  }, [activeModelId, form]);

  useEffect(() => {
    if (availableSegments.length === 0) setShowNewSegmentoInput(true);
  }, [availableSegments]);

  // Camera initialization
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Acesso à Câmera Negado',
        description: 'Por favor, habilite as permissões de câmera no seu navegador.',
      });
    }
  };

  const capturePhoto = async () => {
    if (videoRef.current) {
      setIsProcessingPhoto(true);
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const optimized = await compressImage(dataUrl);
        form.setValue('fotoUrl', optimized);
        
        // Stop camera
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
      }
      setIsProcessingPhoto(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingPhoto(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const optimized = await compressImage(event.target?.result as string);
        form.setValue('fotoUrl', optimized);
        setIsProcessingPhoto(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLinkUpload = async () => {
    if (!linkInput) return;
    setIsProcessingPhoto(true);
    
    // Tenta primeiro baixar e comprimir
    try {
      const response = await fetch(linkInput, { mode: 'cors' });
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const optimized = await compressImage(reader.result as string);
        form.setValue('fotoUrl', optimized);
        setLinkInput("");
        setIsProcessingPhoto(false);
        toast({ title: "Foto carregada do link!" });
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      // Fallback: Se der erro de CORS, tentamos apenas usar a URL direta
      // Verificamos se a URL parece uma imagem
      const img = new Image();
      img.onload = () => {
        form.setValue('fotoUrl', linkInput);
        setLinkInput("");
        setIsProcessingPhoto(false);
        toast({ title: "Link aceito!", description: "A imagem será carregada diretamente da fonte externa." });
      };
      img.onerror = () => {
        setIsProcessingPhoto(false);
        toast({
          variant: 'destructive',
          title: 'Link Inválido',
          description: 'Não foi possível carregar a imagem deste link.',
        });
      };
      img.src = linkInput;
    }
  };

  const onSubmit: SubmitHandler<FormValues> = (data) => {
    onAddStudent({ 
      nome: data.nome,
      matricula: data.matricula,
      segmento: data.segmento,
      turma: data.turma, 
      fotoUrl: data.fotoUrl,
      modeloId: data.modeloId || "",
      enabled: true,
      ativo: true
    });
    
    form.reset({
        nome: "",
        matricula: "",
        segmento: data.segmento,
        turma: "",
        fotoUrl: "",
        modeloId: activeModelId || "",
    });
    
    toast({ title: "Aluno registrado!" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <UserPlus />
          Novo Aluno
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl><Input placeholder="Nome do aluno" {...field} value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="matricula"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nº Matrícula (Individual)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Número único" className="pl-9" {...field} value={field.value || ""} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="segmento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Segmento</FormLabel>
                  {!showNewSegmentoInput && availableSegments.length > 0 ? (
                    <Select onValueChange={(val) => val === "NEW_SEGMENTO" ? setShowNewSegmentoInput(true) : field.onChange(val)} value={field.value || ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione o segmento" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {availableSegments.map(s => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}
                        <SelectItem value="NEW_SEGMENTO" className="font-bold text-primary"><Plus size={14} className="inline mr-2" /> Novo Segmento...</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <FormControl><Input placeholder="Ex: Fundamental I" {...field} value={field.value || ""} /></FormControl>
                      {availableSegments.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewSegmentoInput(false)}>Voltar</Button>}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="turma"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center">
                    <FormLabel>Turma</FormLabel>
                    {typedTurma && typedTurma.length > 1 && (
                      <span className="text-[9px] text-primary flex items-center gap-1 animate-pulse"><Sparkles size={8}/> Auto-sugestão ativa</span>
                    )}
                  </div>
                  {!showNewTurmaInput && availableTurmas.length > 0 ? (
                    <Select onValueChange={(val) => val === "NEW_TURMA" ? setShowNewTurmaInput(true) : field.onChange(val)} value={field.value || ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {availableTurmas.map(t => <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>)}
                        <SelectItem value="NEW_TURMA" className="font-bold text-primary"><Plus size={14} className="inline mr-2" /> Nova Turma...</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <FormControl><Input placeholder="Ex: 2º ano A" {...field} value={field.value || ""} /></FormControl>
                      {(availableTurmas.length > 0 || (selectedSegmentoName && students.length > 0)) && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewTurmaInput(false)}>Lista</Button>
                      )}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="modeloId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo de Crachá</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Escolha um design" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {models.map(m => <SelectItem key={m.id} value={m.id}>{m.nomeModelo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Foto do Aluno</FormLabel>
              {currentFotoUrl ? (
                <div className="relative aspect-square w-full rounded-md overflow-hidden border">
                  <img src={currentFotoUrl} className="w-full h-full object-cover" alt="Preview" />
                  <Button 
                    type="button" 
                    variant="destructive" 
                    size="icon" 
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={() => form.setValue('fotoUrl', '')}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ) : (
                <Tabs defaultValue="file" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-2">
                    <TabsTrigger value="file" className="gap-2"><Upload size={14}/> Arquivo</TabsTrigger>
                    <TabsTrigger value="camera" className="gap-2" onClick={startCamera}><Camera size={14}/> Câmera</TabsTrigger>
                    <TabsTrigger value="link" className="gap-2"><LinkIcon size={14}/> Link</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="file" className="mt-0">
                    <Input type="file" accept="image/*" onChange={handleFileUpload} className="cursor-pointer" />
                  </TabsContent>
                  
                  <TabsContent value="camera" className="mt-0 space-y-2">
                    <video ref={videoRef} className="w-full aspect-square rounded-md bg-black object-cover" autoPlay muted />
                    {hasCameraPermission === false && (
                      <Alert variant="destructive" className="py-2">
                        <AlertTitle className="text-xs">Sem acesso</AlertTitle>
                        <AlertDescription className="text-[10px]">Permita a câmera no navegador.</AlertDescription>
                      </Alert>
                    )}
                    <Button type="button" className="w-full gap-2 h-8" onClick={capturePhoto} disabled={hasCameraPermission === false}>
                      <Camera size={14}/> Tirar Foto
                    </Button>
                  </TabsContent>
                  
                  <TabsContent value="link" className="mt-0 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Input placeholder="Cole o link da foto (https://...)" value={linkInput} onChange={(e) => setLinkInput(e.target.value)} />
                      <Button type="button" onClick={handleLinkUpload} disabled={!linkInput || isProcessingPhoto}>
                        {isProcessingPhoto ? <Loader2 className="animate-spin" size={14}/> : <LinkIcon size={14}/>}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">O link deve ser direto para a imagem (ex: termina em .jpg ou .png).</p>
                  </TabsContent>
                </Tabs>
              )}
              {isProcessingPhoto && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                  <Loader2 className="animate-spin h-3 w-3" /> Processando foto...
                </div>
              )}
              <FormField name="fotoUrl" render={() => <FormMessage />} />
            </div>

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || isProcessingPhoto}>
              {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : "Registrar Aluno"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
