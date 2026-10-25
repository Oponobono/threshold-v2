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

export type DateRule =
  | { readonly type: 'fixed'; readonly month: number; readonly day: number }
  | { readonly type: 'nth-weekday'; readonly month: number; readonly weekday: number; readonly occurrence: number }
  | { readonly type: 'last-weekday'; readonly month: number; readonly weekday: number }
  | { readonly type: 'easter-offset'; readonly days: number }
  | { readonly type: 'day-of-year'; readonly day: number; readonly leapYearPolicy?: 'calendar-day-256' }
  | { readonly type: 'date-range'; readonly startMonth: number; readonly startDay: number; readonly endMonth: number; readonly endDay: number };

export type CommemorationStatus = 'verified' | 'needs-review' | 'deprecated' | 'historical';

export interface CommemorationDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: SpecialDateCategory;
  readonly basis: SpecialDateBasis;
  readonly dateRule: DateRule;
  readonly authority?: string;
  readonly sourceUrl?: string;
  readonly sourceId?: string;
  readonly status?: CommemorationStatus;
  readonly verifiedAt?: string;
  readonly validFromYear?: number;
  readonly validUntilYear?: number;
  readonly note: string;
  readonly icon: string;
  readonly iconFamily?: 'material' | 'ionicons';
  readonly subItems?: readonly SpecialSubItem[];
}

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
  /** Entidad u organismo que respalda o proclama la fecha (ej. ONU, OMS, UNESCO, Congreso de la República) */
  readonly authority?: string;
  /** Identificador de referencia de la fuente documental o normativa */
  readonly sourceId?: string;
  /** Enlace o URL de referencia oficial */
  readonly sourceUrl?: string;
  /** Estado de verificación del evento */
  readonly status?: CommemorationStatus;
  /** Fecha en que se auditó y validó la fuente documental */
  readonly verifiedAt?: string;
  /** Año desde el cual entra en vigor la observancia */
  readonly validFromYear?: number;
  /** Año hasta el cual estuvo en vigor la observancia */
  readonly validUntilYear?: number;
  /** Rango de fechas si la observancia abarca varios días (ej. semanas internacionales) */
  readonly dateRange?: { readonly start: string; readonly end: string };
  /**
   * Regla de calendario que originó la fecha. La puebla el catálogo de
   * conmemoraciones para que la política de presentación pueda distinguir una
   * liturgia móvil (regla `easter-offset`) sin duplicar el catálogo.
   */
  readonly dateRule?: DateRule;
}

export interface SpecialDayRecord {
  readonly dateId: string; // 'YYYY-MM-DD'
  readonly isHoliday: boolean;
  readonly holidayName?: string;
  readonly items: readonly SpecialDateItem[];
}

export interface SpecialDatesPreferences {
  /** true si se muestran los festivos oficiales de Colombia en la cuadrícula y tarjeta */
  readonly showHolidays?: boolean;
  /** true si se muestran las conmemoraciones/efemérides en la tarjeta */
  readonly showSpecialDates?: boolean;
  readonly enabledCategories: {
    readonly religiosa: boolean;
    readonly nacional: boolean;
    readonly educacion: boolean;
    readonly internacional: boolean;
  };
}

export const DEFAULT_SPECIAL_DATES_PREFERENCES: SpecialDatesPreferences = {
  showHolidays: true,
  showSpecialDates: true,
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
