'use client';

import React from 'react';
import { CalendarView } from '@/components/calendar/CalendarView';
import { DashboardCards, UpcomingPublications } from '@/components/calendar/DashboardCards';
import { Publication, Category, Holiday } from '@/lib/calendar/types';
import { DEFAULT_CATEGORIES, DEFAULT_HOLIDAYS_2026 } from '@/lib/calendar/constants';
import { usePublications, useHolidays, useCategories } from '@/lib/calendar';
import { Loader2 } from 'lucide-react';

export default function CalendarPage() {
  const [selectedYear, setSelectedYear] = React.useState(2026);
  const [publications, setPublications] = React.useState<Publication[]>([]);
  const [holidays, setHolidays] = React.useState<Holiday[]>(DEFAULT_HOLIDAYS_2026);
  const [categories, setCategories] = React.useState<Category[]>(DEFAULT_CATEGORIES);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedPublication, setSelectedPublication] = React.useState<Publication | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  // Hooks do Firestore
  const publicationsHook = usePublications();
  const holidaysHook = useHolidays();
  const categoriesHook = useCategories();

  // Carregar dados ao montar o componente
  React.useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // Carregar publicações do ano selecionado
        const pubs = await publicationsHook.getPublicationsByYear(selectedYear);
        setPublications(pubs);

        // Carregar feriados do ano selecionado
        const hols = await holidaysHook.getHolidaysByYear(selectedYear);
        if (hols.length > 0) {
          setHolidays(hols);
        }

        // Carregar categorias
        const cats = await categoriesHook.getAllCategories();
        if (cats.length > 0) {
          setCategories(cats);
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        // Em caso de erro, usa dados padrão para demonstração
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [selectedYear]);

  const handleAddPublication = () => {
    setIsDialogOpen(true);
    // Aqui abriria o formulário de nova publicação
    console.log('Abrir formulário de nova publicação');
  };

  const handlePublicationClick = (publication: Publication) => {
    setSelectedPublication(publication);
    // Aqui abriria o modal de detalhes
    console.log('Detalhes da publicação:', publication);
  };

  const handleDateClick = (date: string) => {
    console.log('Data clicada:', date);
    // Aqui abriria o formulário com a data pré-preenchida
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
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
          
          <button
            onClick={handleAddPublication}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            + Nova Publicação
          </button>
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
            holidays={holidays}
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
    </div>
  );
}
