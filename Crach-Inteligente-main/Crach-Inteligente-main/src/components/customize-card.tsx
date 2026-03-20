"use client";

import React, { useRef, type ChangeEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Wand2, Trash2, PlusCircle, Loader2, Save, Plus, Palette } from 'lucide-react';
import NextImage from 'next/image';
import { type BadgeStyleConfig, type CustomField, type TextStyle, type PhotoStyle } from '@/lib/badge-styles';
import { compressImage } from '@/lib/image-utils';

interface CustomizeCardProps {
  modelName: string;
  setModelName: (name: string) => void;
  background: string;
  setBackground: (bg: string) => void;
  badgeStyle: BadgeStyleConfig;
  setBadgeStyle: (style: BadgeStyleConfig | ((prev: BadgeStyleConfig) => BadgeStyleConfig)) => void;
  onSave: () => void;
  onNew: () => void;
  isEdit: boolean;
}

const safeParseInt = (val: string): number => {
  const parsed = parseInt(val);
  return isNaN(parsed) ? 0 : parsed;
};

const StyleInput = ({ label, value, onChange, unit = 'px', ...props }: { label: string, value: number, onChange: (e: ChangeEvent<HTMLInputElement>) => void, unit?: string, [key: string]: any }) => (
  <div className="grid grid-cols-2 items-center gap-2">
    <Label className="text-xs">{label}</Label>
    <div className="flex items-center gap-1">
      <input type="number" value={isNaN(value) ? 0 : value} onChange={onChange} className="h-8 w-20 text-xs border rounded px-2" {...props} />
      <span className="text-[10px] text-muted-foreground">{unit}</span>
    </div>
  </div>
);

const ColorInput = ({ label, value, onChange }: { label: string, value: string, onChange: (e: ChangeEvent<HTMLInputElement>) => void }) => (
  <div className="grid grid-cols-2 items-center gap-2">
    <Label className="text-xs">{label}</Label>
    <Input type="color" value={value || "#000000"} onChange={onChange} className="h-8 w-20 p-1 cursor-pointer" />
  </div>
);

const CustomSlider = ({ label, value, min = 0, max = 1, step = 0.1, onChange }: { label: string, value: number, min?: number, max?: number, step?: number, onChange: (value: number[]) => void }) => (
    <div className="grid grid-cols-2 items-center gap-2">
        <Label className="text-xs">{label}</Label>
        <Slider value={[isNaN(value) ? 0 : value]} onValueChange={onChange} min={min} max={max} step={step} />
    </div>
);

export default function CustomizeCard({ 
  modelName, setModelName, 
  background, setBackground, 
  badgeStyle, setBadgeStyle, 
  onSave, onNew, isEdit 
}: CustomizeCardProps) {
  
  const backgroundFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleBackgroundChange = () => {
    const file = backgroundFileRef.current?.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawDataUrl = e.target?.result as string;
      try {
        const optimizedBackground = await compressImage(rawDataUrl, 1063, 768, 0.7);
        setBackground(optimizedBackground);
      } catch (error) {
        toast({ variant: "destructive", title: "Erro na imagem", description: "Não foi possível processar o fundo." });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStyleChange = (section: keyof BadgeStyleConfig, key: string, value: any) => {
    setBadgeStyle((prev) => ({
      ...prev,
      [section]: typeof prev[section as keyof BadgeStyleConfig] === 'object' 
        ? { ...(prev[section as keyof BadgeStyleConfig] as object), [key]: value }
        : value
    }));
  };

  const handleCustomFieldChange = (id: string, key: keyof CustomField, value: any) => {
      setBadgeStyle((prev) => ({
        ...prev,
        customFields: prev.customFields.map(field => 
            field.id === id ? { ...field, [key]: value } : field
        )
      }));
  };
  
  const addCustomField = () => {
      const newField: CustomField = {
          id: `custom-${Date.now()}`,
          label: 'Novo Campo',
          x: 50,
          y: 600,
          width: 400,
          height: 40,
          fontSize: 24,
          color: '#ffffff',
          fontWeight: 'normal',
          textAlign: 'left',
          backgroundColor: '#000000',
          backgroundOpacity: 0,
          backgroundRadius: 6,
          paddingTop: 0,
          paddingLeft: 0,
      };
      setBadgeStyle(prev => ({ ...prev, customFields: [...prev.customFields, newField] }));
  };

  const removeCustomField = (id: string) => {
      setBadgeStyle(prev => ({ ...prev, customFields: prev.customFields.filter(field => field.id !== id) }));
  };
  
  const renderTextControls = (field: 'name' | 'turma', title: string) => (
    <AccordionItem value={field}>
      <AccordionTrigger className="text-sm font-medium">{title}</AccordionTrigger>
      <AccordionContent className="space-y-3 p-1">
        <StyleInput label="Posição X" value={badgeStyle[field].x} onChange={(e) => handleStyleChange(field, 'x', safeParseInt(e.target.value))} />
        <StyleInput label="Posição Y" value={badgeStyle[field].y} onChange={(e) => handleStyleChange(field, 'y', safeParseInt(e.target.value))} />
        <StyleInput label="Largura" value={badgeStyle[field].width} onChange={(e) => handleStyleChange(field, 'width', safeParseInt(e.target.value))} />
        <StyleInput label="Altura" value={badgeStyle[field].height} onChange={(e) => handleStyleChange(field, 'height', safeParseInt(e.target.value))} />
        
        <div className="pt-2 border-t mt-2">
            <CustomSlider label="Tamanho Fonte" value={badgeStyle[field].fontSize} min={10} max={120} step={1} onChange={(val) => handleStyleChange(field, 'fontSize', val[0])} />
            <div className="flex justify-end mt-1">
                <span className="text-[10px] text-muted-foreground">{badgeStyle[field].fontSize}px</span>
            </div>
        </div>

        <div className="pt-2 border-t mt-2 space-y-3">
            <div>
              <CustomSlider label="Deslocamento Vertical" value={badgeStyle[field].paddingTop} min={-100} max={100} step={1} onChange={(val) => handleStyleChange(field, 'paddingTop', val[0])} />
              <div className="flex justify-end mt-1">
                  <span className="text-[10px] text-muted-foreground">{badgeStyle[field].paddingTop}px</span>
              </div>
            </div>
            <div>
              <CustomSlider label="Deslocamento Horizontal" value={badgeStyle[field].paddingLeft} min={-100} max={100} step={1} onChange={(val) => handleStyleChange(field, 'paddingLeft', val[0])} />
              <div className="flex justify-end mt-1">
                  <span className="text-[10px] text-muted-foreground">{badgeStyle[field].paddingLeft}px</span>
              </div>
            </div>
        </div>

        <div className="pt-2 border-t mt-2">
            <ColorInput label="Cor Fonte" value={badgeStyle[field].color} onChange={(e) => handleStyleChange(field, 'color', e.target.value)} />
            <ColorInput label="Cor Fundo" value={badgeStyle[field].backgroundColor} onChange={(e) => handleStyleChange(field, 'backgroundColor', e.target.value)} />
            <CustomSlider label="Opacidade Fundo" value={badgeStyle[field].backgroundOpacity} onChange={(val) => handleStyleChange(field, 'backgroundOpacity', val[0])} />
            <StyleInput label="Arredondar Cantos" value={badgeStyle[field].backgroundRadius} onChange={(e) => handleStyleChange(field, 'backgroundRadius', safeParseInt(e.target.value))} />
        </div>
      </AccordionContent>
    </AccordionItem>
  );

  return (
    <Card className="shadow-lg border-2 border-primary/20">
      <CardHeader>
        <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-primary">
                <Palette size={20}/> Editor de Design
            </CardTitle>
            <Button variant="outline" size="sm" onClick={onNew} className="h-8 gap-1 text-xs">
                <Plus size={14}/> Novo Modelo
            </Button>
        </div>
        <CardDescription>Ajustes refletem instantaneamente no preview.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Nome do Modelo</Label>
            <Input 
                placeholder="Ex: Formatura 2024" 
                value={modelName} 
                onChange={(e) => setModelName(e.target.value)}
                className="font-medium h-9"
            />
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="background">
            <AccordionTrigger className="text-sm font-medium">Fundo do Crachá</AccordionTrigger>
            <AccordionContent className="space-y-4">
                <div className="flex items-center gap-3 pt-2">
                    <div className="w-14 h-10 relative rounded border overflow-hidden bg-muted flex-shrink-0">
                        {background ? <NextImage src={background} alt="BG" fill className="object-cover" /> : null}
                    </div>
                    <Input type="file" accept="image/*" ref={backgroundFileRef} onChange={handleBackgroundChange} className="h-8 text-[10px] cursor-pointer" />
                </div>
                <div className="pt-2 border-t">
                    <CustomSlider 
                        label="Arredondar Crachá" 
                        value={badgeStyle.badgeRadius} 
                        min={0} 
                        max={100} 
                        step={1} 
                        onChange={(val) => handleStyleChange('badgeRadius' as any, '', val[0])} 
                    />
                    <div className="flex justify-end mt-1">
                        <span className="text-[10px] text-muted-foreground">{badgeStyle.badgeRadius}px</span>
                    </div>
                </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="photo">
            <AccordionTrigger className="text-sm font-medium">Foto do Aluno</AccordionTrigger>
            <AccordionContent className="space-y-3 p-1">
              <StyleInput label="Posição X" value={badgeStyle.photo.x} onChange={(e) => handleStyleChange('photo', 'x', safeParseInt(e.target.value))} />
              <StyleInput label="Posição Y" value={badgeStyle.photo.y} onChange={(e) => handleStyleChange('photo', 'y', safeParseInt(e.target.value))} />
              <StyleInput label="Largura" value={badgeStyle.photo.width} onChange={(e) => handleStyleChange('photo', 'width', safeParseInt(e.target.value))} />
              <StyleInput label="Altura" value={badgeStyle.photo.height} onChange={(e) => handleStyleChange('photo', 'height', safeParseInt(e.target.value))} />
              <StyleInput label="Arredondar" value={badgeStyle.photo.borderRadius} onChange={(e) => handleStyleChange('photo', 'borderRadius', safeParseInt(e.target.value))} />
            </AccordionContent>
          </AccordionItem>

          {renderTextControls('name', 'Campo Nome')}
          {renderTextControls('turma', 'Campo Turma')}

          <AccordionItem value="customFields">
            <AccordionTrigger className="text-sm font-medium">Campos Dinâmicos</AccordionTrigger>
            <AccordionContent className="space-y-3 p-1">
              {badgeStyle.customFields.map((field) => (
                <div key={field.id} className="border p-2 rounded-md space-y-2 bg-muted/20">
                    <div className="flex justify-between items-center gap-2">
                        <Input value={field.label} onChange={(e) => handleCustomFieldChange(field.id, 'label', e.target.value)} className="h-7 text-xs" />
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeCustomField(field.id)}><Trash2 size={12}/></Button>
                    </div>
                    <StyleInput label="Posição Y" value={field.y} onChange={(e) => handleCustomFieldChange(field.id, 'y', safeParseInt(e.target.value))} />
                    <CustomSlider label="Deslocamento V" value={field.paddingTop} min={-50} max={50} step={1} onChange={(val) => handleCustomFieldChange(field.id, 'paddingTop', val[0])} />
                    <CustomSlider label="Deslocamento H" value={field.paddingLeft} min={-50} max={50} step={1} onChange={(val) => handleCustomFieldChange(field.id, 'paddingLeft', val[0])} />
                </div>
              ))}
               <Button onClick={addCustomField} className="w-full mt-2" variant="outline" size="sm">
                <PlusCircle size={14} className="mr-2"/> Adicionar Campo
              </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
      <CardFooter className="bg-muted/30 pt-4">
        <Button 
          className="w-full gap-2 shadow-sm" 
          onClick={onSave}
          disabled={!modelName}
        >
          <Save size={16}/>
          {isEdit ? "Atualizar Modelo" : "Salvar Novo Modelo"}
        </Button>
      </CardFooter>
    </Card>
  );
}
