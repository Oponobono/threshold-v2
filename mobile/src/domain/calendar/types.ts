/**
 * types.ts
 *
 * Contratos de tipos para el motor de días festivos y fechas especiales de Colombia.
 * Dominio puro: sin dependencias de React, SQLite ni red.
 */

export type SpecialDateCategory =
  | 'festivo'        // Festivos oficiales nacionales (Ley 51 de 1983 / decretos) - Siempre activos
  | 'religiosa'      // Tradición católica ampliamente reconocida (Semana Santa, santos patrones, etc.)
  | 'nacional'       // Cívicas, patrias, de memoria y culturales de Colombia
  | 'educacion'      // Fechas educativas, científicas y profesionales (ingeniería, docencia, etc.)
  | 'internacional'; // ONU/UNESCO con amplia presencia y observancia en Colombia

export type SpecialDateBasis =
  | 'ley'        // Ley de la República, decreto presidencial o norma oficial
  | 'religiosa'  // Calendario litúrgico católico / tradición eclesiástica
  | 'onu'        // Organismos multilaterales (ONU, UNESCO, OMS, etc.)
  | 'gremial'    // Reconocimiento gremial / asociaciones profesionales
  | 'tradicion'  // Costumbre cultural arraigada en Colombia
  | 'comercial'; // Fecha de observancia comercial/popular

export interface SpecialSubItem {
  readonly title: string;
  readonly description?: string;
}

export interface SpecialDateItem {
  readonly id: string;
  readonly name: string;
  readonly category: SpecialDateCategory;
  readonly basis: SpecialDateBasis;
  /** true si es un festivo oficial no laborable según la ley */
  readonly isHoliday: boolean;
  /** true si la conmemoración original fue trasladada a otra fecha por la Ley Emiliani */
  readonly isObservanceMoved?: boolean;
  /** Identificador 'YYYY-MM-DD' donde se disfruta el festivo oficial */
  readonly observedDateId?: string;
  /** Identificador 'YYYY-MM-DD' de la fecha conmemorativa original si fue trasladada */
  readonly originalDateId?: string;
  /** Nota o contexto breve explicando por qué es especial la fecha */
  readonly note?: string;
  /** Ícono específico representativo de la conmemoración */
  readonly icon?: string;
  /** Familia de íconos ('material' por defecto o 'ionicons') */
  readonly iconFamily?: 'material' | 'ionicons';
  /** Sub-elementos detallados (ej. conmemoraciones litúrgicas día a día de Semana Santa) */
  readonly subItems?: readonly SpecialSubItem[];
}

export interface SpecialDayRecord {
  readonly dateId: string; // 'YYYY-MM-DD'
  readonly isHoliday: boolean;
  readonly holidayName?: string;
  readonly items: readonly SpecialDateItem[];
}

export interface SpecialDatesPreferences {
  readonly enabledCategories: {
    readonly religiosa: boolean;
    readonly nacional: boolean;
    readonly educacion: boolean;
    readonly internacional: boolean;
  };
}

export const DEFAULT_SPECIAL_DATES_PREFERENCES: SpecialDatesPreferences = {
  enabledCategories: {
    religiosa: true,
    nacional: true,
    educacion: true,
    internacional: true,
  },
};

export interface SpecialDateOverride {
  readonly id: string;
  readonly date: string; // 'YYYY-MM-DD'
  readonly name: string;
  readonly category: SpecialDateCategory;
  readonly basis: SpecialDateBasis;
  readonly action: 'add' | 'remove' | 'rename';
  readonly isHoliday?: boolean;
  readonly description?: string;
  readonly validFrom?: string; // 'YYYY-MM-DD'
  readonly validTo?: string;   // 'YYYY-MM-DD'
  readonly source?: string;
  readonly version?: number;
}
