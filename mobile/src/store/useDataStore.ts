import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Subject, Assessment, Schedule, getSubjects, getAllAssessments, getAllSchedules } from '../services/api';
import { zustandMMKVStorage } from '../services/storage/mmkvStorage';

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

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
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

        // Cache-first: si ya hay datos persistidos en MMKV, refrescamos en background
        // sin mostrar ningún spinner — los datos viejos se ven de inmediato.
        const alreadyHasData = state.subjects.length > 0;
        if (alreadyHasData) {
          set({ isRefreshing: true });
        } else {
          set({ isInitialLoading: true });
        }

        try {
          const [subjectsData, assessmentsData, schedulesData] = await Promise.all([
            getSubjects().catch(() => get().subjects),
            getAllAssessments().catch(() => get().assessments),
            getAllSchedules().catch(() => get().schedules),
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
      },
    }),
    {
      name: 'threshold-global-store', // Clave en MMKV
      storage: createJSONStorage(() => zustandMMKVStorage),
      // Solo persistimos los datos, NO los flags de carga (se resetean en cada sesión)
      partialize: (state) => ({
        subjects: state.subjects,
        assessments: state.assessments,
        schedules: state.schedules,
        hasLoadedOnce: state.hasLoadedOnce,
      }),
    }
  )
);
