'use client';

import React from 'react';
import { CalendarView } from '@/components/calendar/CalendarView';
import { DashboardCards, UpcomingPublications } from '@/components/calendar/DashboardCards';
import { PublicationForm } from '@/components/calendar/PublicationForm';
import { Publication, Category, Holiday } from '@/lib/calendar/types';
import { DEFAULT_CATEGORIES, DEFAULT_HOLIDAYS_2026, DEFAULT_SERIES } from '@/lib/calendar/constants';
import { usePublications, useHolidays, useCategories, useSeries } from '@/lib/calendar';
import { generateSaoPauloHolidays, mergeHolidays } from '@/lib/calendar/utils';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function CalendarPage() {
  const [selectedYear, setSelectedYear] = React.useState(2026);
  const [publications, setPublications] = React.useState<Publication[]>([]);
  const [autoHolidays, setAutoHolidays] = React.useState<Holiday[]>([]);
  const [manualHolidays, setManualHolidays] = React.useState<Holiday[]>([]);
  const [allHolidays, setAllHolidays] = React.useState<Holiday[]>([]);
  const [categories, setCategories] = React.useState<Category[]>(DEFAULT_CATEGORIES);
  const [series, setSeries] = React.useState(DEFAULT_SERIES);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedPublication, setSelectedPublication] = React.useState<Publication | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);

  // Hooks do Firestore
  const publicationsHook = usePublications();
  const holidaysHook = useHolidays();
  const categoriesHook = useCategories();
  const seriesHook = useSeries();

  // Gera feriados automáticos de São Paulo quando o ano muda
  React.useEffect(() => {
    const generatedHolidays = generateSaoPauloHolidays(selectedYear).map((h, index) => ({
      ...h,
      id: `AUTO_${selectedYear}_${index}`
    }));
    setAutoHolidays(generatedHolidays as Holiday[]);
  }, [selectedYear]);

  // Mescla feriados automáticos e manuais
  React.useEffect(() => {
    if (autoHolidays.length > 0 || manualHolidays.length > 0) {
      const merged = mergeHolidays(autoHolidays, manualHolidays);
      setAllHolidays(merged);
    }
  }, [autoHolidays, manualHolidays]);

  // Carregar dados ao montar o componente
  React.useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // Carregar publicações do ano selecionado
        const pubs = await publicationsHook.getPublicationsByYear(selectedYear);
        setPublications(pubs);

        // Carregar feriados manuais do ano selecionado (salvos no Firestore)
        const manualHols = await holidaysHook.getHolidaysByYear(selectedYear);
        if (manualHols.length > 0) {
          setManualHolidays(manualHols);
        } else {
          setManualHolidays([]);
        }

        // Carregar categorias
        const cats = await categoriesHook.getAllCategories();
        if (cats.length > 0) {
          setCategories(cats);
        }

        // Carregar séries
        const s = await seriesHook.getAllSeries();
        if (s.length > 0) {
          setSeries(s);
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados do calendário');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [selectedYear]);

  const handleAddPublication = () => {
    setIsEditing(false);
    setSelectedPublication(null);
    setIsFormOpen(true);
  };

  const handlePublicationClick = (publication: Publication) => {
    setSelectedPublication(publication);
    setIsEditing(true);
    setIsFormOpen(true);
  };

  const handleDateClick = (date: string) => {
    // Abre formulário com data pré-preenchida
    setIsEditing(false);
    setSelectedPublication({ publicationDate: date } as Partial<Publication> as Publication);
    setIsFormOpen(true);
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };

  const handleSavePublication = async (publicationData: Omit<Publication, 'id' | 'createdAt' | 'updatedAt' | 'history'>) => {
    try {
      if (isEditing && selectedPublication?.id) {
        // Editar publicação existente
        await publicationsHook.updatePublication(selectedPublication.id, publicationData);
        toast.success('Publicação atualizada com sucesso!');
      } else {
        // Criar nova publicação
        await publicationsHook.createPublication(publicationData);
        toast.success('Publicação criada com sucesso!');
      }
      
      // Recarregar publicações
      const pubs = await publicationsHook.getPublicationsByYear(selectedYear);
      setPublications(pubs);
      setIsFormOpen(false);
    } catch (error) {
      console.error('Erro ao salvar publicação:', error);
      toast.error('Erro ao salvar publicação');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Carregando calendário...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Calendário de Publicações {selectedYear}
          </h1>
          <p className="text-muted-foreground mt-1">
            Central de planejamento e acompanhamento das publicações da escola
          </p>
        </div>
        
        {/* Seletor de Ano */}
        <div className="flex items-center gap-4">
          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="px-4 py-2 border rounded-md bg-background"
          >
            {[2025, 2026, 2027, 2028, 2029].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          
          <Button onClick={handleAddPublication} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Publicação
          </Button>
        </div>
      </div>

      {/* Cards do Dashboard */}
      <DashboardCards 
        publications={publications}
        categories={categories}
      />

      {/* Conteúdo Principal */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Calendário - Ocupa 2 colunas */}
        <div className="lg:col-span-2">
          <CalendarView
            publications={publications}
            categories={categories}
            holidays={allHolidays}
            onDateClick={handleDateClick}
            onPublicationClick={handlePublicationClick}
            onAddPublication={handleAddPublication}
          />
        </div>

        {/* Próximas Publicações - Ocupa 1 coluna */}
        <div>
          <UpcomingPublications
            publications={publications}
            categories={categories}
            limit={8}
            onPublicationClick={handlePublicationClick}
          />
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-lg">
        <h3 className="font-semibold text-sm w-full mb-2">Categorias:</h3>
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded"
              style={{ backgroundColor: cat.color }}
            />
            <span className="text-xs">{cat.name}</span>
          </div>
        ))}
      </div>

      {/* Formulário de Publicação */}
      <PublicationForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={handleSavePublication}
        initialData={isEditing ? selectedPublication || undefined : undefined}
        categories={categories}
        series={series}
        holidays={allHolidays}
      />
    </div>
  );
}
