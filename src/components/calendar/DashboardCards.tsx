'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CalendarDays, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  FileText,
  TrendingUp,
  CalendarCheck,
  Flag
} from 'lucide-react';
import { Publication, DashboardStats, Category } from '@/lib/calendar/types';
import { isPast, isFuture } from '@/lib/calendar/utils';
import { DEFAULT_CATEGORIES } from '@/lib/calendar/constants';

interface DashboardCardsProps {
  publications: Publication[];
  categories?: Category[];
  onFilterClick?: (filter: string) => void;
}

export function DashboardCards({ 
  publications, 
  categories = DEFAULT_CATEGORIES,
  onFilterClick 
}: DashboardCardsProps) {
  const stats = useMemo(() => calculateStats(publications), [publications]);

  const cards = [
    {
      title: 'Publicações',
      value: stats.totalPublications,
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      description: 'Total de publicações'
    },
    {
      title: 'Este Mês',
      value: stats.publicationsThisMonth,
      icon: CalendarDays,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
      description: 'Publicações este mês'
    },
    {
      title: 'Previstas',
      value: stats.plannedPublications,
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-100',
      description: 'Em planejamento/produção'
    },
    {
      title: 'Concluídas',
      value: stats.completedPublications,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-100',
      description: 'Publicadas'
    },
    {
      title: 'Atrasadas',
      value: stats.delayedPublications,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-100',
      description: 'Fora do prazo'
    },
    {
      title: 'Próx. 7 Dias',
      value: stats.nextWeekPublications,
      icon: CalendarCheck,
      color: 'text-cyan-600',
      bg: 'bg-cyan-100',
      description: 'Próxima semana'
    }
  ];

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <Card 
          key={card.title} 
          className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-all bg-white cursor-pointer"
          onClick={() => onFilterClick && onFilterClick(card.title.toLowerCase())}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  {card.title}
                </p>
                <p className="text-2xl font-bold">{card.value}</p>
              </div>
              <div className={`${card.bg} ${card.color} p-2.5 rounded-xl group-hover:scale-110 transition-transform`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function calculateStats(publications: Publication[]): DashboardStats {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const nextWeek = new Date();
  nextWeek.setDate(now.getDate() + 7);

  const activePublications = publications.filter(p => !p.isDeleted);

  return {
    totalPublications: activePublications.length,
    
    publicationsThisMonth: activePublications.filter(p => {
      const pubDate = new Date(p.publicationDate);
      return pubDate.getMonth() === currentMonth && pubDate.getFullYear() === currentYear;
    }).length,
    
    plannedPublications: activePublications.filter(p => 
      ['PLANEJAMENTO', 'BRIEFING_SOLICITADO', 'BRIEFING_RECEBIDO', 'EM_PRODUCAO', 'EM_REVISAO', 'AGUARDANDO_APROVACAO'].includes(p.status)
    ).length,
    
    completedPublications: activePublications.filter(p => 
      ['PUBLICADO'].includes(p.status)
    ).length,
    
    delayedPublications: activePublications.filter(p => {
      if (['PUBLICADO', 'CANCELADO'].includes(p.status)) return false;
      const pubDate = new Date(p.publicationDate);
      return pubDate < now;
    }).length,
    
    nextWeekPublications: activePublications.filter(p => {
      const pubDate = new Date(p.publicationDate);
      return pubDate >= now && pubDate <= nextWeek;
    }).length,
    
    upcomingEvents: 0,
    upcomingHolidays: 0
  };
}

interface UpcomingPublicationsProps {
  publications: Publication[];
  categories?: Category[];
  limit?: number;
  onPublicationClick?: (publication: Publication) => void;
}

export function UpcomingPublications({ 
  publications, 
  categories = DEFAULT_CATEGORIES,
  limit = 5,
  onPublicationClick 
}: UpcomingPublicationsProps) {
  const upcoming = useMemo(() => {
    const now = new Date();
    return publications
      .filter(p => !p.isDeleted && new Date(p.publicationDate) >= now)
      .sort((a, b) => new Date(a.publicationDate).getTime() - new Date(b.publicationDate).getTime())
      .slice(0, limit);
  }, [publications, limit]);

  const getCategoryColor = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.color || '#95A5A6';
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      'PLANEJAMENTO': 'bg-gray-100 text-gray-700',
      'BRIEFING_SOLICITADO': 'bg-blue-100 text-blue-700',
      'BRIEFING_RECEBIDO': 'bg-blue-200 text-blue-800',
      'EM_PRODUCAO': 'bg-orange-100 text-orange-700',
      'EM_REVISAO': 'bg-yellow-100 text-yellow-700',
      'AGUARDANDO_APROVACAO': 'bg-amber-100 text-amber-700',
      'APROVADO': 'bg-green-100 text-green-700',
      'AGENDADO': 'bg-cyan-100 text-cyan-700',
      'PUBLICADO': 'bg-emerald-100 text-emerald-700',
      'CANCELADO': 'bg-red-100 text-red-700',
      'REPROGRAMADO': 'bg-purple-100 text-purple-700'
    };
    
    const statusNames: Record<string, string> = {
      'PLANEJAMENTO': 'Planejamento',
      'BRIEFING_SOLICITADO': 'Briefing',
      'BRIEFING_RECEBIDO': 'Briefing Recebido',
      'EM_PRODUCAO': 'Em Produção',
      'EM_REVISAO': 'Em Revisão',
      'AGUARDANDO_APROVACAO': 'Aguardando',
      'APROVADO': 'Aprovado',
      'AGENDADO': 'Agendado',
      'PUBLICADO': 'Publicado',
      'CANCELADO': 'Cancelado',
      'REPROGRAMADO': 'Reprogramado'
    };

    return (
      <Badge variant="secondary" className={`text-[10px] ${statusColors[status] || 'bg-gray-100'}`}>
        {statusNames[status] || status}
      </Badge>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Próximas Publicações
        </CardTitle>
        <CardDescription>Publicações programadas para os próximos dias</CardDescription>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma publicação programada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map(pub => (
              <div
                key={pub.id}
                onClick={() => onPublicationClick && onPublicationClick(pub)}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div 
                    className="w-1 h-10 rounded-full"
                    style={{ backgroundColor: getCategoryColor(pub.categoryId) }}
                  />
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{pub.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {new Date(pub.publicationDate).toLocaleDateString('pt-BR')}
                      </span>
                      {pub.seriesId && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">{pub.seriesId}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {getStatusBadge(pub.status)}
                  {pub.priority === 'URGENTE' && (
                    <Flag className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
