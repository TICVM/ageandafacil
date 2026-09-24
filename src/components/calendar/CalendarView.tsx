'use client';

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Filter, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Publication, Category, Holiday } from '@/lib/calendar/types';
import { getDaysInMonth, getMonthName, formatDateShort, getWeekDays, getMonthsInYear } from '@/lib/calendar/utils';
import { DEFAULT_CATEGORIES } from '@/lib/calendar/constants';

interface CalendarViewProps {
  publications: Publication[];
  categories?: Category[];
  holidays?: Holiday[];
  onDateClick?: (date: string) => void;
  onPublicationClick?: (publication: Publication) => void;
  onAddPublication?: () => void;
}

export function CalendarView({
  publications,
  categories = DEFAULT_CATEGORIES,
  holidays = [],
  onDateClick,
  onPublicationClick,
  onAddPublication
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 1));
  const [view, setView] = useState<'month' | 'week' | 'year'>('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const monthsInYear = useMemo(() => getMonthsInYear(year), [year]);

  const weekDayHeaders = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  const getCategoryColor = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.color || '#95A5A6';
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || categoryId;
  };

  const getPublicationsByDate = (day: number, monthIndex: number = month, yearIndex: number = year) => {
    const dateStr = `${yearIndex}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return publications.filter(p => p.publicationDate === dateStr && !p.isDeleted);
  };

  const getPublicationsByFullDate = (dateStr: string) => {
    return publications.filter(p => p.publicationDate === dateStr && !p.isDeleted);
  };

  const isHoliday = (day: number, monthIndex: number = month, yearIndex: number = year): boolean => {
    const dateStr = `${yearIndex}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return holidays.some(h => h.date === dateStr || (h.recurring && h.date.endsWith(`-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)));
  };

  const isWeekend = (dayIndex: number): boolean => {
    return dayIndex === 0 || dayIndex === 6; // Domingo ou Sábado
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else {
      setCurrentDate(new Date(year, month + 1, 1));
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'prev' ? -7 : 7));
    setCurrentDate(newDate);
  };

  const navigateYear = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentDate(new Date(year - 1, 0, 1));
    } else {
      setCurrentDate(new Date(year + 1, 0, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const totalPublicationsThisMonth = useMemo(() => {
    return publications.filter(p => {
      const pubDate = new Date(p.publicationDate);
      return pubDate.getFullYear() === year && pubDate.getMonth() === month && !p.isDeleted;
    }).length;
  }, [publications, year, month]);

  // Render Month View
  const renderMonthView = () => (
    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
      {/* Week day headers */}
      {weekDayHeaders.map(day => (
        <div
          key={day}
          className="bg-muted/50 p-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider"
        >
          {day}
        </div>
      ))}

      {/* Calendar days */}
      {daysInMonth.map((day, index) => {
        const dayOfWeek = index % 7;
        const dayPublications = day ? getPublicationsByDate(day) : [];
        const holidayToday = day ? isHoliday(day) : false;
        const weekendToday = isWeekend(dayOfWeek);
        const dateStr = day 
          ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          : '';

        return (
          <div
            key={index}
            onClick={() => day && onDateClick && onDateClick(dateStr)}
            className={`
              min-h-[120px] p-2 bg-background hover:bg-muted/30 transition-colors cursor-pointer
              ${!day ? 'bg-muted/20' : ''}
              ${weekendToday && day ? 'bg-red-50/50' : ''}
              ${holidayToday && day ? 'bg-red-100/50' : ''}
            `}
          >
            {day && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className={`
                    text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                    ${weekendToday ? 'text-red-500 bg-red-100' : ''}
                    ${holidayToday ? 'text-red-600 bg-red-200' : ''}
                  `}>
                    {day}
                  </span>
                  
                  {holidayToday && (
                    <Badge variant="destructive" className="text-[10px] h-5 px-1">
                      Feriado
                    </Badge>
                  )}
                </div>

                <div className="space-y-1 overflow-y-auto max-h-[80px]">
                  {dayPublications.slice(0, 3).map(pub => (
                    <button
                      key={pub.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPublicationClick && onPublicationClick(pub);
                      }}
                      className="w-full text-left text-xs p-1 rounded truncate transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: getCategoryColor(pub.categoryId) + '20',
                        borderLeft: `3px solid ${getCategoryColor(pub.categoryId)}`
                      }}
                    >
                      <span className="truncate block">{pub.title}</span>
                    </button>
                  ))}
                  
                  {dayPublications.length > 3 && (
                    <div className="text-xs text-muted-foreground pl-2">
                      +{dayPublications.length - 3} mais
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  // Render Week View
  const renderWeekView = () => {
    const weekDaysData = getWeekDays(currentDate);
    
    return (
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
        {/* Week day headers */}
        {weekDayHeaders.map((day, idx) => (
          <div
            key={idx}
            className="bg-muted/50 p-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            {day} {weekDaysData[idx] ? weekDaysData[idx].getDate() : ''}
          </div>
        ))}

        {/* Week days */}
        {weekDaysData.map((date, index) => {
          if (!date) return <div key={index} className="min-h-[200px] bg-muted/20" />;
          
          const day = date.getDate();
          const monthIdx = date.getMonth();
          const yearIdx = date.getFullYear();
          const dateStr = `${yearIdx}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayPublications = getPublicationsByFullDate(dateStr);
          const holidayToday = isHoliday(day, monthIdx, yearIdx);
          const weekendToday = isWeekend(index);

          return (
            <div
              key={index}
              onClick={() => onDateClick && onDateClick(dateStr)}
              className={`
                min-h-[200px] p-2 bg-background hover:bg-muted/30 transition-colors cursor-pointer
                ${weekendToday ? 'bg-red-50/50' : ''}
                ${holidayToday ? 'bg-red-100/50' : ''}
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`
                  text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                  ${weekendToday ? 'text-red-500 bg-red-100' : ''}
                  ${holidayToday ? 'text-red-600 bg-red-200' : ''}
                `}>
                  {day}
                </span>
                
                {holidayToday && (
                  <Badge variant="destructive" className="text-[10px] h-5 px-1">
                    Feriado
                  </Badge>
                )}
              </div>

              <div className="space-y-1 overflow-y-auto max-h-[160px]">
                {dayPublications.map(pub => (
                  <button
                    key={pub.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPublicationClick && onPublicationClick(pub);
                    }}
                    className="w-full text-left text-xs p-1 rounded truncate transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: getCategoryColor(pub.categoryId) + '20',
                      borderLeft: `3px solid ${getCategoryColor(pub.categoryId)}`
                    }}
                  >
                    <span className="truncate block">{pub.title}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render Year View
  const renderYearView = () => (
    <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
      {monthsInYear.map((monthData, monthIndex) => {
        const monthPubs = publications.filter(p => {
          const pubDate = new Date(p.publicationDate);
          return pubDate.getFullYear() === year && pubDate.getMonth() === monthIndex && !p.isDeleted;
        });

        return (
          <Card key={monthIndex} className="overflow-hidden">
            <CardHeader className="py-2 px-3 bg-muted/30">
              <CardTitle className="text-sm font-bold capitalize text-center">
                {getMonthName(monthIndex, year)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="grid grid-cols-7 gap-px">
                {weekDayHeaders.map(day => (
                  <div key={day} className="text-[8px] text-center text-muted-foreground py-1">
                    {day.charAt(0)}
                  </div>
                ))}
                
                {monthData.map((day, index) => {
                  const dayOfWeek = index % 7;
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const dayPubs = day ? monthPubs.filter(p => {
                    const pubDate = new Date(p.publicationDate);
                    return pubDate.getDate() === day;
                  }) : [];
                  const hasHoliday = day ? holidays.some(h => {
                    const hDate = new Date(h.date);
                    return hDate.getMonth() === monthIndex && hDate.getDate() === day;
                  }) : false;

                  return (
                    <div
                      key={index}
                      className={`
                        aspect-square flex items-center justify-center text-[9px] relative
                        ${!day ? '' : 'cursor-pointer hover:bg-muted'}
                        ${isWeekend && day ? 'text-red-500' : ''}
                        ${hasHoliday && day ? 'bg-red-100' : ''}
                      `}
                      onClick={() => {
                        if (day) {
                          const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          onDateClick && onDateClick(dateStr);
                        }
                      }}
                    >
                      {day}
                      {dayPubs.length > 0 && (
                        <div 
                          className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                          style={{ backgroundColor: getCategoryColor(dayPubs[0].categoryId) }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="text-center text-[10px] text-muted-foreground mt-1">
                {monthPubs.length} pub.
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (view === 'month') navigateMonth('prev');
                else if (view === 'week') navigateWeek('prev');
                else navigateYear('prev');
              }}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl font-bold capitalize">
                {view === 'year' ? year : `${getMonthName(month, year)} ${year}`}
              </CardTitle>
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (view === 'month') navigateMonth('next');
                else if (view === 'week') navigateWeek('next');
                else navigateYear('next');
              }}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Hoje
            </Button>
            
            <div className="flex border rounded-md">
              <Button
                variant={view === 'month' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('month')}
                className="rounded-r-none"
              >
                Mês
              </Button>
              <Button
                variant={view === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('week')}
                className="rounded-none"
              >
                Semana
              </Button>
              <Button
                variant={view === 'year' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('year')}
                className="rounded-l-none"
              >
                Ano
              </Button>
            </div>

            <Button size="sm" onClick={onAddPublication}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Publicação
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <Badge variant="secondary" className="text-sm">
            {totalPublicationsThisMonth} publicações este mês
          </Badge>
          
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-1 text-xs">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-muted-foreground">{cat.name}</span>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {view === 'month' && renderMonthView()}
        {view === 'week' && renderWeekView()}
        {view === 'year' && renderYearView()}
      </CardContent>
    </Card>
  );
}
