"use client";

import React, { useState, useMemo, useRef } from 'react';
import { type Student, type BadgeModel, type SchoolSegment, type SchoolClass } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Pencil, Trash2, CheckCircle2, Circle, Sparkles, Hash, 
  UserMinus, UserCheck, Eye, EyeOff,
  UserCircle, Camera, Upload, Link as LinkIcon, Loader2
} from 'lucide-react';
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StudentBadge from './student-badge';
import { type BadgeStyleConfig, defaultBadgeStyle } from '@/lib/badge-styles';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { usePathname } from "next/navigation";
import { compressImage } from '@/lib/image-utils';
import { useUser } from '@/firebase';

interface StudentListProps {
  students: Student[];
  models: BadgeModel[];
  allStudents: Student[];
  onUpdate: (student: Student) => void;
  onDelete: (studentId: string) => void;
  viewMode: 'table' | 'grid';
  currentLiveBackground?: string;
  currentLiveStyle?: BadgeStyleConfig;
  segments?: SchoolSegment[];
  classes?: SchoolClass[];
}

export default function StudentList({ 
  students, 
  models, 
  allStudents,
  onUpdate, 
  onDelete, 
  viewMode,
  currentLiveBackground,
  currentLiveStyle,
  segments = [],
  classes = []
}: StudentListProps) {
  const { toast } = useToast();
  const pathname = usePathname();
  const { user } = useUser();
  const isGestao = pathname === "/gestao";
  const isLoggedAdmin = user && !user.isAnonymous;
  
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  const formSchema = z.object({
    nome: z.string().min(2, "Mínimo 2 caracteres."),
    matricula: z.string().min(1, "Obrigatório."),
    segmento: z.string().min(1, "Obrigatório."),
    turma: z.string().min(1, "Obrigatório."),
    fotoUrl: z.string().min(1, "Obrigatório."),
    modeloId: z.string().optional(),
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
      modeloId: "",
    }
  });

  const selectedSegmentoName = form.watch("segmento");
  const currentFotoUrl = form.watch("fotoUrl");

  const selectedSegmentoId = useMemo(() => {
    return segments.find(s => s.nome === selectedSegmentoName)?.id;
  }, [segments, selectedSegmentoName]);

  const availableTurmas = useMemo(() => {
    if (classes.length > 0) {
      return classes.filter(c => !selectedSegmentoId || c.segmentoId === selectedSegmentoId);
    }
    return [];
  }, [classes, selectedSegmentoId]);

  const handleEditClick = (student: Student) => {
    setEditingStudent(student);
    form.reset({
      nome: student.nome || "",
      matricula: student.matricula || "",
      segmento: student.segmento || "",
      turma: student.turma || "",
      fotoUrl: student.fotoUrl || "",
      modeloId: student.modeloId || "",
    });
    setLinkInput("");
    setIsDialogOpen(true);
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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro na Câmera', description: 'Verifique as permissões.' });
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
        const optimized = await compressImage(canvas.toDataURL('image/jpeg', 0.8));
        form.setValue('fotoUrl', optimized);
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
      }
      setIsProcessingPhoto(false);
    }
  };

  const handleLinkUpload = async () => {
    if (!linkInput) return;
    setIsProcessingPhoto(true);
    
    try {
      const response = await fetch(linkInput, { mode: 'cors' });
      if (!response.ok) throw new Error('Fetch falhou');
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const optimized = await compressImage(reader.result as string);
        form.setValue('fotoUrl', optimized);
        setLinkInput("");
        setIsProcessingPhoto(false);
        toast({ title: "Foto importada com sucesso!" });
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      const img = new Image();
      img.onload = () => {
        form.setValue('fotoUrl', linkInput);
        setLinkInput("");
        setIsProcessingPhoto(false);
        toast({ 
          title: "Link aceito!", 
          description: "A imagem será carregada diretamente da fonte externa." 
        });
      };
      img.onerror = () => {
        setIsProcessingPhoto(false);
        toast({ 
          variant: 'destructive', 
          title: 'Link Inválido', 
          description: 'Não foi possível acessar a imagem deste link.' 
        });
      };
      img.src = linkInput;
    }
  };

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    if (!editingStudent) return;
    onUpdate({ ...editingStudent, ...data });
    setIsDialogOpen(false);
    setEditingStudent(null);
    toast({ title: "Dados atualizados!" });
  };

  return (
    <>
      {viewMode === 'grid' ? (
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
            {students.map((student) => {
              const isSelected = student.enabled !== false;
              const isVisible = student.visivelFila !== false;
              const isAtivo = student.ativo !== false;
              const studentModel = models.find(m => m.id === student.modeloId);
              const badgeBackground = studentModel?.fundoCrachaUrl || currentLiveBackground || "";
              const badgeStyle = studentModel?.badgeStyle || currentLiveStyle || defaultBadgeStyle;
              
              return (
                <div key={student.id} className="relative group rounded-xl overflow-hidden shadow-xl border-2 transition-all">
                  <div className="absolute top-4 left-4 z-30">
                    <Button 
                      variant={isSelected ? "default" : "secondary"} 
                      size="sm" 
                      className={cn(
                        "h-9 px-4 gap-2 text-xs font-bold shadow-lg transition-all",
                        isSelected ? "bg-green-600 hover:bg-green-700 text-white" : "bg-white/95 text-muted-foreground hover:bg-white"
                      )}
                      onClick={() => onUpdate({ ...student, enabled: !isSelected })}
                    >
                      {isSelected ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                      {isSelected ? "Selecionado" : "Deselecionado"}
                    </Button>
                  </div>

                  <div className="absolute top-4 right-4 z-30 flex gap-2">
                    <Button 
                      size="icon" 
                      variant="secondary" 
                      className={cn(
                        "h-9 w-9 bg-white/95 hover:bg-white shadow-md",
                        isVisible ? "text-primary" : "text-muted-foreground"
                      )}
                      onClick={() => onUpdate({ ...student, visivelFila: !isVisible })}
                      title={isVisible ? "Ocultar da Fila" : "Mostrar na Fila"}
                    >
                      {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </Button>
                    <Button 
                      size="icon" 
                      variant="secondary" 
                      className="h-9 w-9 bg-white/95 hover:bg-white shadow-md"
                      onClick={() => handleEditClick(student)}
                      title="Editar Aluno"
                    >
                      <Pencil size={14} className="text-muted-foreground" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="secondary" 
                      className="h-9 w-9 bg-white/95 hover:bg-white shadow-md"
                      onClick={() => onUpdate({ ...student, ativo: !student.ativo })}
                      title={student.ativo !== false ? "Marcar como Transferido" : "Reativar Matrícula"}
                      disabled={!isLoggedAdmin}
                    >
                      {student.ativo !== false ? <UserMinus size={14} className="text-orange-500" /> : <UserCheck size={14} className="text-green-600" />}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="destructive" className="h-9 w-9 shadow-md" title="Excluir Aluno" disabled={!isLoggedAdmin}>
                          <Trash2 size={14} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação não pode ser desfeita. O aluno {student.nome} será removido.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(student.id)} className="bg-destructive hover:bg-destructive/90">Confirmar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <div className={cn(
                      "transition-all duration-300",
                      !isSelected && "opacity-40 grayscale"
                  )}>
                      <StudentBadge 
                          student={student} 
                          background={badgeBackground} 
                          styles={badgeStyle} 
                      />
                  </div>
                </div>
              );
            })}
          </div>
          {students.length === 0 && (
            <div className="text-center py-20 border-2 border-dashed rounded-xl bg-muted/5">
               <UserCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
               <p className="text-muted-foreground font-medium">Nenhum aluno na fila de impressão para os filtros atuais.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[50px]">Imprimir</TableHead>
                <TableHead className="w-[80px]">Foto</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => {
                const isSelected = student.enabled !== false;
                const isVisible = student.visivelFila !== false;
                const isAtivo = student.ativo !== false;
                return (
                  <TableRow key={student.id} className={cn(!isAtivo && "opacity-50 grayscale")}>
                    <TableCell>
                      <Checkbox 
                        checked={isSelected} 
                        onCheckedChange={(val) => onUpdate({ ...student, enabled: val as boolean })} 
                      />
                    </TableCell>
                    <TableCell>
                      <Avatar className="h-10 w-10 border">
                        <AvatarImage src={student.fotoUrl} className="object-cover" />
                        <AvatarFallback>{student.nome.charAt(0)}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {student.nome}
                      <p className="text-[10px] text-muted-foreground font-mono">MT: {student.matricula}</p>
                    </TableCell>
                    <TableCell className="text-xs">{student.turma}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn("h-8 w-8", isVisible ? "text-primary" : "text-muted-foreground")}
                          onClick={() => onUpdate({ ...student, visivelFila: !isVisible })}
                          title={isVisible ? "Ocultar da Fila" : "Mostrar na Fila"}
                        >
                          {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(student)} className="h-8 w-8"><Pencil size={14}/></Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => onUpdate({ ...student, ativo: !isAtivo })}
                          title={isAtivo ? "Transferir Aluno" : "Reativar Matrícula"}
                          disabled={!isLoggedAdmin}
                        >
                          {isAtivo ? <UserMinus size={14} className="text-orange-500" /> : <UserCheck size={14} className="text-green-600" />}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={!isLoggedAdmin}><Trash2 size={14}/></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Não</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(student.id)}>Sim, Excluir</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {students.length === 0 && (
            <div className="text-center py-20 bg-muted/10">
               <p className="text-muted-foreground">Nenhum aluno encontrado.</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {editingStudent && (
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Editar Aluno</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Nome</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ""} className="h-10" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="matricula"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Matrícula</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                            <Input {...field} value={field.value ?? ""} className="pl-9 h-10" />
                          </div>
                        </FormControl>
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
                        <Select onValueChange={field.onChange} value={field.value || "default"}>
                          <FormControl>
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Modelo Padrão" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="default">Modelo Padrão</SelectItem>
                            {models.map(m => <SelectItem key={m.id} value={m.id}>{m.nomeModelo}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="segmento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Segmento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {segments.map(s => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="turma"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Turma</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableTurmas.map(t => <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-3 pt-2 border-t">
                  <Label>Foto do Aluno</Label>
                  <div className="flex flex-col gap-4">
                    <div className="aspect-square w-32 mx-auto rounded-lg overflow-hidden border shadow-inner">
                      {currentFotoUrl ? (
                        <img src={currentFotoUrl} className="w-full h-full object-cover" alt="Preview" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                           <UserCircle className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    
                    <Tabs defaultValue="file" className="w-full">
                      <TabsList className="grid w-full grid-cols-3 h-8">
                        <TabsTrigger value="file" className="text-[10px]"><Upload size={12} className="mr-1" /> Arquivo</TabsTrigger>
                        <TabsTrigger value="camera" className="text-[10px]" onClick={startCamera}><Camera size={12} className="mr-1" /> Câmera</TabsTrigger>
                        <TabsTrigger value="link" className="text-[10px]"><LinkIcon size={12} className="mr-1" /> Link</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="file" className="mt-2">
                        <Input type="file" accept="image/*" onChange={handleFileUpload} className="h-9 text-xs" />
                      </TabsContent>
                      
                      <TabsContent value="camera" className="mt-2 space-y-2">
                        <video ref={videoRef} className="w-full aspect-video rounded-md bg-black object-cover" autoPlay muted />
                        <Button type="button" variant="secondary" className="w-full h-8 text-xs" onClick={capturePhoto}>Capturar</Button>
                      </TabsContent>
                      
                      <TabsContent value="link" className="mt-2 flex gap-2">
                        <Input placeholder="Link da foto..." value={linkInput} onChange={(e) => setLinkInput(e.target.value)} className="h-9 text-xs" />
                        <Button type="button" size="sm" onClick={handleLinkUpload} disabled={isProcessingPhoto}>
                          {isProcessingPhoto ? <Loader2 className="animate-spin" /> : <LinkIcon size={14} />}
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button type="submit" className="w-full h-11 font-bold">
                    Salvar Alterações
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}