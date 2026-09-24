'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Publication, Category, Series, PublicationStatus, Priority } from '@/lib/calendar/types';
import { 
  DEFAULT_CATEGORIES, 
  DEFAULT_SERIES,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS 
} from '@/lib/calendar/constants';
import { calculateBusinessDaysBefore, formatDateForInput } from '@/lib/calendar/utils';

interface PublicationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (publication: Omit<Publication, 'id' | 'createdAt' | 'updatedAt' | 'history'>) => void;
  initialData?: Partial<Publication>;
  categories?: Category[];
  series?: Series[];
  holidays?: Array<{ date: string }>;
  currentUser?: { id: string; name: string };
}

export function PublicationForm({
  open,
  onOpenChange,
  onSave,
  initialData,
  categories = DEFAULT_CATEGORIES,
  series = DEFAULT_SERIES,
  holidays = [],
  currentUser
}: PublicationFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categoryId: '',
    seriesId: '',
    status: 'PLANEJAMENTO' as PublicationStatus,
    priority: 'MEDIA' as Priority,
    publicationDate: formatDateForInput(new Date()),
    plannedDate: '',
    productionDays: 0,
    responsibleName: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<string[]>([]);

  // Reset form when opening or initialData changes
  useEffect(() => {
    if (open && initialData) {
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        categoryId: initialData.categoryId || '',
        seriesId: initialData.seriesId || '',
        status: initialData.status || 'PLANEJAMENTO',
        priority: initialData.priority || 'MEDIA',
        publicationDate: initialData.publicationDate || formatDateForInput(new Date()),
        plannedDate: initialData.plannedDate || '',
        productionDays: initialData.productionDays || 0,
        responsibleName: initialData.responsibleName || '',
        notes: initialData.notes || '',
      });
    } else if (open) {
      // New publication - reset form
      setFormData({
        title: '',
        description: '',
        categoryId: '',
        seriesId: '',
        status: 'PLANEJAMENTO',
        priority: 'MEDIA',
        publicationDate: formatDateForInput(new Date()),
        plannedDate: '',
        productionDays: 0,
        responsibleName: '',
        notes: '',
      });
    }
    setErrors({});
    setConflicts([]);
  }, [open, initialData]);

  // Calculate planned date when publication date or series/category changes
  useEffect(() => {
    if (formData.publicationDate && formData.categoryId && formData.seriesId) {
      const pubDate = new Date(formData.publicationDate);
      const holidayDates = holidays.map(h => h.date);
      
      // Get production days based on category and series
      let days = 0;
      if (formData.categoryId === 'ATIVIDADES_VARIADAS' || formData.categoryId === 'PROGRAMA_BILINGUE') {
        // This would ideally come from useProductionDeadlines hook
        // For now, using defaults from constants
        days = formData.productionDays || 10;
      }
      
      if (days > 0) {
        const planned = calculateBusinessDaysBefore(pubDate, days, holidayDates);
        setFormData(prev => ({ ...prev, plannedDate: formatDateForInput(planned) }));
      }
    }
  }, [formData.publicationDate, formData.categoryId, formData.seriesId, formData.productionDays, holidays]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Título é obrigatório';
    }
    
    if (!formData.categoryId) {
      newErrors.categoryId = 'Categoria é obrigatória';
    }
    
    if (!formData.publicationDate) {
      newErrors.publicationDate = 'Data de publicação é obrigatória';
    }
    
    // Check for weekend
    const pubDate = new Date(formData.publicationDate);
    const dayOfWeek = pubDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      setConflicts(['Publicação agendada para um final de semana']);
    } else {
      setConflicts([]);
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSave({
        ...formData,
        createdBy: currentUser?.id || 'system',
        updatedBy: currentUser?.id || 'system',
        isDeleted: false,
      });
      onOpenChange(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {initialData?.id ? 'Editar Publicação' : 'Nova Publicação'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Informações Principais */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold">Informações Principais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Título da Publicação *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="Ex: Dia das Mães, Volta às Aulas..."
                  className={errors.title ? 'border-red-500' : ''}
                />
                {errors.title && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.title}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Descrição detalhada da publicação..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="categoryId">Categoria *</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => handleChange('categoryId', value)}
                  >
                    <SelectTrigger className={errors.categoryId ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter(c => c.isActive).map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.categoryId && (
                    <p className="text-xs text-red-500">{errors.categoryId}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="seriesId">Série (se aplicável)</Label>
                  <Select
                    value={formData.seriesId}
                    onValueChange={(value) => handleChange('seriesId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {series.filter(s => s.isActive).map(serie => (
                        <SelectItem key={serie.id} value={serie.id}>
                          {serie.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleChange('status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(status => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="priority">Prioridade</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => handleChange('priority', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map(priority => (
                        <SelectItem key={priority.value} value={priority.value}>
                          {priority.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Datas */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold">Datas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="publicationDate">Data da Publicação *</Label>
                  <Input
                    id="publicationDate"
                    type="date"
                    value={formData.publicationDate}
                    onChange={(e) => handleChange('publicationDate', e.target.value)}
                    className={errors.publicationDate ? 'border-red-500' : ''}
                  />
                  {errors.publicationDate && (
                    <p className="text-xs text-red-500">{errors.publicationDate}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="plannedDate">Data Prevista (Produção)</Label>
                  <Input
                    id="plannedDate"
                    type="date"
                    value={formData.plannedDate}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Calculado automaticamente
                  </p>
                </div>
              </div>

              {(formData.categoryId === 'ATIVIDADES_VARIADAS' || formData.categoryId === 'PROGRAMA_BILINGUE') && (
                <div className="grid gap-2">
                  <Label htmlFor="productionDays">Prazo de Produção (dias úteis)</Label>
                  <Input
                    id="productionDays"
                    type="number"
                    value={formData.productionDays}
                    onChange={(e) => handleChange('productionDays', parseInt(e.target.value) || 0)}
                    min="0"
                    max="60"
                  />
                  <p className="text-xs text-muted-foreground">
                    Altere para recalcular a data prevista
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Responsáveis e Observações */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold">Responsáveis e Observações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="responsibleName">Responsável</Label>
                <Input
                  id="responsibleName"
                  value={formData.responsibleName}
                  onChange={(e) => handleChange('responsibleName', e.target.value)}
                  placeholder="Nome do responsável"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Alertas de Conflito */}
          {conflicts.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-yellow-800">Atenção</p>
                  <ul className="text-sm text-yellow-700 list-disc list-inside">
                    {conflicts.map((conflict, idx) => (
                      <li key={idx}>{conflict}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="gap-2">
            <Save className="w-4 h-4" />
            Salvar Publicação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
