'use client';

import React from 'react';
import { CalendarView } from '@/components/calendar/CalendarView';
import {
  DashboardCards,
  UpcomingPublications,
} from '@/components/calendar/DashboardCards';
import { PublicationForm } from '@/components/calendar/PublicationForm';
import {
  Publication,
  Category,
  Holiday,
} from '@/lib/calendar/types';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_SERIES,
} from '@/lib/calendar/constants';
import {
  usePublications,
  useHolidays,
  useCategories,
  useSeries,
} from '@/lib/calendar';
import {
  generateSaoPauloHolidays,
  mergeHolidays,
} from '@/lib/calendar/utils';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function CalendarPage() {
  const [selectedYear, setSelectedYear] = React.useState<number>(2026);

  const [publications, setPublications] = React.useState<Publication[]>([]);
  const [autoHolidays, setAutoHolidays] = React.useState<Holiday[]>([]);
  const [manualHolidays, setManualHolidays] = React.useState<Holiday[]>([]);
  const [allHolidays, setAllHolidays] = React.useState<Holiday[]>([]);

  const [categories, setCategories] =
    React.useState<Category[]>(DEFAULT_CATEGORIES);

  const [series, setSeries] = React.useState(DEFAULT_SERIES);

  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  const [selectedPublication, setSelectedPublication] =
    React.useState<Publication | null>(null);

  const [isFormOpen, setIsFormOpen] = React.useState<boolean>(false);
  const [isEditing, setIsEditing] = React.useState<boolean>(false);

  // ============================================================
  // Hooks do Firestore
  // ============================================================

  const publicationsHook = usePublications();
  const holidaysHook = useHolidays();
  const categoriesHook = useCategories();
  const seriesHook = useSeries();

  // ============================================================
  // Gera os feriados automáticos de São Paulo
  // ============================================================

  React.useEffect(() => {
    const generatedHolidays = generateSaoPauloHolidays(selectedYear).map(
      (holiday, index) => ({
        ...holiday,
        id: `AUTO_${selectedYear}_${index}`,
      })
    );

    setAutoHolidays(generatedHolidays as Holiday[]);
  }, [selectedYear]);

  // ============================================================
  // Mescla feriados automáticos e manuais
  // ============================================================

  React.useEffect(() => {
    const merged = mergeHolidays(autoHolidays, manualHolidays);

    setAllHolidays(merged);
  }, [autoHolidays, manualHolidays]);

  // ============================================================
  // Carrega os dados
  // ============================================================

  React.useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);

      try {
        // --------------------------------------------------------
        // Publicações
        // --------------------------------------------------------

        const pubs =
          await publicationsHook.getPublicationsByYear(selectedYear);

        if (!isMounted) return;

        setPublications(pubs);

        // --------------------------------------------------------
        // Feriados manuais
        // --------------------------------------------------------

        const manualHols =
          await holidaysHook.getHolidaysByYear(selectedYear);

        if (!isMounted) return;

        setManualHolidays(manualHols);

        // --------------------------------------------------------
        // Categorias
        // --------------------------------------------------------

        const cats = await categoriesHook.getAllCategories();

        if (!isMounted) return;

        if (cats.length > 0) {
          setCategories(cats);
        }

        // --------------------------------------------------------
        // Séries
        // --------------------------------------------------------

        const loadedSeries = await seriesHook.getAllSeries();

        if (!isMounted) return;

        if (loadedSeries.length > 0) {
          setSeries(loadedSeries);
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);

        if (isMounted) {
          toast.error('Erro ao carregar dados do calendário');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [
    selectedYear,
    publicationsHook,
    holidaysHook,
    categoriesHook,
    seriesHook,
  ]);

  // ============================================================
  // Nova publicação
  // ============================================================

  const handleAddPublication = React.useCallback(() => {
    setIsEditing(false);
    setSelectedPublication(null);
    setIsFormOpen(true);
  }, []);

  // ============================================================
  // Clique em uma publicação
  // ============================================================

  const handlePublicationClick = React.useCallback(
    (publication: Publication) => {
      setSelectedPublication(publication);
      setIsEditing(true);
      setIsFormOpen(true);
    },
    []
  );

  // ============================================================
  // Clique em uma data do calendário
  // ============================================================

  const handleDateClick = React.useCallback((date: string) => {
    setIsEditing(false);

    setSelectedPublication({
      publicationDate: date,
    } as Publication);

    setIsFormOpen(true);
  }, []);

  // ============================================================
  // Alteração do ano
  // ============================================================

  const handleYearChange = React.useCallback((year: number) => {
    setSelectedYear(year);
  }, []);

  // ============================================================
  // Salvar publicação
  // ============================================================

  const handleSavePublication = React.useCallback(
    async (
      publicationData: Omit<
        Publication,
        'id' | 'createdAt' | 'updatedAt' | 'history'
      >
    ) => {
      try {
        // --------------------------------------------------------
        // Editar publicação existente
        // --------------------------------------------------------

        if (isEditing && selectedPublication?.id) {
          await publicationsHook.updatePublication(
            selectedPublication.id,
            publicationData
          );

          toast.success('Publicação atualizada com sucesso!');
        }

        // --------------------------------------------------------
        // Criar nova publicação
        // --------------------------------------------------------

        else {
          await publicationsHook.createPublication(publicationData);

          toast.success('Publicação criada com sucesso!');
        }

        // --------------------------------------------------------
        // Atualiza a lista
        // --------------------------------------------------------

        const pubs =
          await publicationsHook.getPublicationsByYear(selectedYear);

        setPublications(pubs);

        // --------------------------------------------------------
        // Fecha o formulário
        // --------------------------------------------------------

        setIsFormOpen(false);
        setSelectedPublication(null);
        setIsEditing(false);
      } catch (error) {
        console.error('Erro ao salvar publicação:', error);

        toast.error('Erro ao salvar publicação');
      }
    },
    [
      isEditing,
      selectedPublication,
      publicationsHook,
      selectedYear,
    ]
  );

  // ============================================================
  // Loading
  // ============================================================

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />

          <p className="text-sm font-medium text-muted-foreground">
            Carregando calendário...
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // Página
  // ============================================================

  return (
    <div className="space-y-8 p-6">

      {/* ========================================================
          Cabeçalho
      ======================================================== */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Calendário de Publicações {selectedYear}
          </h1>

          <p className="mt-1 text-muted-foreground">
            Central de planejamento e acompanhamento das publicações
            da escola
          </p>
        </div>

        {/* ======================================================
            Seletor de ano + nova publicação
        ====================================================== */}

        <div className="flex items-center gap-4">
          <select
            value={selectedYear}
            onChange={(event) =>
              handleYearChange(Number(event.target.value))
            }
            className="rounded-md border bg-background px-4 py-2"
            aria-label="Selecionar ano"
          >
            {[2025, 2026, 2027, 2028, 2029].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <Button
            onClick={handleAddPublication}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />

            Nova Publicação
          </Button>
        </div>
      </div>

      {/* ========================================================
          Cards do Dashboard
      ======================================================== */}

      <DashboardCards
        publications={publications}
        categories={categories}
      />

      {/* ========================================================
          Conteúdo Principal
      ======================================================== */}

      <div className="grid gap-8 lg:grid-cols-3">

        {/* ======================================================
            Calendário
        ====================================================== */}

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

        {/* ======================================================
            Próximas publicações
        ====================================================== */}

        <div>
          <UpcomingPublications
            publications={publications}
            categories={categories}
            limit={8}
            onPublicationClick={handlePublicationClick}
          />
        </div>
      </div>

      {/* ========================================================
          Legenda das categorias
      ======================================================== */}

      <div className="flex flex-wrap gap-4 rounded-lg bg-muted/30 p-4">
        <h3 className="mb-2 w-full text-sm font-semibold">
          Categorias:
        </h3>

        {categories.map((category) => (
          <div
            key={category.id}
            className="flex items-center gap-2"
          >
            <div
              className="h-4 w-4 rounded"
              style={{
                backgroundColor: category.color,
              }}
              aria-hidden="true"
            />

            <span className="text-xs">
              {category.name}
            </span>
          </div>
        ))}
      </div>

      {/* ========================================================
          Formulário de publicação
      ======================================================== */}

      <PublicationForm
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);

          if (!open) {
            setSelectedPublication(null);
            setIsEditing(false);
          }
        }}
        onSave={handleSavePublication}
        initialData={
          isEditing
            ? selectedPublication || undefined
            : selectedPublication || undefined
        }
        categories={categories}
        series={series}
        holidays={allHolidays}
      />
    </div>
  );
}
