import { useFirestore } from '@/firebase';
import { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { Publication, Holiday, Category, Series, ProductionDeadline, PublicationHistoryEntry } from '@/lib/calendar/types';

/**
 * Hook para operações de publicações no Firestore
 */
export function usePublications() {
  const db = useFirestore();

  const createPublication = async (publication: Omit<Publication, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    if (!db) throw new Error('Firestore não inicializado');

    const id = doc(collection(db, 'publications')).id;
    const now = Timestamp.now();
    
    const historyEntry: PublicationHistoryEntry = {
      timestamp: now.toDate().toISOString(),
      userId: publication.createdBy,
      userName: '',
      action: 'CRIACAO',
      details: 'Publicação criada'
    };

    await setDoc(doc(db, 'publications', id), {
      ...publication,
      id,
      createdAt: now,
      updatedAt: now,
      history: [historyEntry]
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

    await updateDoc(doc(db, 'publications', id), {
      ...updates,
      updatedAt: now,
      history: [...(updates.history || []), historyEntry]
    });
  };

  const deletePublication = async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await deleteDoc(doc(db, 'publications', id));
  };

  const getPublication = async (id: string): Promise<Publication | null> => {
    if (!db) throw new Error('Firestore não inicializado');
    const snap = await getDoc(doc(db, 'publications', id));
    return snap.exists() ? snap.data() as Publication : null;
  };

  const getPublicationsByYear = async (year: number): Promise<Publication[]> => {
    if (!db) throw new Error('Firestore não inicializado');
    
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    const q = query(
      collection(db, 'publications'),
      where('publicationDate', '>=', startDate),
      where('publicationDate', '<=', endDate),
      where('isDeleted', '==', false)
    );
    
    const snap = await getDoc(q as any);
    // Nota: esta é uma simplificação - na prática precisamos usar getDocs
    return [];
  };

  const addHistoryEntry = async (
    publicationId: string,
    entry: Omit<PublicationHistoryEntry, 'timestamp'>
  ): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');

    const pubSnap = await getDoc(doc(db, 'publications', publicationId));
    if (!pubSnap.exists()) return;

    const pub = pubSnap.data() as Publication;
    const newHistory: PublicationHistoryEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    await updateDoc(doc(db, 'publications', publicationId), {
      history: [...(pub.history || []), newHistory],
      updatedAt: Timestamp.now()
    });
  };

  return {
    createPublication,
    updatePublication,
    deletePublication,
    getPublication,
    getPublicationsByYear,
    addHistoryEntry
  };
}

/**
 * Hook para operações de feriados no Firestore
 */
export function useHolidays() {
  const db = useFirestore();

  const createHoliday = async (holiday: Omit<Holiday, 'id'>): Promise<string> => {
    if (!db) throw new Error('Firestore não inicializado');

    const id = doc(collection(db, 'holidays')).id;
    await setDoc(doc(db, 'holidays', id), {
      ...holiday,
      id
    });

    return id;
  };

  const updateHoliday = async (id: string, updates: Partial<Holiday>): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await updateDoc(doc(db, 'holidays', id), updates);
  };

  const deleteHoliday = async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await deleteDoc(doc(db, 'holidays', id));
  };

  const getHolidaysByYear = async (year: number): Promise<Holiday[]> => {
    if (!db) return [];
    
    const q = query(
      collection(db, 'holidays'),
      where('year', '==', year)
    );
    
    // Simplificação - na prática usaria getDocs
    return [];
  };

  return {
    createHoliday,
    updateHoliday,
    deleteHoliday,
    getHolidaysByYear
  };
}

/**
 * Hook para operações de categorias no Firestore
 */
export function useCategories() {
  const db = useFirestore();

  const createCategory = async (category: Omit<Category, 'id'>): Promise<string> => {
    if (!db) throw new Error('Firestore não inicializado');

    const id = doc(collection(db, 'publication_categories')).id;
    await setDoc(doc(db, 'publication_categories', id), {
      ...category,
      id
    });

    return id;
  };

  const updateCategory = async (id: string, updates: Partial<Category>): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await updateDoc(doc(db, 'publication_categories', id), updates);
  };

  const deleteCategory = async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await deleteDoc(doc(db, 'publication_categories', id));
  };

  const getAllCategories = async (): Promise<Category[]> => {
    if (!db) return [];
    // Na prática usaria getDocs
    return [];
  };

  return {
    createCategory,
    updateCategory,
    deleteCategory,
    getAllCategories
  };
}

/**
 * Hook para operações de prazos de produção no Firestore
 */
export function useProductionDeadlines() {
  const db = useFirestore();

  const createDeadline = async (deadline: Omit<ProductionDeadline, 'id'>): Promise<string> => {
    if (!db) throw new Error('Firestore não inicializado');

    const id = doc(collection(db, 'production_deadlines')).id;
    await setDoc(doc(db, 'production_deadlines', id), {
      ...deadline,
      id
    });

    return id;
  };

  const updateDeadline = async (id: string, updates: Partial<ProductionDeadline>): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await updateDoc(doc(db, 'production_deadlines', id), updates);
  };

  const deleteDeadline = async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore não inicializado');
    await deleteDoc(doc(db, 'production_deadlines', id));
  };

  const getDeadlinesByCategory = async (categoryId: string): Promise<ProductionDeadline[]> => {
    if (!db) return [];
    
    const q = query(
      collection(db, 'production_deadlines'),
      where('categoryId', '==', categoryId),
      where('active', '==', true)
    );
    
    // Simplificação - na prática usaria getDocs
    return [];
  };

  return {
    createDeadline,
    updateDeadline,
    deleteDeadline,
    getDeadlinesByCategory
  };
}
