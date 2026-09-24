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
    
    try {
      const q = query(
        collection(db, COLLECTIONS.PUBLICATIONS),
        where('publicationDate', '>=', startDate),
        where('publicationDate', '<=', endDate)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => doc.data() as Publication)
        .filter(pub => pub.isDeleted !== true);
    } catch (err: any) {
      console.warn('Fallback para getPublicationsByYear:', err);
      const snapshot = await getDocs(collection(db, COLLECTIONS.PUBLICATIONS));
      return snapshot.docs
        .map(doc => doc.data() as Publication)
        .filter(pub => pub.isDeleted !== true && pub.publicationDate >= startDate && pub.publicationDate <= endDate);
    }
  };

  const getPublicationsByMonth = async (year: number, month: number): Promise<Publication[]> => {
    if (!db) throw new Error('Firestore não inicializado');
    
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-31`;
    
    try {
      const q = query(
        collection(db, COLLECTIONS.PUBLICATIONS),
        where('publicationDate', '>=', startDate),
        where('publicationDate', '<=', endDate)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => doc.data() as Publication)
        .filter(pub => pub.isDeleted !== true);
    } catch (err: any) {
      console.warn('Fallback para getPublicationsByMonth:', err);
      const snapshot = await getDocs(collection(db, COLLECTIONS.PUBLICATIONS));
      return snapshot.docs
        .map(doc => doc.data() as Publication)
        .filter(pub => pub.isDeleted !== true && pub.publicationDate >= startDate && pub.publicationDate <= endDate);
    }
  };

  const getPublicationsByCategory = async (categoryId: string, year?: number): Promise<Publication[]> => {
    if (!db) throw new Error('Firestore não inicializado');
    
    try {
      const q = query(
        collection(db, COLLECTIONS.PUBLICATIONS),
        where('categoryId', '==', categoryId)
      );
      const snapshot = await getDocs(q);
      const startDate = year ? `${year}-01-01` : null;
      const endDate = year ? `${year}-12-31` : null;

      return snapshot.docs
        .map(doc => doc.data() as Publication)
        .filter(pub => {
          if (pub.isDeleted) return false;
          if (startDate && endDate) {
            return pub.publicationDate >= startDate && pub.publicationDate <= endDate;
          }
          return true;
        });
    } catch (err: any) {
      console.warn('Fallback para getPublicationsByCategory:', err);
      const snapshot = await getDocs(collection(db, COLLECTIONS.PUBLICATIONS));
      const startDate = year ? `${year}-01-01` : null;
      const endDate = year ? `${year}-12-31` : null;

      return snapshot.docs
        .map(doc => doc.data() as Publication)
        .filter(pub => {
          if (pub.isDeleted || pub.categoryId !== categoryId) return false;
          if (startDate && endDate) {
            return pub.publicationDate >= startDate && pub.publicationDate <= endDate;
          }
          return true;
        });
    }
  };

  const getPublicationsBySeries = async (seriesId: string, year?: number): Promise<Publication[]> => {
    if (!db) throw new Error('Firestore não inicializado');
    
    try {
      const q = query(
        collection(db, COLLECTIONS.PUBLICATIONS),
        where('seriesId', '==', seriesId)
      );
      const snapshot = await getDocs(q);
      const startDate = year ? `${year}-01-01` : null;
      const endDate = year ? `${year}-12-31` : null;

      return snapshot.docs
        .map(doc => doc.data() as Publication)
        .filter(pub => {
          if (pub.isDeleted) return false;
          if (startDate && endDate) {
            return pub.publicationDate >= startDate && pub.publicationDate <= endDate;
          }
          return true;
        });
    } catch (err: any) {
      console.warn('Fallback para getPublicationsBySeries:', err);
      const snapshot = await getDocs(collection(db, COLLECTIONS.PUBLICATIONS));
      const startDate = year ? `${year}-01-01` : null;
      const endDate = year ? `${year}-12-31` : null;

      return snapshot.docs
        .map(doc => doc.data() as Publication)
        .filter(pub => {
          if (pub.isDeleted || pub.seriesId !== seriesId) return false;
          if (startDate && endDate) {
            return pub.publicationDate >= startDate && pub.publicationDate <= endDate;
          }
          return true;
        });
    }
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
    
    const { id: _unusedId, createdAt: _unusedCreated, updatedAt: _unusedUpdated, ...restSource } = sourcePub;
    
    return createPublication({
      ...restSource,
      title: `${sourcePub.title} (Cópia)`,
      publicationDate: newPublicationDate,
      plannedDate,
      status: 'PLANEJAMENTO',
      isRecurring: false,
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
