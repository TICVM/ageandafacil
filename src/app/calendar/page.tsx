'use client';

import React from 'react';
import { CalendarView } from '@/components/calendar/CalendarView';
import { DashboardCards, UpcomingPublications } from '@/components/calendar/DashboardCards';
import { Publication, Category, Holiday } from '@/lib/calendar/types';
import { DEFAULT_CATEGORIES, DEFAULT_HOLIDAYS_2026 } from '@/lib/calendar/constants';

// Dados de exemplo para demonstração
const SAMPLE_PUBLICATIONS: Publication[] = [
  {
    id: 'pub-1',
    title: 'Dia das Mães',
    description: 'Publicação especial para o Dia das Mães',
    categoryId: 'EVENTOS_PEDAGOGICOS',
    seriesId: '',
    status: 'EM_PRODUCAO',
    priority: 'ALTA',
    publicationDate: '2026-05-10',
    plannedDate: '2026-04-28',
    productionDays: 8,
    responsibleName: 'Maria Silva',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'user-1',
    updatedBy: 'user-1'
  },
  {
    id: 'pub-2',
    title: 'Volta às Aulas',
    description: 'Publicação de boas-vindas para o início do ano letivo',
    categoryId: 'EVENTOS_PEDAGOGICOS',
    seriesId: '',
    status: 'PUBLICADO',
    priority: 'MEDIA',
    publicationDate: '2026-02-02',
    plannedDate: '2026-01-20',
    productionDays: 10,
    responsibleName: 'João Santos',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'user-1',
    updatedBy: 'user-1'
  },
  {
    id: 'pub-3',
    title: 'Spelling Bee - 5º Ano',
    description: 'Competição de ortografia do programa bilíngue',
    categoryId: 'PROGRAMA_BILINGUE',
    seriesId: '5ANO',
    status: 'PLANEJAMENTO',
    priority: 'ALTA',
    publicationDate: '2026-08-15',
    plannedDate: '2026-07-20',
    productionDays: 11,
    responsibleName: 'Ana Costa',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'user-1',
    updatedBy: 'user-1'
  },
  {
    id: 'pub-4',
    title: 'Mostra Cultural',
    description: 'Divulgação da mostra cultural anual',
    categoryId: 'ATIVIDADES_VARIADAS',
    seriesId: '9ANO',
    status: 'BRIEFING_SOLICITADO',
    priority: 'MEDIA',
    publicationDate: '2026-09-20',
    plannedDate: '2026-09-01',
    productionDays: 8,
    responsibleName: 'Pedro Oliveira',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'user-1',
    updatedBy: 'user-1'
  },
  {
    id: 'pub-5',
    title: 'RT Publicity - Campanha Verão',
    description: 'Campanha solicitada pela agência RT Publicity',
    categoryId: 'RT_PUBLICITY',
    seriesId: '',
    status: 'AGUARDANDO_APROVACAO',
    priority: 'URGENTE',
    publicationDate: '2026-01-15',
    plannedDate: '2026-01-05',
    productionDays: 5,
    responsibleName: 'Carla Mendes',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'user-1',
    updatedBy: 'user-1'
  },
  {
    id: 'pub-6',
    title: 'Festa Junina',
    description: 'Convite e programação da festa junina',
    categoryId: 'EVENTOS_PEDAGOGICOS',
    seriesId: '',
    status: 'PLANEJAMENTO',
    priority: 'MEDIA',
    publicationDate: '2026-06-24',
    plannedDate: '2026-06-10',
    productionDays: 10,
    responsibleName: 'Maria Silva',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'user-1',
    updatedBy: 'user-1'
  },
  {
    id: 'pub-7',
    title: 'Dia do Estudante - 1º Médio',
    description: 'Homenagem ao Dia do Estudante',
    categoryId: 'ATIVIDADES_VARIADAS',
    seriesId: '1MEDIO',
    status: 'EM_REVISAO',
    priority: 'BAIXA',
    publicationDate: '2026-08-11',
    plannedDate: '2026-07-28',
    productionDays: 10,
    responsibleName: 'Roberto Lima',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'user-1',
    updatedBy: 'user-1'
  },
  {
    id: 'pub-8',
    title: 'Natal 2026',
    description: 'Cartão de Natal institucional',
    categoryId: 'EVENTOS_PEDAGOGICOS',
    seriesId: '',
    status: 'PLANEJAMENTO',
    priority: 'ALTA',
    publicationDate: '2026-12-20',
    plannedDate: '2026-12-01',
    productionDays: 15,
    responsibleName: 'Maria Silva',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'user-1',
    updatedBy: 'user-1'
  }
];

export default function CalendarPage() {
  const [selectedPublication, setSelectedPublication] = React.useState<Publication | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

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

  return (
    <div className="space-y-8 p-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          Calendário de Publicações 2026
        </h1>
        <p className="text-muted-foreground mt-1">
          Central de planejamento e acompanhamento das publicações da escola
        </p>
      </div>

      {/* Cards do Dashboard */}
      <DashboardCards 
        publications={SAMPLE_PUBLICATIONS}
        categories={DEFAULT_CATEGORIES}
      />

      {/* Conteúdo Principal */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Calendário - Ocupa 2 colunas */}
        <div className="lg:col-span-2">
          <CalendarView
            publications={SAMPLE_PUBLICATIONS}
            categories={DEFAULT_CATEGORIES}
            holidays={DEFAULT_HOLIDAYS_2026}
            onDateClick={handleDateClick}
            onPublicationClick={handlePublicationClick}
            onAddPublication={handleAddPublication}
          />
        </div>

        {/* Próximas Publicações - Ocupa 1 coluna */}
        <div>
          <UpcomingPublications
            publications={SAMPLE_PUBLICATIONS}
            categories={DEFAULT_CATEGORIES}
            limit={8}
            onPublicationClick={handlePublicationClick}
          />
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-lg">
        <h3 className="font-semibold text-sm w-full mb-2">Categorias:</h3>
        {DEFAULT_CATEGORIES.map(cat => (
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
