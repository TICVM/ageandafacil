import { useFirestore } from '@/firebase';
import { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, Timestamp, orderBy, getDocs, QueryConstraint } from 'firebase/firestore';
import { Publication, Holiday, Category, Series, ProductionDeadline, PublicationHistoryEntry } from '@/lib/calendar/types';
import { COLLECTIONS } from '@/lib/calendar/db-config';

/**
 * Hook para operações de publicações no Firestore
 */
export function usePublications() {
  const db = useFirestore();

  const createPublication = async (publication: Omit<Publication, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    if (!db) throw new Error('Firestore não inicializado');

    const id = doc(collection(db, COLLECTIONS.PUBLICATIONS)).id;
    const now = Timestamp.now();
    
    const historyEntry: PublicationHistoryEntry = {
      timestamp: now.toDate().toISOString(),
      userId: publication.createdBy,
      userName: '',
      action: 'CRIACAO',
      details: 'Publicação criada'
    };

    await setDoc(doc(db, COLLECTIONS.PUBLICATIONS, id), {
      ...publication,
      id,
      createdAt: now,
      updatedAt: now,
      history: [historyEntry],
      isDeleted: false
    });

    return id;
  };

  const updatePublication = async (id: string, updates: Partial<Publication>, userId?: string): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');

    const now = Timestamp.now();
    const historyEntry: PublicationHistoryEntry = {
      timestamp: now.toDate().toISOString(),
      userId: userId || '',
      userName: '',
      action: 'ALTERACAO',
      details: 'Publicação atualizada',
      oldValue: {},
      newValue: updates
    };

    // Obter publicação atual para merge do histórico
    const pubSnap = await getDoc(doc(db, COLLECTIONS.PUBLICATIONS, id));
    if (!pubSnap.exists()) throw new Error('Publicação não encontrada');
    
    const currentPub = pubSnap.data() as Publication;
    const updatedHistory = [...(currentPub.history || []), historyEntry];

    await updateDoc(doc(db, COLLECTIONS.PUBLICATIONS, id), {
      ...updates,
      updatedAt: now,
      history: updatedHistory
    });
  };

  const deletePublication = async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    // Soft delete
    await updateDoc(doc(db, COLLECTIONS.PUBLICATIONS, id), {
      isDeleted: true,
      updatedAt: Timestamp.now()
    });
  };

  const hardDeletePublication = async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await deleteDoc(doc(db, COLLECTIONS.PUBLICATIONS, id));
  };

  const getPublication = async (id: string): Promise<Publication | null> => {
    if (!db) throw new Error('Firestore não inicializado');
    const snap = await getDoc(doc(db, COLLECTIONS.PUBLICATIONS, id));
    return snap.exists() ? snap.data() as Publication : null;
  };

  const getPublicationsByYear = async (year: number): Promise<Publication[]> => {
    if (!db) throw new Error('Firestore não inicializado');
    
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    const q = query(
      collection(db, COLLECTIONS.PUBLICATIONS),
      where('publicationDate', '>=', startDate),
      where('publicationDate', '<=', endDate),
      where('isDeleted', '==', false)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Publication);
  };

  const getPublicationsByMonth = async (year: number, month: number): Promise<Publication[]> => {
    if (!db) throw new Error('Firestore não inicializado');
    
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-31`;
    
    const q = query(
      collection(db, COLLECTIONS.PUBLICATIONS),
      where('publicationDate', '>=', startDate),
      where('publicationDate', '<=', endDate),
      where('isDeleted', '==', false)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Publication);
  };

  const getPublicationsByCategory = async (categoryId: string, year?: number): Promise<Publication[]> => {
    if (!db) throw new Error('Firestore não inicializado');
    
    const constraints: QueryConstraint[] = [
      where('categoryId', '==', categoryId),
      where('isDeleted', '==', false)
    ];
    
    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      constraints.push(where('publicationDate', '>=', startDate));
      constraints.push(where('publicationDate', '<=', endDate));
    }
    
    const q = query(collection(db, COLLECTIONS.PUBLICATIONS), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Publication);
  };

  const getPublicationsBySeries = async (seriesId: string, year?: number): Promise<Publication[]> => {
    if (!db) throw new Error('Firestore não inicializado');
    
    const constraints: QueryConstraint[] = [
      where('seriesId', '==', seriesId),
      where('isDeleted', '==', false)
    ];
    
    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      constraints.push(where('publicationDate', '>=', startDate));
      constraints.push(where('publicationDate', '<=', endDate));
    }
    
    const q = query(collection(db, COLLECTIONS.PUBLICATIONS), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Publication);
  };

  const addHistoryEntry = async (
    publicationId: string,
    entry: Omit<PublicationHistoryEntry, 'timestamp'>
  ): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');

    const pubSnap = await getDoc(doc(db, COLLECTIONS.PUBLICATIONS, publicationId));
    if (!pubSnap.exists()) return;

    const pub = pubSnap.data() as Publication;
    const newHistory: PublicationHistoryEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    await updateDoc(doc(db, COLLECTIONS.PUBLICATIONS, publicationId), {
      history: [...(pub.history || []), newHistory],
      updatedAt: Timestamp.now()
    });
  };

  const duplicatePublication = async (sourceId: string, newPublicationDate: string, createdBy: string): Promise<string> => {
    if (!db) throw new Error('Firestore não inicializado');
    
    const sourcePub = await getPublication(sourceId);
    if (!sourcePub) throw new Error('Publicação original não encontrada');
    
    // Calcular nova data prevista baseada no novo prazo
    const { calculatePlannedDate } = await import('@/lib/calendar/utils');
    const holidaysRef = collection(db, COLLECTIONS.HOLIDAYS);
    const holidaysSnap = await getDocs(holidaysRef);
    const holidays = holidaysSnap.docs.map(doc => doc.data() as Holiday);
    
    const plannedDate = calculatePlannedDate(newPublicationDate, sourcePub.productionDays || 0, holidays);
    
    return createPublication({
      ...sourcePub,
      id: '',
      title: `${sourcePub.title} (Cópia)`,
      publicationDate: newPublicationDate,
      plannedDate,
      status: 'PLANEJAMENTO',
      isRecurring: false,
      createdAt: '',
      updatedAt: '',
      createdBy,
      updatedBy: createdBy,
      history: []
    });
  };

  return {
    createPublication,
    updatePublication,
    deletePublication,
    hardDeletePublication,
    getPublication,
    getPublicationsByYear,
    getPublicationsByMonth,
    getPublicationsByCategory,
    getPublicationsBySeries,
    addHistoryEntry,
    duplicatePublication
  };
}

/**
 * Hook para operações de feriados no Firestore
 */
export function useHolidays() {
  const db = useFirestore();

  const createHoliday = async (holiday: Omit<Holiday, 'id'>): Promise<string> => {
    if (!db) throw new Error('Firestore não inicializado');

    const id = doc(collection(db, COLLECTIONS.HOLIDAYS)).id;
    await setDoc(doc(db, COLLECTIONS.HOLIDAYS, id), {
      ...holiday,
      id
    });

    return id;
  };

  const updateHoliday = async (id: string, updates: Partial<Holiday>): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await updateDoc(doc(db, COLLECTIONS.HOLIDAYS, id), updates);
  };

  const deleteHoliday = async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await deleteDoc(doc(db, COLLECTIONS.HOLIDAYS, id));
  };

  const getHolidaysByYear = async (year: number): Promise<Holiday[]> => {
    if (!db) return [];
    
    const q = query(
      collection(db, COLLECTIONS.HOLIDAYS),
      where('year', '==', year)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Holiday);
  };

  const getAllHolidays = async (): Promise<Holiday[]> => {
    if (!db) return [];
    
    const q = query(collection(db, COLLECTIONS.HOLIDAYS));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Holiday);
  };

  const getRecurringHolidays = async (): Promise<Holiday[]> => {
    if (!db) return [];
    
    const q = query(
      collection(db, COLLECTIONS.HOLIDAYS),
      where('recurring', '==', true)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Holiday);
  };

  return {
    createHoliday,
    updateHoliday,
    deleteHoliday,
    getHolidaysByYear,
    getAllHolidays,
    getRecurringHolidays
  };
}

/**
 * Hook para operações de categorias no Firestore
 */
export function useCategories() {
  const db = useFirestore();

  const createCategory = async (category: Omit<Category, 'id'>): Promise<string> => {
    if (!db) throw new Error('Firestore não inicializado');

    const id = doc(collection(db, COLLECTIONS.CATEGORIES)).id;
    await setDoc(doc(db, COLLECTIONS.CATEGORIES, id), {
      ...category,
      id
    });

    return id;
  };

  const updateCategory = async (id: string, updates: Partial<Category>): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await updateDoc(doc(db, COLLECTIONS.CATEGORIES, id), updates);
  };

  const deleteCategory = async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await deleteDoc(doc(db, COLLECTIONS.CATEGORIES, id));
  };

  const getAllCategories = async (): Promise<Category[]> => {
    if (!db) return [];
    
    const q = query(collection(db, COLLECTIONS.CATEGORIES));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Category);
  };

  const getCategoryById = async (id: string): Promise<Category | null> => {
    if (!db) return null;
    
    const snap = await getDoc(doc(db, COLLECTIONS.CATEGORIES, id));
    return snap.exists() ? snap.data() as Category : null;
  };

  return {
    createCategory,
    updateCategory,
    deleteCategory,
    getAllCategories,
    getCategoryById
  };
}

/**
 * Hook para operações de prazos de produção no Firestore
 */
export function useProductionDeadlines() {
  const db = useFirestore();

  const createDeadline = async (deadline: Omit<ProductionDeadline, 'id'>): Promise<string> => {
    if (!db) throw new Error('Firestore não inicializado');

    const id = doc(collection(db, COLLECTIONS.PRODUCTION_DEADLINES)).id;
    await setDoc(doc(db, COLLECTIONS.PRODUCTION_DEADLINES, id), {
      ...deadline,
      id
    });

    return id;
  };

  const updateDeadline = async (id: string, updates: Partial<ProductionDeadline>): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await updateDoc(doc(db, COLLECTIONS.PRODUCTION_DEADLINES, id), updates);
  };

  const deleteDeadline = async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await deleteDoc(doc(db, COLLECTIONS.PRODUCTION_DEADLINES, id));
  };

  const getDeadlinesByCategory = async (categoryId: string): Promise<ProductionDeadline[]> => {
    if (!db) return [];
    
    const q = query(
      collection(db, COLLECTIONS.PRODUCTION_DEADLINES),
      where('categoryId', '==', categoryId),
      where('active', '==', true)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as ProductionDeadline);
  };

  const getDeadlineByCategoryAndSeries = async (categoryId: string, seriesId: string): Promise<ProductionDeadline | null> => {
    if (!db) return null;
    
    const q = query(
      collection(db, COLLECTIONS.PRODUCTION_DEADLINES),
      where('categoryId', '==', categoryId),
      where('seriesId', '==', seriesId),
      where('active', '==', true)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as ProductionDeadline;
  };

  const getAllDeadlines = async (): Promise<ProductionDeadline[]> => {
    if (!db) return [];
    
    const q = query(collection(db, COLLECTIONS.PRODUCTION_DEADLINES));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as ProductionDeadline);
  };

  return {
    createDeadline,
    updateDeadline,
    deleteDeadline,
    getDeadlinesByCategory,
    getDeadlineByCategoryAndSeries,
    getAllDeadlines
  };
}

/**
 * Hook para operações de séries no Firestore
 */
export function useSeries() {
  const db = useFirestore();

  const createSeries = async (series: Omit<Series, 'id'>): Promise<string> => {
    if (!db) throw new Error('Firestore não inicializado');

    const id = doc(collection(db, COLLECTIONS.SERIES)).id;
    await setDoc(doc(db, COLLECTIONS.SERIES, id), {
      ...series,
      id
    });

    return id;
  };

  const updateSeries = async (id: string, updates: Partial<Series>): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await updateDoc(doc(db, COLLECTIONS.SERIES, id), updates);
  };

  const deleteSeries = async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await deleteDoc(doc(db, COLLECTIONS.SERIES, id));
  };

  const getAllSeries = async (): Promise<Series[]> => {
    if (!db) return [];
    
    const q = query(
      collection(db, COLLECTIONS.SERIES),
      orderBy('order')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Series);
  };

  const getSeriesById = async (id: string): Promise<Series | null> => {
    if (!db) return null;
    
    const snap = await getDoc(doc(db, COLLECTIONS.SERIES, id));
    return snap.exists() ? snap.data() as Series : null;
  };

  return {
    createSeries,
    updateSeries,
    deleteSeries,
    getAllSeries,
    getSeriesById
  };
}

/**
 * Hook para operações de eventos pedagógicos no Firestore
 */
export function usePedagogicalEvents() {
  const db = useFirestore();

  const createEvent = async (event: any): Promise<string> => {
    if (!db) throw new Error('Firestore não inicializado');

    const id = doc(collection(db, COLLECTIONS.PEDAGOGICAL_EVENTS)).id;
    await setDoc(doc(db, COLLECTIONS.PEDAGOGICAL_EVENTS, id), {
      ...event,
      id,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    return id;
  };

  const updateEvent = async (id: string, updates: any): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await updateDoc(doc(db, COLLECTIONS.PEDAGOGICAL_EVENTS, id), {
      ...updates,
      updatedAt: Timestamp.now()
    });
  };

  const deleteEvent = async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await deleteDoc(doc(db, COLLECTIONS.PEDAGOGICAL_EVENTS, id));
  };

  const getEventsByYear = async (year: number): Promise<any[]> => {
    if (!db) return [];
    
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    const q = query(
      collection(db, COLLECTIONS.PEDAGOGICAL_EVENTS),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  };

  const getAllEvents = async (): Promise<any[]> => {
    if (!db) return [];
    
    const q = query(collection(db, COLLECTIONS.PEDAGOGICAL_EVENTS));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  };

  return {
    createEvent,
    updateEvent,
    deleteEvent,
    getEventsByYear,
    getAllEvents
  };
}

/**
 * Hook para operações de configurações do calendário
 */
export function useCalendarSettings() {
  const db = useFirestore();

  const getSettings = async (): Promise<any | null> => {
    if (!db) return null;
    
    const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'default'));
    return snap.exists() ? snap.data() : null;
  };

  const updateSettings = async (settings: any): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await setDoc(doc(db, COLLECTIONS.SETTINGS, 'default'), settings);
  };

  return {
    getSettings,
    updateSettings
  };
}
