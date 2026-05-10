import { create } from 'zustand';
import { Subject, Assessment, Schedule, getSubjects, getAllAssessments, getAllSchedules } from '../services/api';

interface DataState {
  // Datos
  subjects: Subject[];
  assessments: Assessment[];
  schedules: Schedule[];

  // Estado de carga
  isInitialLoading: boolean;
  isRefreshing: boolean;
  hasLoadedOnce: boolean;

  // Acciones (Mutadores globales)
  loadAllData: (forceRefresh?: boolean) => Promise<void>;
  refreshSubjects: () => Promise<void>;
  refreshAssessments: () => Promise<void>;
  refreshSchedules: () => Promise<void>;
}

export const useDataStore = create<DataState>((set, get) => ({
  subjects: [],
  assessments: [],
  schedules: [],

  isInitialLoading: false,
  isRefreshing: false,
  hasLoadedOnce: false,

  loadAllData: async (forceRefresh = false) => {
    const state = get();
    // Previene múltiples llamadas simultáneas
    if (state.isInitialLoading || state.isRefreshing) return;
    
    // Si ya cargó y no forzamos un refresco, salir
    if (state.hasLoadedOnce && !forceRefresh) return;

    if (!state.hasLoadedOnce) {
      set({ isInitialLoading: true });
    } else {
      set({ isRefreshing: true });
    }

    try {
      const [subjectsData, assessmentsData, schedulesData] = await Promise.all([
        getSubjects().catch(() => []),
        getAllAssessments().catch(() => []),
        getAllSchedules().catch(() => [])
      ]);

      set({
        subjects: subjectsData || [],
        assessments: assessmentsData || [],
        schedules: schedulesData || [],
        hasLoadedOnce: true,
      });
    } catch (error) {
      console.error('Error in DataStore loadAllData:', error);
    } finally {
      set({ isInitialLoading: false, isRefreshing: false });
    }
  },

  refreshSubjects: async () => {
    try {
      const data = await getSubjects();
      set({ subjects: data || [] });
    } catch (error) {
      console.error('Error refreshing subjects:', error);
    }
  },

  refreshAssessments: async () => {
    try {
      const data = await getAllAssessments();
      set({ assessments: data || [] });
    } catch (error) {
      console.error('Error refreshing assessments:', error);
    }
  },

  refreshSchedules: async () => {
    try {
      const data = await getAllSchedules();
      set({ schedules: data || [] });
    } catch (error) {
      console.error('Error refreshing schedules:', error);
    }
  }
}));
