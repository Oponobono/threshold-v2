import { COMMEMORATION_DEFINITIONS } from '../colombiaCommemorations';
import {
  LEGACY_TIE_BREAKS,
  PRESENTATION_PRIORITY,
  compareDayItems,
  getPresentationPriority,
  isMovableLiturgy,
  itemSlug,
  selectDayHeadline,
  selectPrimaryCommemoration,
} from '../commemorations/engine/presentationPriority';
import { clearSpecialDatesCache, getSpecialDaysForYear } from '../specialDatesEngine';
import type { SpecialDateItem } from '../types';
import { CONFLICT_DATE_EXPECTATIONS } from './fixtures/conflictDates.fixture';

const YEARS = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035];

function item(id: string, overrides: Omit<Partial<SpecialDateItem>, 'id'> = {}): SpecialDateItem {
  const base: SpecialDateItem = {
    id,
    name: id,
    category: 'internacional',
    basis: 'onu',
    isHoliday: false,
  };
  return { ...base, ...overrides };
}

/** Índice de declaración de un slug en el catálogo compuesto. */
function declarationIndex(slug: string): number {
  return COMMEMORATION_DEFINITIONS.findIndex((definition) => definition.id === slug);
}

function yearRecords(year: number) {
  clearSpecialDatesCache();
  return getSpecialDaysForYear(year);
}

describe('Política de presentación del calendario', () => {
  beforeEach(() => {
    clearSpecialDatesCache();
  });

  describe('jerarquía de prioridad', () => {
    it('asigna el nivel más alto al festivo oficial', () => {
      const holiday = item('holiday-2026-01-01-Año Nuevo', { category: 'festivo', isHoliday: true });
      expect(getPresentationPriority(holiday)).toBe(PRESENTATION_PRIORITY.officialHoliday);
    });

    it('trata el ancla litúrgica de un festivo trasladado como festivo', () => {
      // San José: el día libre se traslada al lunes, pero el 19 de marzo sigue
      // perteneciendo a la familia del festivo oficial (category: 'festivo').
      const anchor = item('commemoration-2026-03-19-San José', {
        category: 'festivo',
        basis: 'ley',
        isHoliday: false,
        isObservanceMoved: true,
      });
      expect(getPresentationPriority(anchor)).toBe(PRESENTATION_PRIORITY.officialHoliday);
    });

    it('reconoce la liturgia móvil por su regla de calendario', () => {
      const movable = item('commem-2026-03-31-martes-santo', {
        category: 'religiosa',
        basis: 'religiosa',
        dateRule: { type: 'easter-offset', days: -5 },
      });
      expect(isMovableLiturgy(movable)).toBe(true);
      expect(getPresentationPriority(movable)).toBe(PRESENTATION_PRIORITY.movableLiturgy);
    });

    it('no confunde una liturgia de fecha fija con liturgia móvil', () => {
      const fixedLiturgy = item('commem-2026-12-08-inmaculada', {
        category: 'religiosa',
        basis: 'religiosa',
        dateRule: { type: 'fixed', month: 12, day: 8 },
      });
      expect(isMovableLiturgy(fixedLiturgy)).toBe(false);
      expect(getPresentationPriority(fixedLiturgy)).toBe(PRESENTATION_PRIORITY.singleDayObservance);
    });

    it('sitúa la efeméride nacional colombiana por encima de la internacional', () => {
      const national = item('commem-2026-05-15-maestro-colombia', { category: 'nacional', basis: 'tradicion' });
      expect(getPresentationPriority(national)).toBe(PRESENTATION_PRIORITY.colombianCommemoration);
    });

    it('coloca la campaña multidiía por debajo de la observancia de un día', () => {
      const campaign = item('commem-2026-08-07-semana-lactancia', {
        dateRange: { start: '2026-08-01', end: '2026-08-07' },
        dateRule: { type: 'date-range', startMonth: 8, startDay: 1, endMonth: 8, endDay: 7 },
      });
      expect(getPresentationPriority(campaign)).toBe(PRESENTATION_PRIORITY.multiDayCampaign);
    });

    it('mantiene la jerarquía estrictamente creciente', () => {
      const levels = [
        PRESENTATION_PRIORITY.officialHoliday,
        PRESENTATION_PRIORITY.movableLiturgy,
        PRESENTATION_PRIORITY.colombianCommemoration,
        PRESENTATION_PRIORITY.singleDayObservance,
        PRESENTATION_PRIORITY.multiDayCampaign,
      ];
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i]).toBeGreaterThan(levels[i - 1]);
      }
    });
  });

  describe('selectDayHeadline', () => {
    it('devuelve el festivo aunque exista una efeméride nacional en el mismo día', () => {
      const holiday = item('holiday-2026-06-08-Corpus Christi', { category: 'festivo', isHoliday: true });
      const national = item('commem-2026-06-08-estudiante-colombia', { category: 'nacional' });
      expect(selectDayHeadline([holiday, national])?.id).toBe(holiday.id);
    });

    it('sin festivo devuelve la conmemoración de mayor prioridad', () => {
      const international = item('commem-2026-05-15-familias');
      const national = item('commem-2026-05-15-maestro-colombia', { category: 'nacional' });
      expect(selectDayHeadline([international, national])?.id).toBe(national.id);
    });

    it('devuelve null cuando no hay ítems', () => {
      expect(selectDayHeadline([])).toBeNull();
    });
  });

  describe('selectPrimaryCommemoration', () => {
    it('ignora los festivos oficiales', () => {
      const holiday = item('holiday-2026-08-07-Batalla de Boyacá', { category: 'festivo', isHoliday: true });
      const observance = item('commem-2026-08-07-semana-lactancia', {
        dateRange: { start: '2026-08-01', end: '2026-08-07' },
      });
      expect(selectPrimaryCommemoration([holiday, observance])?.id).toBe(observance.id);
    });

    it('devuelve null en un día que solo tiene festivos', () => {
      const holiday = item('holiday-2026-01-01-Año Nuevo', { category: 'festivo', isHoliday: true });
      expect(selectPrimaryCommemoration([holiday])).toBeNull();
    });

    it('aplica la jerarquía por encima del orden recibido', () => {
      const international = item('commem-2026-05-15-familias');
      const national = item('commem-2026-05-15-maestro-colombia', { category: 'nacional' });
      // El internacional llega primero: la jerarquía debe corregirlo.
      expect(selectPrimaryCommemoration([international, national])?.id).toBe(national.id);
    });

    it('conserva el orden recibido cuando el empate no está declarado', () => {
      const first = item('commem-2026-05-20-abejas');
      const second = item('commem-2026-05-20-metrologia');
      expect(compareDayItems(first, second)).toBe(0);
      expect(selectPrimaryCommemoration([first, second])?.id).toBe(first.id);
      expect(selectPrimaryCommemoration([second, first])?.id).toBe(second.id);
    });

    it('no deja que la Novena de Aguinaldos desplace a otra efeméride del mismo nivel', () => {
      const other = item('commem-2026-12-16-algo');
      const novena = item('commem-2026-12-16-novena-dia-1', { category: 'religiosa', basis: 'religiosa' });
      expect(selectPrimaryCommemoration([other, novena])?.id).toBe(other.id);
    });

    it('devuelve la Novena cuando es la única observancia del día', () => {
      const novena = item('commem-2026-12-16-novena-dia-1', { category: 'religiosa', basis: 'religiosa' });
      expect(selectPrimaryCommemoration([novena])?.id).toBe(novena.id);
    });
  });

  describe('empates heredados (decisiones de producto revisables)', () => {
    it('declara exactamente los cuatro empates acordados', () => {
      expect(LEGACY_TIE_BREAKS.map((entry) => [entry.primary, entry.secondary])).toEqual([
        ['autismo', 'libro-infantil'],
        ['prevencion-ahogamientos-onu', 'mujeres-afrodescendientes'],
        ['quimico-farmaceutico-colombia', 'desarme-nuclear'],
        ['rabia-oms', 'acceso-informacion'],
      ]);
    });

    for (const entry of LEGACY_TIE_BREAKS) {
      describe(`${entry.primary} > ${entry.secondary}`, () => {
        const primaryIndex = declarationIndex(entry.primary);
        const secondaryIndex = declarationIndex(entry.secondary);

        it('ambos slugs existen en el catálogo compuesto', () => {
          expect(primaryIndex).toBeGreaterThanOrEqual(0);
          expect(secondaryIndex).toBeGreaterThanOrEqual(0);
        });

        it('comparten nivel, por lo que el orden declarado decidiría el titular', () => {
          const primary = item(`commem-2026-01-01-${entry.primary}`);
          const secondary = item(`commem-2026-01-01-${entry.secondary}`);
          expect(getPresentationPriority(primary)).toBe(getPresentationPriority(secondary));
        });

        it('la excepción sigue siendo determinante (el secundario se declara antes)', () => {
          // Si esta aserción falla, el catálogo se reordenó y la excepción ya no
          // hace falta: retírala de LEGACY_TIE_BREAKS y actualiza el fixture.
          expect(primaryIndex).toBeGreaterThan(secondaryIndex);
        });

        it('el primario gana en cualquier orden de argumentos', () => {
          const primary = item(`commem-2026-01-01-${entry.primary}`);
          const secondary = item(`commem-2026-01-01-${entry.secondary}`);
          expect(compareDayItems(primary, secondary)).toBeLessThan(0);
          expect(compareDayItems(secondary, primary)).toBeGreaterThan(0);
          expect(selectPrimaryCommemoration([primary, secondary])?.id).toBe(primary.id);
          expect(selectPrimaryCommemoration([secondary, primary])?.id).toBe(primary.id);
        });

        it('los dos ítems coinciden realmente en el motor', () => {
          const slugs = new Set<string>();
          for (const year of YEARS) {
            for (const record of yearRecords(year).values()) {
              for (const dayItem of record.items) {
                if (dayItem.id.startsWith('commem-')) slugs.add(itemSlug(dayItem));
              }
            }
          }
          expect(slugs.has(entry.primary)).toBe(true);
          expect(slugs.has(entry.secondary)).toBe(true);
        });
      });
    }
  });

  describe('las 7 fechas en conflicto (fixture 2023–2035)', () => {
    const monthDays = Object.keys(CONFLICT_DATE_EXPECTATIONS);

    it('cubre las siete fechas acordadas', () => {
      expect(monthDays.sort()).toEqual(['04-02', '04-29', '05-15', '06-08', '07-25', '09-26', '09-28']);
    });

    for (const monthDay of monthDays) {
      it(`${monthDay} mantiene el titular registrado`, () => {
        const expectations = CONFLICT_DATE_EXPECTATIONS[monthDay];
        const years = Object.keys(expectations);
        expect(years.length).toBeGreaterThan(0);

        for (const year of years) {
          const record = yearRecords(Number(year)).get(`${year}-${monthDay}`);
          expect(record).toBeDefined();
          if (!record) continue;

          const expected = expectations[year];
          expect(record.items[0]?.id).toBe(expected.headline);
          expect(selectDayHeadline(record.items)?.id).toBe(expected.headline);
          expect(selectPrimaryCommemoration(record.items)?.id).toBe(expected.commemoration);
        }
      });
    }
  });

  describe('cambios deliberados de titular', () => {
    // 31 casos en 2023–2035: consecuencia del nivel "efeméride nacional
    // colombiana", no del reordenamiento de archivos del catálogo.
    // `commemorationDays` incluye un año extra en 06-08: en 2023 encabeza el día
    // el ancla de Corpus Christi, pero el ítem nacional ya lidera las
    // conmemoraciones no festivas (el cuerpo de la notificación).
    const DELIBERATE_CHANGES = [
      {
        monthDay: '04-29',
        previous: 'danza',
        next: 'arbol-colombia',
        headlineChanges: 10,
        commemorationDays: 10,
      },
      {
        monthDay: '05-15',
        previous: 'familias',
        next: 'maestro-colombia',
        headlineChanges: 13,
        commemorationDays: 13,
      },
      {
        monthDay: '06-08',
        previous: 'oceanos',
        next: 'estudiante-colombia',
        headlineChanges: 8,
        commemorationDays: 9,
      },
    ];

    it('afectan exactamente 31 días del rango 2023–2035', () => {
      const total = DELIBERATE_CHANGES.reduce((sum, change) => sum + change.headlineChanges, 0);
      expect(total).toBe(31);
    });

    for (const change of DELIBERATE_CHANGES) {
      it(`${change.monthDay}: ${change.previous} -> ${change.next}`, () => {
        let headlineChanges = 0;
        let commemorationDays = 0;

        for (const year of YEARS) {
          const record = yearRecords(year).get(`${year}-${change.monthDay}`);
          if (!record) continue;

          if (itemSlug(record.items[0]) === change.next) headlineChanges++;

          const primary = selectPrimaryCommemoration(record.items);
          if (!primary) continue;

          const slug = itemSlug(primary);
          if (slug === change.next) {
            commemorationDays++;
            expect(itemSlug(selectDayHeadline(record.items)!)).not.toBe(change.previous);
          } else {
            // El ítem anterior ya no encabeza: lo bloquea un festivo oficial, una
            // liturgia móvil u otra efeméride nacional declarada antes.
            expect(slug).not.toBe(change.previous);
          }
        }

        expect({ headlineChanges, commemorationDays }).toEqual({
          headlineChanges: change.headlineChanges,
          commemorationDays: change.commemorationDays,
        });
      });
    }
  });

  describe('invariantes globales del motor', () => {
    it('el titular del día y selectDayHeadline coinciden en todo el rango', () => {
      let daysChecked = 0;
      for (const year of YEARS) {
        for (const [dateId, record] of yearRecords(year)) {
          daysChecked++;
          expect({ dateId, headline: selectDayHeadline(record.items)?.id }).toEqual({
            dateId,
            headline: record.items[0]?.id,
          });
        }
      }
      expect(daysChecked).toBeGreaterThan(2400);
    });

    it('todo día con festivo oficial está encabezado por ese festivo', () => {
      for (const year of YEARS) {
        for (const [dateId, record] of yearRecords(year)) {
          if (!record.isHoliday) continue;
          expect({ dateId, first: Boolean(record.items[0]?.isHoliday) }).toEqual({ dateId, first: true });
        }
      }
    });

    it('ningún día con varias efemérides está encabezado por la Novena', () => {
      for (const year of YEARS) {
        for (const [dateId, record] of yearRecords(year)) {
          const primary = record.items[0];
          if (!primary || !primary.id.includes('novena-dia')) continue;
          expect({ dateId, itemCount: record.items.length }).toEqual({ dateId, itemCount: 1 });
        }
      }
    });

    it('una campaña multidiía no encabeza un día que tiene otra efeméride no festiva', () => {
      for (const year of YEARS) {
        for (const [dateId, record] of yearRecords(year)) {
          const primary = record.items[0];
          if (!primary || !primary.dateRange || primary.isHoliday) continue;
          const alternatives = record.items.filter((candidate) => !candidate.isHoliday && !candidate.dateRange);
          expect({ dateId, alternatives: alternatives.length }).toEqual({ dateId, alternatives: 0 });
        }
      }
    });

    it('el resultado es determinista entre reconstrucciones', () => {
      const first = yearRecords(2026);
      const snapshot = Array.from(first.entries()).map(([dateId, record]) => [dateId, record.items.map((i) => i.id)]);
      const second = yearRecords(2026);
      const rebuilt = Array.from(second.entries()).map(([dateId, record]) => [dateId, record.items.map((i) => i.id)]);
      expect(rebuilt).toEqual(snapshot);
    });
  });
});
