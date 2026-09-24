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

export default function CalendarPage() {
const [selectedYear, setSelectedYear] = React.useState(2026);
const [publications, setPublications] = React.useState<Publication[]>([]);
const [autoHolidays, setAutoHolidays] = React.useState<Holiday[]>([]);
const [manualHolidays, setManualHolidays] = React.useState<Holiday[]>([]);
const [allHolidays, setAllHolidays] = React.useState<Holiday[]>([]);
const [categories, setCategories] =
React.useState<Category[]>(DEFAULT_CATEGORIES);
const [series, setSeries] = React.useState(DEFAULT_SERIES);
const [isLoading, setIsLoading] = React.useState(true);
const [selectedPublication, setSelectedPublication] =
React.useState<Publication | null>(null);
const [isFormOpen, setIsFormOpen] = React.useState(false);
const [isEditing, setIsEditing] = React.useState(false);

const publicationsHook = usePublications();
const holidaysHook = useHolidays();
const categoriesHook = useCategories();
const seriesHook = useSeries();

React.useEffect(() => {
const generatedHolidays = generateSaoPauloHolidays(selectedYear).map(
(holiday, index) => ({
...holiday,
id: `AUTO_${selectedYear}_${index}`,
})
);

```
setAutoHolidays(generatedHolidays as Holiday[]);
```

}, [selectedYear]);

React.useEffect(() => {
const merged = mergeHolidays(autoHolidays, manualHolidays);
setAllHolidays(merged);
}, [autoHolidays, manualHolidays]);

React.useEffect(() => {
let isMounted = true;

```
async function loadData() {
  setIsLoading(true);

  try {
    const pubs =
      await publicationsHook.getPublicationsByYear(selectedYear);

    const manualHols =
      await holidaysHook.getHolidaysByYear(selectedYear);

    const cats =
      await categoriesHook.getAllCategories();

    const s =
      await seriesHook.getAllSeries();

    if (!isMounted) return;

    setPublications(pubs);
    setManualHolidays(manualHols);

    if (cats.length > 0) {
      setCategories(cats);
    }

    if (s.length > 0) {
      setSeries(s);
    }
  } catch (error) {
    console.error(
      'Erro ao carregar dados do calendário:',
      error
    );
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
```

}, [
selectedYear,
publicationsHook,
holidaysHook,
categoriesHook,
seriesHook,
]);

const handleAddPublication = React.useCallback(() => {
setIsEditing(false);
setSelectedPublication(null);
setIsFormOpen(true);
}, []);

const handlePublicationClick = React.useCallback(
(publication: Publication) => {
setSelectedPublication(publication);
setIsEditing(true);
setIsFormOpen(true);
},
[]
);

const handleDateClick = React.useCallback(
(date: string) => {
setIsEditing(false);

```
  setSelectedPublication({
    publicationDate: date,
  } as Publication);

  setIsFormOpen(true);
},
[]
```

);

const handleYearChange = React.useCallback(
(year: number) => {
setSelectedYear(year);
},
[]
);

const handleSavePublication = React.useCallback(
async (
publicationData: Omit<
Publication,
'id' | 'createdAt' | 'updatedAt' | 'history'
>
) => {
try {
if (
isEditing &&
selectedPublication?.id
) {
await publicationsHook.updatePublication(
selectedPublication.id,
publicationData
);

```
      console.log(
        'Publicação atualizada com sucesso!'
      );
    } else {
      await publicationsHook.createPublication(
        publicationData
      );

      console.log(
        'Publicação criada com sucesso!'
      );
    }

    const pubs =
      await publicationsHook.getPublicationsByYear(
        selectedYear
      );

    setPublications(pubs);
    setIsFormOpen(false);
    setSelectedPublication(null);
  } catch (error) {
    console.error(
      'Erro ao salvar publicação:',
      error
    );
  }
},
[
  isEditing,
  selectedPublication,
  publicationsHook,
  selectedYear,
]
```

);

if (isLoading) {
return ( <div className="min-h-screen flex items-center justify-center"> <div className="flex flex-col items-center gap-4"> <Loader2 className="w-10 h-10 animate-spin text-primary" />

```
      <p className="text-sm font-medium text-muted-foreground">
        Carregando calendário...
      </p>
    </div>
  </div>
);
```

}

return ( <div className="space-y-8 p-4 md:p-6">

```
  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
    <div>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">
        Calendário de Publicações {selectedYear}
      </h1>

      <p className="text-muted-foreground mt-1">
        Central de planejamento e acompanhamento das
        publicações da escola
      </p>
    </div>

    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <select
        value={selectedYear}
        onChange={(event) =>
          handleYearChange(
            Number(event.target.value)
          )
        }
        aria-label="Selecionar ano"
        className="h-10 px-4 border rounded-md bg-background"
      >
        {[2025, 2026, 2027, 2028, 2029].map(
          (year) => (
            <option
              key={year}
              value={year}
            >
              {year}
            </option>
          )
        )}
      </select>

      <Button
        onClick={handleAddPublication}
        className="gap-2"
      >
        <Plus className="w-4 h-4" />
        Nova Publicação
      </Button>
    </div>
  </div>

  <DashboardCards
    publications={publications}
    categories={categories}
  />

  <div className="grid gap-8 lg:grid-cols-3">
    <div className="lg:col-span-2 min-w-0">
      <CalendarView
        publications={publications}
        categories={categories}
        holidays={allHolidays}
        onDateClick={handleDateClick}
        onPublicationClick={handlePublicationClick}
        onAddPublication={handleAddPublication}
      />
    </div>

    <div className="min-w-0">
      <UpcomingPublications
        publications={publications}
        categories={categories}
        limit={8}
        onPublicationClick={handlePublicationClick}
      />
    </div>
  </div>

  <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-lg">
    <h3 className="font-semibold text-sm w-full mb-2">
      Categorias:
    </h3>

    {categories.map((category) => (
      <div
        key={category.id}
        className="flex items-center gap-2"
      >
        <div
          className="w-4 h-4 rounded"
          style={{
            backgroundColor: category.color,
          }}
        />

        <span className="text-xs">
          {category.name}
        </span>
      </div>
    ))}
  </div>

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
        : undefined
    }
    categories={categories}
    series={series}
    holidays={allHolidays}
  />

</div>
);
}
