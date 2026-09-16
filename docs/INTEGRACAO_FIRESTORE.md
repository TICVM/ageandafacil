# Calendário de Publicações - Integração com Firestore

## Visão Geral

O sistema foi atualizado para conectar-se ao banco de dados Firestore existente, substituindo os dados estáticos por operações reais de banco de dados.

## Estrutura de Coleções no Firestore

```
publications/                 # Publicações
├── {id}
│   ├── title: string
│   ├── categoryId: string
│   ├── seriesId?: string
│   ├── publicationDate: string (YYYY-MM-DD)
│   ├── plannedDate?: string
│   ├── status: string
│   ├── priority: string
│   ├── isDeleted: boolean
│   ├── history: array
│   └── ...

publication_categories/       # Categorias
├── {id}
│   ├── name: string
│   ├── color: string
│   └── isActive: boolean

holidays/                     # Feriados
├── {id}
│   ├── name: string
│   ├── date: string (YYYY-MM-DD)
│   ├── year: number
│   ├── type: string
│   └── recurring: boolean

production_deadlines/         # Prazos de Produção
├── {id}
│   ├── categoryId: string
│   ├── seriesId: string
│   ├── daysBefore: number
│   └── active: boolean

publication_series/           # Séries
├── {id}
│   ├── name: string
│   ├── order: number
│   └── isActive: boolean

pedagogical_events/           # Eventos Pedagógicos
├── {id}
│   ├── title: string
│   ├── date: string
│   ├── category: string
│   └── recurring: boolean

calendar_settings/            # Configurações
└── default
    ├── currentYear: number
    └── ...
```

## Hooks Implementados

### usePublications()
- `createPublication(publication)` - Criar nova publicação
- `updatePublication(id, updates, userId)` - Atualizar publicação
- `deletePublication(id)` - Soft delete (marca como excluída)
- `hardDeletePublication(id)` - Exclusão definitiva
- `getPublication(id)` - Obter publicação por ID
- `getPublicationsByYear(year)` - Obter publicações do ano
- `getPublicationsByMonth(year, month)` - Obter publicações do mês
- `getPublicationsByCategory(categoryId, year?)` - Filtrar por categoria
- `getPublicationsBySeries(seriesId, year?)` - Filtrar por série
- `addHistoryEntry(publicationId, entry)` - Adicionar entrada ao histórico
- `duplicatePublication(sourceId, newDate, createdBy)` - Duplicar publicação

### useHolidays()
- `createHoliday(holiday)` - Criar feriado
- `updateHoliday(id, updates)` - Atualizar feriado
- `deleteHoliday(id)` - Excluir feriado
- `getHolidaysByYear(year)` - Obter feriados do ano
- `getAllHolidays()` - Obter todos os feriados
- `getRecurringHolidays()` - Obter feriados recorrentes

### useCategories()
- `createCategory(category)` - Criar categoria
- `updateCategory(id, updates)` - Atualizar categoria
- `deleteCategory(id)` - Excluir categoria
- `getAllCategories()` - Obter todas as categorias
- `getCategoryById(id)` - Obter categoria por ID

### useProductionDeadlines()
- `createDeadline(deadline)` - Criar prazo
- `updateDeadline(id, updates)` - Atualizar prazo
- `deleteDeadline(id)` - Excluir prazo
- `getDeadlinesByCategory(categoryId)` - Obter prazos por categoria
- `getDeadlineByCategoryAndSeries(categoryId, seriesId)` - Obter prazo específico
- `getAllDeadlines()` - Obter todos os prazos

### useSeries()
- `createSeries(series)` - Criar série
- `updateSeries(id, updates)` - Atualizar série
- `deleteSeries(id)` - Excluir série
- `getAllSeries()` - Obter todas as séries (ordenadas)
- `getSeriesById(id)` - Obter série por ID

### usePedagogicalEvents()
- `createEvent(event)` - Criar evento pedagógico
- `updateEvent(id, updates)` - Atualizar evento
- `deleteEvent(id)` - Excluir evento
- `getEventsByYear(year)` - Obter eventos do ano
- `getAllEvents()` - Obter todos os eventos

### useCalendarSettings()
- `getSettings()` - Obter configurações
- `updateSettings(settings)` - Atualizar configurações

## Utilitários Disponíveis

### Cálculo de Dias Úteis
```typescript
import { calculatePlannedDate, addBusinessDays, isBusinessDay } from '@/lib/calendar';

// Calcular data prevista automaticamente
const plannedDate = calculatePlannedDate(
  '2026-08-15',    // Data da publicação
  30,              // Prazo em dias úteis
  holidays         // Array de feriados
);

// Adicionar/subtrair dias úteis
const resultDate = addBusinessDays(startDate, days, holidays, subtract);

// Verificar se é dia útil
const isBizDay = isBusinessDay(date, holidays);
```

### Formatação de Datas
```typescript
import { formatDateForDisplay, formatDateShort, getMonthName } from '@/lib/calendar';

formatDateForDisplay('2026-08-15');  // "15/08/2026"
formatDateShort('2026-08-15');       // "15"
getMonthName(8, 2026);               // "agosto"
```

### Validações
```typescript
import { isValidDate, isPast, isFuture, areDatesEqual } from '@/lib/calendar';

isValidDate('2026-08-15');    // true
isPast('2025-01-01');         // true
isFuture('2027-12-31');       // true
areDatesEqual('2026-08-15', '2026-08-15'); // true
```

### Detecção de Conflitos
```typescript
import { checkDateConflict, isHoliday } from '@/lib/calendar';

// Verificar quantas publicações existem na mesma data
const conflicts = checkDateConflict(publications, newPublication);

// Verificar se data é feriado
const isFeriado = isHoliday('2026-12-25', holidays);
```

## Exemplo de Uso no Componente

```typescript
'use client';

import React, { useEffect, useState } from 'react';
import { 
  usePublications, 
  useHolidays, 
  useCategories 
} from '@/lib/calendar';
import { Publication } from '@/lib/calendar/types';

export default function CalendarComponent() {
  const [year, setYear] = useState(2026);
  const [publications, setPublications] = useState<Publication[]>([]);
  
  const publicationsHook = usePublications();
  const holidaysHook = useHolidays();
  const categoriesHook = useCategories();

  useEffect(() => {
    async function loadData() {
      const pubs = await publicationsHook.getPublicationsByYear(year);
      setPublications(pubs);
    }
    loadData();
  }, [year]);

  const handleCreatePublication = async (data: any) => {
    try {
      await publicationsHook.createPublication({
        ...data,
        createdBy: 'user-id',
        updatedBy: 'user-id'
      });
      // Recarregar dados
    } catch (error) {
      console.error('Erro ao criar:', error);
    }
  };

  return (
    // JSX do componente
  );
}
```

## Regras de Negócio Implementadas

### 1. Cálculo Automático de Data Prevista
- Considera apenas dias úteis (segunda a sexta)
- Ignora feriados cadastrados
- Recalcula automaticamente quando:
  - Data da publicação é alterada
  - Prazo de produção é modificado
  - Feriado é adicionado/removido

### 2. Soft Delete
- Publicações não são excluídas permanentemente
- Campo `isDeleted` marca registros como inativos
- Consultas filtram automaticamente registros excluídos
- Permite restauração se necessário

### 3. Histórico de Alterações
- Toda alteração registra no campo `history`
- Inclui: usuário, data, ação, valores anterior/novo
- Ações: CRIACAO, ALTERACAO, EXCLUSAO, ALTERACAO_STATUS, ALTERACAO_DATA

### 4. Duplicação de Publicações
- Copia dados da publicação original
- Gera nova data prevista baseada no prazo
- Status reiniciado para "PLANEJAMENTO"
- Título recebe sufixo "(Cópia)"

### 5. Múltiplos Anos
- Seletor de ano na interface principal
- Dados filtrados por ano selecionado
- Feriados recorrentes aplicados automaticamente
- Suporte para 2025-2029 (extensível)

## Índices Recomendados no Firestore

Para otimizar as consultas, crie os seguintes índices:

```
Coleção: publications
- publicationDate (ASC), isDeleted (ASC)
- categoryId (ASC), isDeleted (ASC), publicationDate (ASC)
- seriesId (ASC), isDeleted (ASC), publicationDate (ASC)

Coleção: holidays
- year (ASC)
- recurring (ASC)

Coleção: production_deadlines
- categoryId (ASC), active (ASC)
- categoryId (ASC), seriesId (ASC), active (ASC)

Coleção: publication_series
- order (ASC)
```

## Migração de Dados

Para importar dados da planilha Excel:

1. Use o script de importação (a ser implementado)
2. Mapeie as abas para coleções:
   - RT Publicity → publications (categoryId: RT_PUBLICITY)
   - Atividades Variadas → publications (categoryId: ATIVIDADES_VARIADAS)
   - Programa Bilíngue → publications (categoryId: PROGRAMA_BILINGUE)
   - Eventos Pedagógicos → pedagogical_events
   - Feriados → holidays

3. Valide dados antes de importar:
   - Datas em anos diferentes
   - Títulos vazios
   - Séries não reconhecidas
   - Registros duplicados

## Próximos Passos

1. **Formulário de Nova Publicação** - Modal com todos os campos
2. **Modal de Detalhes** - Visualização completa da publicação
3. **Filtros Avançados** - Por categoria, série, status, período
4. **Busca Global** - Pesquisa em tempo real
5. **Importação Excel** - Upload e mapeamento automático
6. **Exportação** - Excel, CSV, PDF
7. **Drag and Drop** - Mover publicações no calendário
8. **Kanban** - Visão de produção por status
9. **Notificações** - Alertas de prazos e atrasos
10. **Relatórios** - Dashboard analítico

## Arquivos Criados/Modificados

```
src/lib/calendar/
├── db-config.ts          # Configuração das coleções (NOVO)
├── index.ts              # Exportações unificadas (NOVO)
├── types.ts              # Tipos TypeScript (EXISTENTE)
├── constants.ts          # Constantes padrão (EXISTENTE)
├── utils.ts              # Funções utilitárias (EXISTENTE)
└── hooks.ts              # Hooks Firestore (ATUALIZADO)

src/app/calendar/
└── page.tsx              # Página principal (ATUALIZADO)
```

## Configuração do Firebase

Certifique-se de que o Firebase está configurado corretamente:

```typescript
// src/firebase/config.ts
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};
```

## Testes

Para testar a integração:

1. Acesse `/calendar`
2. Verifique se os dados são carregados do Firestore
3. Crie uma nova publicação manualmente no Firestore Console
4. Recarregue a página e confirme que aparece no calendário
5. Teste filtros por ano
6. Verifique se feriados estão sendo considerados

## Suporte

Em caso de dúvidas ou problemas, consulte:
- Documentação do Firebase: https://firebase.google.com/docs
- Tipos TypeScript: `src/lib/calendar/types.ts`
- Exemplos de uso: `src/app/calendar/page.tsx`
