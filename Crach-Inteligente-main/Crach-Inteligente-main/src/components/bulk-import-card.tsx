
"use client";

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { type Student, type BadgeModel } from '@/lib/types';
import { Upload, Loader2, Layout } from 'lucide-react';
import { compressImage } from '@/lib/image-utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface BulkImportCardProps {
  onImport: (students: Omit<Student, 'id'>[]) => void;
  models: BadgeModel[];
}

export default function BulkImportCard({ onImport, models }: BulkImportCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>("default");
  const excelFileRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImport = async () => {
    const excelFile = excelFileRef.current?.files?.[0];
    const photoFiles = photosRef.current?.files;

    if (!excelFile || !photoFiles || photoFiles.length === 0) {
      toast({ variant: 'destructive', title: 'Arquivos ausentes', description: 'Selecione o arquivo Excel e as fotos.' });
      return;
    }

    setIsLoading(true);

    try {
      const data = await excelFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
      
      let studentData = rawRows.filter(row => row && row.length >= 2);
      if (studentData.length > 0) {
        const firstRow = String(studentData[0][0] || '').toLowerCase();
        if (firstRow.includes('nome')) studentData = studentData.slice(1);
      }

      const sortedPhotos = Array.from(photoFiles).sort((a, b) => 
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );

      if (studentData.length !== sortedPhotos.length) {
        toast({ variant: 'destructive', title: 'Erro', description: `Excel tem ${studentData.length} nomes, mas você enviou ${sortedPhotos.length} fotos.` });
        setIsLoading(false);
        return;
      }
      
      const promises = studentData.map((row, index) => {
        const nome = row[0]?.toString().trim();
        const segmento = row[1]?.toString().trim() || "Geral";
        const turma = row[2]?.toString().trim() || "Geral";
        const matricula = row[3]?.toString().trim() || `AUT-${Date.now()}-${index}`;
        const photoFile = sortedPhotos[index];

        if (!nome) return null;
        
        return new Promise<Omit<Student, 'id'>>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const optimizedFoto = await compressImage(e.target?.result as string);
                resolve({ 
                  nome, 
                  matricula,
                  segmento, 
                  turma, 
                  fotoUrl: optimizedFoto, 
                  enabled: true, 
                  modeloId: selectedModelId === "default" ? "" : selectedModelId 
                });
            };
            reader.readAsDataURL(photoFile);
        });
      }).filter(Boolean);

      const imported = await Promise.all(promises as Promise<Omit<Student, 'id'>>[]);
      onImport(imported);
      toast({ title: "Importado!", description: `${imported.length} alunos cadastrados.` });

    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Formato: A: Nome | B: Segmento | C: Turma | D: Matrícula.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary"><Upload /> Importação</CardTitle>
        <CardDescription>A: Nome | B: Segmento | C: Turma | D: Matrícula</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Arquivo Excel (.xlsx)</Label>
          <Input type="file" accept=".xlsx" ref={excelFileRef} />
        </div>
        <div className="space-y-2">
          <Label>Fotos dos Alunos</Label>
          <Input type="file" accept="image/*" multiple ref={photosRef} />
        </div>
        <Button onClick={handleImport} className="w-full" disabled={isLoading}>
          {isLoading ? <Loader2 className="animate-spin mr-2" /> : "Importar Lote"}
        </Button>
      </CardContent>
    </Card>
  );
}
