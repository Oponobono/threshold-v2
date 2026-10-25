import { getEasterSunday } from '../easter';
import { getColombiaHolidays } from '../colombiaHolidays';
import {
  getSpecialDaysForYear,
  isColombianHoliday,
  getSpecialDayRecord,
  getMonthHolidayDaysSet,
  clearSpecialDatesCache,
} from '../specialDatesEngine';
import { SpecialDateOverride, CommemorationDefinition } from '../types';
import {
  resolveDefinition,
  getNthWeekdayOfMonth,
  getLastWeekdayOfMonth,
} from '../colombiaCommemorations';

describe('Colombia Special Dates & Holidays Domain', () => {
  beforeEach(() => {
    clearSpecialDatesCache();
  });

  describe('Computus Eclesiástico (Meeus/Jones/Butcher)', () => {
    it('calcula correctamente la Pascua para años con Pascua en marzo y abril', () => {
      // 2024: 31 de marzo
      const e2024 = getEasterSunday(2024);
      expect(e2024.dateId).toBe('2024-03-31');

      // 2025: 20 de abril
      const e2025 = getEasterSunday(2025);
      expect(e2025.dateId).toBe('2025-04-20');

      // 2026: 5 de abril
      const e2026 = getEasterSunday(2026);
      expect(e2026.dateId).toBe('2026-04-05');

      // 2027: 28 de marzo (caso de contorno: Pascua temprana en marzo)
      const e2027 = getEasterSunday(2027);
      expect(e2027.dateId).toBe('2027-03-28');

      // 2030: 21 de abril (año futuro)
      const e2030 = getEasterSunday(2030);
      expect(e2030.dateId).toBe('2030-04-21');
    });
  });

  describe('19 Festivos Oficiales de Colombia (Ley 51 de 1983 y Ley 2578 de 2026)', () => {
    it('genera exactamente 19 festivos por año (2024, 2025, 2026, 2027)', () => {
      for (const year of [2024, 2025, 2026, 2027]) {
        const holidays = getColombiaHolidays(year);
        expect(holidays).toHaveLength(19);
      }
    });

    it('coincide exactamente con el calendario oficial de Colombia para 2026 (19 festivos, 12 en lunes)', () => {
      const holidays2026 = getColombiaHolidays(2026);
      expect(holidays2026).toHaveLength(19);

      const observedDates = holidays2026.map(h => h.observedDateId);
      const expectedDates2026 = [
        '2026-01-01', // Año Nuevo
        '2026-01-12', // Reyes Magos (trasladado)
        '2026-03-23', // San José (trasladado)
        '2026-04-02', // Jueves Santo
        '2026-04-03', // Viernes Santo
        '2026-05-01', // Día del Trabajo
        '2026-05-18', // Ascensión del Señor
        '2026-06-08', // Corpus Christi
        '2026-06-15', // Sagrado Corazón
        '2026-06-29', // San Pedro y San Pablo (ya era lunes)
        '2026-07-13', // Virgen de Chiquinquirá (Ley 2578 de 2026 - trasladado del 9 de julio)
        '2026-07-20', // Independencia (ya era lunes)
        '2026-08-07', // Batalla de Boyacá
        '2026-08-17', // Asunción de la Virgen
        '2026-10-12', // Día de la Raza (ya era lunes)
        '2026-11-02', // Todos los Santos
        '2026-11-16', // Independencia de Cartagena
        '2026-12-08', // Inmaculada Concepción
        '2026-12-25', // Navidad
      ];

      expect(observedDates).toEqual(expectedDates2026);

      // Verificar que exactamente 12 caen en lunes (day of week === 1 en UTC)
      const mondayHolidays = observedDates.filter(d => {
        const [y, m, day] = d.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, day)).getUTCDay() === 1;
      });
      expect(mondayHolidays).toHaveLength(12);
    });

    it('regla Emiliani: si la fecha original ya cae en lunes, se queda en ese lunes y no se traslada', () => {
      const holidays2026 = getColombiaHolidays(2026);

      // San Pedro y San Pablo: 29 de junio de 2026 ya es lunes
      const sanPedro = holidays2026.find(h => h.name === 'San Pedro y San Pablo');
      expect(sanPedro).toBeDefined();
      expect(sanPedro!.isMoved).toBe(false);
      expect(sanPedro!.observedDateId).toBe('2026-06-29');

      // 20 de julio de 2026 ya es lunes (fiesta fija)
      const independencia = holidays2026.find(h => h.name === 'Día de la Independencia');
      expect(independencia!.isMoved).toBe(false);
      expect(independencia!.observedDateId).toBe('2026-07-20');

      // Día de la Raza: 12 de octubre de 2026 ya es lunes
      const diaRaza = holidays2026.find(h => h.name === 'Día de la Raza');
      expect(diaRaza!.isMoved).toBe(false);
      expect(diaRaza!.observedDateId).toBe('2026-10-12');
    });

    it('distingue la fecha conmemorada de la fecha de observancia oficial', () => {
      const yearIndex = getSpecialDaysForYear(2026);

      // El 19 de marzo de 2026 (jueves): fecha conmemorativa original de San José
      const originalRecord = yearIndex.get('2026-03-19');
      expect(originalRecord).toBeDefined();
      expect(originalRecord!.isHoliday).toBe(false); // NO es festivo oficial no laborable
      const sanJoseCommem = originalRecord!.items.find(i => i.name.includes('San José'));
      expect(sanJoseCommem).toBeDefined();
      expect(sanJoseCommem!.isObservanceMoved).toBe(true);
      expect(sanJoseCommem!.note).toContain('El festivo oficial se traslada al lunes 23 de marzo');

      // El 23 de marzo de 2026 (lunes): día festivo oficial no laborable
      const observedRecord = yearIndex.get('2026-03-23');
      expect(observedRecord).toBeDefined();
      expect(observedRecord!.isHoliday).toBe(true);
      expect(observedRecord!.holidayName).toContain('San José');
    });
  });

  describe('Semana Santa y Fechas Curadas de Colombia', () => {
    it('incluye conmemoraciones de Semana Santa con sub-items litúrgicos consolidados', () => {
      const yearIndex = getSpecialDaysForYear(2026);

      // Jueves Santo 2026: 2 de abril
      const juevesRecord = yearIndex.get('2026-04-02');
      expect(juevesRecord).toBeDefined();
      expect(juevesRecord!.isHoliday).toBe(true);
      const juevesItem = juevesRecord!.items.find(i => i.name.includes('Jueves Santo'));
      expect(juevesItem).toBeDefined();
      expect(juevesItem!.subItems).toBeDefined();
      expect(juevesItem!.subItems!.length).toBeGreaterThan(0);
      expect(juevesItem!.subItems![0].title).toContain('Institución de la Eucaristía');

      // Domingo de Ramos: 29 de marzo de 2026
      const ramosRecord = yearIndex.get('2026-03-29');
      expect(ramosRecord).toBeDefined();
      expect(ramosRecord!.items.some(i => i.name.includes('Domingo de Ramos'))).toBe(true);
    });

    it('Día Nacional del Árbol se fija el 29 de abril con Decreto 1333 de 1942', () => {
      const yearIndex = getSpecialDaysForYear(2026);
      const arbolRecord = yearIndex.get('2026-04-29');
      expect(arbolRecord).toBeDefined();
      const arbol = arbolRecord!.items.find(i => i.name === 'Día Nacional del Árbol');
      expect(arbol).toBeDefined();
      expect(arbol!.basis).toBe('ley');
      expect(arbol!.note).toContain('Árbol de la Libertad');
      expect(arbol!.icon).toBe('tree');
      expect(arbol!.name).not.toContain('Internacional');
    });

    it('Día del Ingeniero en Colombia se fija el 17 de agosto sin atribución a la SCI, e incluye el 4 de marzo de la UNESCO', () => {
      const yearIndex = getSpecialDaysForYear(2026);

      // 17 de Agosto
      const ingRecord = yearIndex.get('2026-08-17');
      expect(ingRecord).toBeDefined();
      const ingCol = ingRecord!.items.find(i => i.name === 'Día del Ingeniero en Colombia');
      expect(ingCol).toBeDefined();
      expect(ingCol!.basis).toBe('gremial');
      expect(ingCol!.note).not.toContain('Sociedad Colombiana de Ingenieros');

      // 4 de Marzo: Día Mundial de la Ingeniería para el Desarrollo Sostenible
      const unescoIngRecord = yearIndex.get('2026-03-04');
      expect(unescoIngRecord).toBeDefined();
      const ingUnesco = unescoIngRecord!.items.find(i => i.name.includes('Día Mundial de la Ingeniería'));
      expect(ingUnesco).toBeDefined();
      expect(ingUnesco!.basis).toBe('onu');
    });

    it('Día del Hombre incluye 19 de marzo (tradición colombiana) y 19 de noviembre (internacional ONU)', () => {
      const yearIndex = getSpecialDaysForYear(2026);

      // 19 de marzo
      const mar19 = yearIndex.get('2026-03-19');
      expect(mar19!.items.some(i => i.name === 'Día del Hombre en Colombia')).toBe(true);

      // 19 de noviembre
      const nov19 = yearIndex.get('2026-11-19');
      expect(nov19!.items.some(i => i.name === 'Día Internacional del Hombre')).toBe(true);
    });

    it('San Valentín se incluye el 14 de febrero como conmemoración secundaria', () => {
      const yearIndex = getSpecialDaysForYear(2026);
      const feb14 = yearIndex.get('2026-02-14');
      expect(feb14!.items.some(i => i.name.includes('San Valentín'))).toBe(true);

      // Celebración principal: Día del Amor y la Amistad (3er sábado de septiembre)
      // En 2026, septiembre inicia en martes (1), sábados son 5, 12, 19
      const amorRecord = yearIndex.get('2026-09-19');
      expect(amorRecord!.items.some(i => i.name.includes('Día del Amor y la Amistad'))).toBe(true);
    });

    it('Día de la Madre (2º domingo de mayo) y Día del Padre (3º domingo de junio)', () => {
      const yearIndex = getSpecialDaysForYear(2026);

      // En mayo 2026: 1 de mayo es viernes. Domingos: 3 de mayo (1º), 10 de mayo (2º)
      const madreRecord = yearIndex.get('2026-05-10');
      expect(madreRecord!.items.some(i => i.name.includes('Día de la Madre'))).toBe(true);

      // En junio 2026: 1 de junio es lunes. Domingos: 7 de junio (1º), 14 de junio (2º), 21 de junio (3º)
      const padreRecord = yearIndex.get('2026-06-21');
      expect(padreRecord!.items.some(i => i.name.includes('Día del Padre'))).toBe(true);
    });

    it('Día de la Niñez se celebra el último sábado de abril', () => {
      const yearIndex = getSpecialDaysForYear(2026);
      // En abril 2026: 30 de abril es jueves. Último sábado: 25 de abril
      const ninaRecord = yearIndex.get('2026-04-25');
      expect(ninaRecord!.items.some(i => i.name.includes('Día de la Niñez'))).toBe(true);
    });
  });

  describe('Consultas O(1) de Alto Rendimiento', () => {
    it('isColombianHoliday devuelve true para festivos y false para días laborables', () => {
      expect(isColombianHoliday('2026-01-01')).toBe(true);
      expect(isColombianHoliday('2026-01-12')).toBe(true);
      expect(isColombianHoliday('2026-01-02')).toBe(false);
      expect(isColombianHoliday('2026-03-19')).toBe(false); // Fecha conmemorativa, festivo pasó al 23
      expect(isColombianHoliday('2026-03-23')).toBe(true);  // Festivo oficial
    });

    it('getMonthHolidayDaysSet retorna el Set de días del mes correctamente', () => {
      // Mayo 2026 (mes 4): festivos el día 1 (Trabajo) y el día 18 (Ascensión)
      const mayHolidays = getMonthHolidayDaysSet(2026, 4);
      expect(mayHolidays.has(1)).toBe(true);
      expect(mayHolidays.has(18)).toBe(true);
      expect(mayHolidays.size).toBe(2);
    });

    it('getSpecialDayRecord resuelve cruces de año', () => {
      const rec = getSpecialDayRecord('2025-12-25');
      expect(rec).toBeDefined();
      expect(rec!.isHoliday).toBe(true);
      expect(rec!.holidayName).toBe('Navidad');
    });
  });

  describe('Preferencias por Categoría y Overrides Remotos', () => {
    it('desactivar una categoría remueve sus conmemoraciones pero NUNCA desactiva festivos oficiales', () => {
      const filteredIndex = getSpecialDaysForYear(2026, {
        preferences: {
          enabledCategories: {
            religiosa: false,
            nacional: true,
            educacion: true,
            internacional: true,
          },
        },
      });

      // Miércoles de Ceniza (religiosa pura) no debe estar
      const cenizaRecord = filteredIndex.get('2026-02-18');
      expect(cenizaRecord?.items.some(i => i.name.includes('Ceniza'))).toBeFalsy();

      // Jueves Santo (festivo oficial por ley) SIGUE ACTIVO como festivo
      const juevesRecord = filteredIndex.get('2026-04-02');
      expect(juevesRecord).toBeDefined();
      expect(juevesRecord!.isHoliday).toBe(true);
    });

    it('aplica overrides (ej. día cívico decretado por presidencia)', () => {
      const overrides: SpecialDateOverride[] = [
        {
          id: 'dia-civico-paz',
          date: '2026-04-17',
          name: 'Día Cívico de la Paz con la Naturaleza',
          category: 'nacional',
          basis: 'ley',
          action: 'add',
          isHoliday: true,
          description: 'Decreto presidencial',
        },
      ];

      const indexWithOverride = getSpecialDaysForYear(2026, { overrides });
      const record = indexWithOverride.get('2026-04-17');
      expect(record).toBeDefined();
      expect(record!.isHoliday).toBe(true);
      expect(record!.items[0].name).toContain('Día Cívico');
    });
  });

  describe('Iconografía Emotiva y Libre de Conflictos', () => {
    it('todas las fechas tienen ícono y ninguna usa sparkles (reservado para IA) ni personas genéricas', () => {
      const yearIndex = getSpecialDaysForYear(2026);
      let totalItems = 0;

      for (const record of yearIndex.values()) {
        for (const item of record.items) {
          totalItems++;
          expect(item.icon).toBeDefined();
          expect(item.iconFamily).toBe('material');

          // Prohibido terminantemente usar sparkles (reservado para botón "Procesar clase" de IA)
          expect(item.icon).not.toContain('sparkles');
          // Prohibido usar siluetas genéricas tipo Messenger de 2 personas
          expect(item.icon).not.toBe('people-outline');
        }
      }

      expect(totalItems).toBeGreaterThan(50);
    });

    it('asigna íconos de alto impacto emocional y pertinencia cultural a fechas emblemáticas', () => {
      const yearIndex = getSpecialDaysForYear(2026);

      // 12 de Octubre - Día de la Raza (carabela transoceánica / encuentro de culturas)
      const razaRecord = yearIndex.get('2026-10-12');
      const razaItem = razaRecord?.items.find(i => i.name.includes('Raza'));
      expect(razaItem?.icon).toBe('sail-boat');

      // Reyes Magos (corona real, no sparkles)
      const reyesItem = Array.from(yearIndex.values())
        .flatMap(r => r.items)
        .find(i => i.name.includes('Reyes Magos'));
      expect(reyesItem?.icon).toBe('crown');

      // Día Nacional del Árbol (árbol frondoso)
      const arbolRecord = yearIndex.get('2026-04-29');
      const arbolItem = arbolRecord?.items.find(i => i.name.includes('Árbol'));
      expect(arbolItem?.icon).toBe('tree');

      // Velitas (vela)
      const velitasRecord = yearIndex.get('2026-12-07');
      const velitasItem = velitasRecord?.items.find(i => i.name.includes('Velitas'));
      expect(velitasItem?.icon).toBe('candle');

      // Jueves y Viernes Santo (Cáliz y Santa Cruz)
      const juevesRecord = yearIndex.get('2026-04-02');
      const juevesItem = juevesRecord?.items.find(i => i.name.includes('Jueves Santo'));
      expect(juevesItem?.icon).toBe('cup');

      const viernesRecord = yearIndex.get('2026-04-03');
      const viernesItem = viernesRecord?.items.find(i => i.name.includes('Viernes Santo'));
      expect(viernesItem?.icon).toBe('cross');

      // San Pedro y San Pablo (las llaves del reino)
      const pedroPabloItem = Array.from(yearIndex.values())
        .flatMap(r => r.items)
        .find(i => i.name.includes('San Pedro'));
      expect(pedroPabloItem?.icon).toBe('key-variant');

      // Independencia de Cartagena (Castillo de San Felipe)
      const cartagenaItem = Array.from(yearIndex.values())
        .flatMap(r => r.items)
        .find(i => i.name.includes('Cartagena'));
      expect(cartagenaItem?.icon).toBe('castle');
    });

    it('prioriza el Festivo Nacional de Colombia como items[0] y coloca conmemoraciones como la Virgen del Pilar en el acordeón', () => {
      const yearIndex = getSpecialDaysForYear(2026);
      const oct12 = yearIndex.get('2026-10-12');
      expect(oct12).toBeDefined();
      expect(oct12?.isHoliday).toBe(true);

      // El elemento primario (items[0]) DEBE ser el festivo oficial de Colombia
      expect(oct12?.items[0].isHoliday).toBe(true);
      expect(oct12?.items[0].name).toContain('Día de la Raza');

      // En los items secundarios del acordeón debe estar la Virgen del Pilar
      const virgenPilar = oct12?.items.find(i => i.name.includes('Virgen del Pilar'));
      expect(virgenPilar).toBeDefined();
      expect(virgenPilar?.isHoliday).toBe(false);
      expect(virgenPilar?.icon).toBe('star-four-points');
    });

    it('incluye efemérides internacionales clave de octubre (Salud Mental, Alimentación, ONU)', () => {
      const yearIndex = getSpecialDaysForYear(2026);

      // 10 de octubre: Día Mundial de la Salud Mental
      const oct10 = yearIndex.get('2026-10-10');
      expect(oct10?.items.some(i => i.name.includes('Salud Mental'))).toBe(true);
      const saludMental = oct10?.items.find(i => i.name.includes('Salud Mental'));
      expect(saludMental?.icon).toBe('brain');

      // 16 de octubre: Día Mundial de la Alimentación
      const oct16 = yearIndex.get('2026-10-16');
      expect(oct16?.items.some(i => i.name.includes('Alimentación'))).toBe(true);
      const alimentacion = oct16?.items.find(i => i.name.includes('Alimentación'));
      expect(alimentacion?.icon).toBe('food-apple');

      // 24 de octubre: Día de las Naciones Unidas
      const oct24 = yearIndex.get('2026-10-24');
      expect(oct24?.items.some(i => i.name.includes('Naciones Unidas'))).toBe(true);
      const onu = oct24?.items.find(i => i.name.includes('Naciones Unidas'));
      expect(onu?.icon).toBe('earth');
    });

    it('el catálogo contiene más de 180 efemérides y fechas especiales anuales', () => {
      const yearIndex = getSpecialDaysForYear(2026);
      const totalSpecialItems = Array.from(yearIndex.values()).flatMap(r => r.items);
      expect(totalSpecialItems.length).toBeGreaterThan(180);
    });

    it('respeta showHolidays: false desactivando festivos en el calendario sin afectar conmemoraciones', () => {
      const yearIndex = getSpecialDaysForYear(2026, {
        preferences: {
          showHolidays: false,
          showSpecialDates: true,
          enabledCategories: {
            religiosa: true,
            nacional: true,
            educacion: true,
            internacional: true,
          },
        },
      });

      // 1 de enero: ya no es festivo en el índice
      expect(yearIndex.get('2026-01-01')?.isHoliday).toBeFalsy();
      expect(isColombianHoliday('2026-01-01', {
        preferences: { showHolidays: false, enabledCategories: { religiosa: true, nacional: true, educacion: true, internacional: true } }
      })).toBe(false);

      // El mes de enero no tiene días festivos en el Set
      const janHolidays = getMonthHolidayDaysSet(2026, 0, {
        preferences: { showHolidays: false, enabledCategories: { religiosa: true, nacional: true, educacion: true, internacional: true } }
      });
      expect(janHolidays.size).toBe(0);

      // Pero conmemoraciones siguen presentes
      const oct24 = yearIndex.get('2026-10-24');
      expect(oct24?.items.some(i => i.name.includes('Naciones Unidas'))).toBe(true);
    });

    it('respeta showSpecialDates: false desactivando efemérides pero conservando festivos', () => {
      const yearIndex = getSpecialDaysForYear(2026, {
        preferences: {
          showHolidays: true,
          showSpecialDates: false,
          enabledCategories: {
            religiosa: true,
            nacional: true,
            educacion: true,
            internacional: true,
          },
        },
      });

      // 20 de julio: festivo oficial se conserva
      const jul20 = yearIndex.get('2026-07-20');
      expect(jul20?.isHoliday).toBe(true);

      // 24 de octubre: efeméride de la ONU ya no aparece
      const oct24 = yearIndex.get('2026-10-24');
      expect(oct24).toBeUndefined();
    });

    it('cuando ambos showHolidays y showSpecialDates son false, no devuelve elementos', () => {
      const yearIndex = getSpecialDaysForYear(2026, {
        preferences: {
          showHolidays: false,
          showSpecialDates: false,
          enabledCategories: {
            religiosa: true,
            nacional: true,
            educacion: true,
            internacional: true,
          },
        },
      });
      expect(yearIndex.size).toBe(0);
    });
  });

  describe('Correcciones Críticas: Ascensión del Señor, Bicicleta y Prematurez', () => {
    it('calcula la fecha original de la Ascensión del Señor en jueves (Pascua + 39) y el festivo en lunes (Pascua + 43) en 2024, 2025, 2026, 2027, 2028', () => {
      const cases = [
        { year: 2024, original: '2024-05-09', observed: '2024-05-13' },
        { year: 2025, original: '2025-05-29', observed: '2025-06-02' },
        { year: 2026, original: '2026-05-14', observed: '2026-05-18' },
        { year: 2027, original: '2027-05-06', observed: '2027-05-10' },
        { year: 2028, original: '2028-05-25', observed: '2028-05-29' },
      ];

      for (const { year, original, observed } of cases) {
        const holidays = getColombiaHolidays(year);
        const ascension = holidays.find(h => h.name.includes('Ascensión'));
        expect(ascension).toBeDefined();
        expect(ascension!.originalDateId).toBe(original);
        expect(ascension!.observedDateId).toBe(observed);
        expect(ascension!.isMoved).toBe(true);

        // Validar que la fecha original siempre sea Jueves (UTC day 4)
        const [oy, om, od] = original.split('-').map(Number);
        expect(new Date(Date.UTC(oy, om - 1, od)).getUTCDay()).toBe(4);

        // Validar que la fecha observada siempre sea Lunes (UTC day 1)
        const [ly, lm, ld] = observed.split('-').map(Number);
        expect(new Date(Date.UTC(ly, lm - 1, ld)).getUTCDay()).toBe(1);
      }
    });

    it('distingue el Día Mundial de la Bicicleta de la ONU (3 de junio) de la celebración popular (19 de abril)', () => {
      const yearIndex = getSpecialDaysForYear(2026);

      // 19 de abril: Celebración popular
      const apr19 = yearIndex.get('2026-04-19');
      expect(apr19).toBeDefined();
      const biciPopular = apr19!.items.find(i => i.name.includes('Bicicleta'));
      expect(biciPopular).toBeDefined();
      expect(biciPopular!.basis).toBe('tradicion');
      expect(biciPopular!.name).toContain('Celebración Popular');

      // 3 de junio: Oficial de la ONU
      const jun03 = yearIndex.get('2026-06-03');
      expect(jun03).toBeDefined();
      const biciOnu = jun03!.items.find(i => i.name === 'Día Mundial de la Bicicleta');
      expect(biciOnu).toBeDefined();
      expect(biciOnu!.basis).toBe('onu');
      expect(biciOnu!.authority).toContain('Naciones Unidas');
    });

    it('Día Mundial del Niño Prematuro: tres registros con vigencia exacta según fuente OMS 2025', () => {
      // ─── 2024: solo existe el registro histórico en 17 Nov ───────────────────────────
      const idx2024 = getSpecialDaysForYear(2024);

      const nov17_2024 = idx2024.get('2024-11-17');
      expect(nov17_2024).toBeDefined();
      const prematuro2024hist = nov17_2024!.items.find(i => i.id.endsWith('-prematuro'));
      expect(prematuro2024hist).toBeDefined();
      expect(prematuro2024hist!.status).toBe('historical');
      expect(prematuro2024hist!.validUntilYear).toBe(2024);
      expect(prematuro2024hist!.authority).toContain('EFCNI / OMS');

      // En 2024, el 15 de noviembre NO tiene ningún registro de prematurez
      const nov15_2024 = idx2024.get('2024-11-15');
      expect(nov15_2024?.items.some(i => i.id.includes('prematuro'))).toBeFalsy();

      // ─── 2025: fecha oficial OMS en 15 Nov + organizaciones socias en 17 Nov ─────────
      const idx2025 = getSpecialDaysForYear(2025);

      // 15 Nov 2025 → fecha oficial OMS, status 'verified', validFromYear 2025
      const nov15_2025 = idx2025.get('2025-11-15');
      expect(nov15_2025).toBeDefined();
      const prematurOMS2025 = nov15_2025!.items.find(i => i.id.endsWith('-prematuro'));
      expect(prematurOMS2025).toBeDefined();
      expect(prematurOMS2025!.name).toBe('Día Mundial del Niño Prematuro');
      expect(prematurOMS2025!.status).toBe('verified');
      expect(prematurOMS2025!.validFromYear).toBe(2025);
      expect(prematurOMS2025!.authority).toContain('OMS');

      // 17 Nov 2025 → organizaciones socias, status 'needs-review', id distinto
      const nov17_2025 = idx2025.get('2025-11-17');
      expect(nov17_2025).toBeDefined();
      const prematurOrg2025 = nov17_2025!.items.find(i => i.id.endsWith('-prematuro-organizaciones'));
      expect(prematurOrg2025).toBeDefined();
      expect(prematurOrg2025!.name).toContain('Organizaciones Asociadas');
      expect(prematurOrg2025!.status).toBe('needs-review');
      expect(prematurOrg2025!.validFromYear).toBe(2025);

      // 17 Nov 2025 también tiene Cáncer de Cuello Uterino y NO el registro histórico (expiró en 2024)
      expect(nov17_2025!.items.some(i => i.name.includes('Cáncer de Cuello Uterino'))).toBe(true);
      expect(nov17_2025!.items.some(i => i.id.endsWith('-prematuro') && i.status === 'historical')).toBe(false);

      // ─── 2026 y 2027: mismo patrón que 2025 ──────────────────────────────────────────
      for (const year of [2026, 2027]) {
        const idx = getSpecialDaysForYear(year);

        // 15 Nov: fecha oficial OMS, verified
        const nov15 = idx.get(`${year}-11-15`);
        expect(nov15).toBeDefined();
        const official = nov15!.items.find(i => i.id.endsWith('-prematuro'));
        expect(official).toBeDefined();
        expect(official!.status).toBe('verified');
        expect(official!.validFromYear).toBe(2025);

        // 17 Nov: organizaciones socias (needs-review) + Cuello Uterino, pero NO el histórico
        const nov17 = idx.get(`${year}-11-17`);
        expect(nov17).toBeDefined();
        expect(nov17!.items.some(i => i.id.endsWith('-prematuro-organizaciones'))).toBe(true);
        expect(nov17!.items.some(i => i.name.includes('Cáncer de Cuello Uterino'))).toBe(true);
        expect(nov17!.items.some(i => i.id.endsWith('-prematuro') && i.status === 'historical')).toBe(false);
      }
    });

    it('distingue el World Coding Day de la UNESCO (29 de octubre) del Día del Programador (Día 256)', () => {
      const yearIndex2026 = getSpecialDaysForYear(2026);
      const yearIndex2024 = getSpecialDaysForYear(2024); // Año bisiesto

      // 29 de octubre: UNESCO
      const oct29 = yearIndex2026.get('2026-10-29');
      const codingUnesco = oct29!.items.find(i => i.name.includes('Programación'));
      expect(codingUnesco).toBeDefined();
      expect(codingUnesco!.authority).toContain('UNESCO');

      // Día 256 en 2026 (no bisiesto): 13 de septiembre
      const sep13 = yearIndex2026.get('2026-09-13');
      expect(sep13!.items.some(i => i.name.includes('Día 256'))).toBe(true);

      // Día 256 en 2024 (bisiesto): 12 de septiembre
      const sep12 = yearIndex2024.get('2024-09-12');
      expect(sep12!.items.some(i => i.name.includes('Día 256'))).toBe(true);
    });
  });

  describe('Salud Pública (OMS) y Campañas Multirango', () => {
    it('las campañas de duración semanal se registran como dateRange y cubren todos los días del intervalo', () => {
      const yearIndex = getSpecialDaysForYear(2026);

      // Semana Mundial de la Inmunización: 24 al 30 de abril
      for (let day = 24; day <= 30; day++) {
        const dId = `2026-04-${String(day).padStart(2, '0')}`;
        const record = yearIndex.get(dId);
        expect(record).toBeDefined();
        const item = record!.items.find(i => i.name.includes('Inmunización'));
        expect(item).toBeDefined();
        expect(item!.dateRange).toEqual({ start: '2026-04-24', end: '2026-04-30' });
      }

      // Semana Mundial de la Lactancia Materna: 1 al 7 de agosto
      for (let day = 1; day <= 7; day++) {
        const dId = `2026-08-${String(day).padStart(2, '0')}`;
        const record = yearIndex.get(dId);
        expect(record).toBeDefined();
        const item = record!.items.find(i => i.name.includes('Lactancia'));
        expect(item).toBeDefined();
        expect(item!.dateRange).toEqual({ start: '2026-08-01', end: '2026-08-07' });
      }

      // Semana de la Resistencia a los Antimicrobianos: 18 al 24 de noviembre
      for (let day = 18; day <= 24; day++) {
        const dId = `2026-11-${String(day).padStart(2, '0')}`;
        const record = yearIndex.get(dId);
        expect(record).toBeDefined();
        const item = record!.items.find(i => i.name.includes('Antimicrobianos'));
        expect(item).toBeDefined();
        expect(item!.dateRange).toEqual({ start: '2026-11-18', end: '2026-11-24' });
      }
    });

    it('incluye conmemoraciones de salud pública de la OMS ausentes anteriormente', () => {
      const yearIndex = getSpecialDaysForYear(2026);

      // 30 de enero: Enfermedades Tropicales Desatendidas
      expect(yearIndex.get('2026-01-30')?.items.some(i => i.name.includes('Enfermedades Tropicales'))).toBe(true);

      // 3 de marzo: Audición
      expect(yearIndex.get('2026-03-03')?.items.some(i => i.name.includes('Audición'))).toBe(true);

      // 14 de abril: Chagas
      expect(yearIndex.get('2026-04-14')?.items.some(i => i.name.includes('Chagas'))).toBe(true);

      // 5 de mayo: Higiene de Manos
      expect(yearIndex.get('2026-05-05')?.items.some(i => i.name.includes('Higiene de Manos'))).toBe(true);

      // 25 de julio: Prevención de Ahogamientos
      expect(yearIndex.get('2026-07-25')?.items.some(i => i.name.includes('Ahogamientos'))).toBe(true);

      // 17 de septiembre: Seguridad del Paciente
      expect(yearIndex.get('2026-09-17')?.items.some(i => i.name.includes('Seguridad del Paciente'))).toBe(true);

      // 28 de septiembre: Rabia
      expect(yearIndex.get('2026-09-28')?.items.some(i => i.name.includes('Rabia'))).toBe(true);

      // 17 de noviembre: Eliminación del Cáncer de Cuello Uterino
      expect(yearIndex.get('2026-11-17')?.items.some(i => i.name.includes('Cáncer de Cuello Uterino'))).toBe(true);

      // 12 de diciembre: Cobertura Sanitaria Universal
      expect(yearIndex.get('2026-12-12')?.items.some(i => i.name.includes('Cobertura Sanitaria Universal'))).toBe(true);
    });
  });

  describe('Fechas Nacionales, Profesionales y de Memoria de Colombia', () => {
    it('incluye efemérides profesionales, cívicas y de memoria en Colombia con su respaldo', () => {
      const yearIndex = getSpecialDaysForYear(2026);

      // 6 de marzo: Víctimas de crímenes de Estado
      expect(yearIndex.get('2026-03-06')?.items.some(i => i.name.includes('Víctimas de Crímenes de Estado'))).toBe(true);

      // 31 de marzo: Visibilidad Trans
      expect(yearIndex.get('2026-03-31')?.items.some(i => i.name.includes('Visibilidad Trans'))).toBe(true);

      // 4 de abril: Minas Antipersonal
      expect(yearIndex.get('2026-04-04')?.items.some(i => i.name.includes('Minas Antipersonal'))).toBe(true);

      // 26 de abril: Secretaria
      expect(yearIndex.get('2026-04-26')?.items.some(i => i.name.includes('Secretaria'))).toBe(true);

      // 27 de junio: Servidor Público
      expect(yearIndex.get('2026-06-27')?.items.some(i => i.name.includes('Servidor Público'))).toBe(true);

      // 16 de julio: Día del Conductor
      expect(yearIndex.get('2026-07-16')?.items.some(i => i.name.includes('Conductor'))).toBe(true);

      // 4 de agosto: Comunicador Social y Periodista (Ley 918 de 2004)
      const ago04 = yearIndex.get('2026-08-04');
      const periodista = ago04?.items.find(i => i.name.includes('Comunicador Social'));
      expect(periodista).toBeDefined();
      expect(periodista?.basis).toBe('ley');

      // 6 de septiembre: Fonoaudiólogo
      expect(yearIndex.get('2026-09-06')?.items.some(i => i.name.includes('Fonoaudiólogo'))).toBe(true);

      // 8 de septiembre: Fisioterapeuta
      expect(yearIndex.get('2026-09-08')?.items.some(i => i.name.includes('Fisioterapeuta'))).toBe(true);

      // 26 de septiembre: Químico Farmacéutico
      expect(yearIndex.get('2026-09-26')?.items.some(i => i.name.includes('Químico Farmacéutico'))).toBe(true);

      // 1 de octubre: Día Internacional del Café
      expect(yearIndex.get('2026-10-01')?.items.some(i => i.name.includes('Café'))).toBe(true);

      // 3 de octubre: Odontólogo
      expect(yearIndex.get('2026-10-03')?.items.some(i => i.name.includes('Odontólogo'))).toBe(true);

      // 7 de octubre: Algodón
      expect(yearIndex.get('2026-10-07')?.items.some(i => i.name.includes('Algodón'))).toBe(true);

      // 9 de octubre: Archivista (Ley 1409 de 2010)
      expect(yearIndex.get('2026-10-09')?.items.some(i => i.name.includes('Archivista'))).toBe(true);

      // 20 de octubre: Cocinero o Chef
      expect(yearIndex.get('2026-10-20')?.items.some(i => i.name.includes('Cocinero'))).toBe(true);

      // 22 de octubre: Trabajador Social
      expect(yearIndex.get('2026-10-22')?.items.some(i => i.name.includes('Trabajador Social'))).toBe(true);

      // 24 de octubre: Información sobre el Desarrollo
      expect(yearIndex.get('2026-10-24')?.items.some(i => i.name.includes('Información sobre el Desarrollo'))).toBe(true);

      // 25 de octubre: Instrumentador Quirúrgico
      expect(yearIndex.get('2026-10-25')?.items.some(i => i.name.includes('Instrumentador Quirúrgico'))).toBe(true);

      // 29 de octubre: Cuidados y Apoyo (ONU)
      expect(yearIndex.get('2026-10-29')?.items.some(i => i.name.includes('Cuidados y el Apoyo'))).toBe(true);

      // 3 de noviembre: Reservas de Biosfera
      expect(yearIndex.get('2026-11-03')?.items.some(i => i.name.includes('Reservas de Biosfera'))).toBe(true);

      // 4 de noviembre: Administrador de Empresas
      expect(yearIndex.get('2026-11-04')?.items.some(i => i.name.includes('Administrador de Empresas'))).toBe(true);

      // 8 de noviembre: Radiología
      expect(yearIndex.get('2026-11-08')?.items.some(i => i.name.includes('Radiología'))).toBe(true);

      // 20 de noviembre: Psicólogo (Ley 1090 de 2006)
      expect(yearIndex.get('2026-11-20')?.items.some(i => i.name.includes('Psicólogo'))).toBe(true);

      // 24 de noviembre: Agrónomo
      expect(yearIndex.get('2026-11-24')?.items.some(i => i.name.includes('Agrónomo'))).toBe(true);

      // 3 de diciembre: Médico
      expect(yearIndex.get('2026-12-03')?.items.some(i => i.name.includes('Médico'))).toBe(true);
    });

    it('Día contra la Violencia y el Acoso Escolar (UNESCO) se calcula como 1er jueves de noviembre', () => {
      const yearIndex2026 = getSpecialDaysForYear(2026);
      expect(yearIndex2026.get('2026-11-05')?.items.some(i => i.name.includes('Acoso Escolar'))).toBe(true);

      const yearIndex2025 = getSpecialDaysForYear(2025);
      expect(yearIndex2025.get('2025-11-06')?.items.some(i => i.name.includes('Acoso Escolar'))).toBe(true);
    });

    it('Día Nacional del Servidor Público (27 de junio): Decreto 1083 de 2015 precisa que no constituye vacancia', () => {
      const yearIndex = getSpecialDaysForYear(2026);
      const jun27 = yearIndex.get('2026-06-27');
      expect(jun27).toBeDefined();
      expect(jun27!.isHoliday).toBe(false); // No es día no laborable

      const servidor = jun27!.items.find(i => i.id.endsWith('-servidor-publico-colombia'));
      expect(servidor).toBeDefined();
      expect(servidor!.basis).toBe('ley');
      expect(servidor!.authority).toContain('Decreto 1083 de 2015');
      expect(servidor!.authority).toContain('Art. 2.2.15.1');
      expect(servidor!.note).toContain('no constituye día de vacancia laboral');
    });

    it('29 de octubre: preserva legítima coexistencia del Día Mundial de la Programación (UNESCO) y Cuidados y Apoyo (ONU)', () => {
      const yearIndex = getSpecialDaysForYear(2026);
      const oct29 = yearIndex.get('2026-10-29');
      expect(oct29).toBeDefined();
      expect(oct29!.items.length).toBeGreaterThanOrEqual(2);

      const coding = oct29!.items.find(i => i.id === 'commem-2026-10-29-programacion-unesco');
      expect(coding).toBeDefined();
      expect(coding!.name).toBe('Día Mundial de la Programación (UNESCO)');
      expect(coding!.authority).toContain('UNESCO');

      const cuidados = oct29!.items.find(i => i.id === 'commem-2026-10-29-cuidados-apoyo-onu');
      expect(cuidados).toBeDefined();
      expect(cuidados!.name).toBe('Día Internacional de los Cuidados y el Apoyo');
      expect(cuidados!.authority).toContain('A/RES/77/317');

      // Ambas identidades son distintas y ninguna suprime a la otra
      expect(coding!.id).not.toBe(cuidados!.id);
    });

    it('date-range: resuelve correctamente rangos que cruzan fin de año (diciembre a enero)', () => {
      const easter = getEasterSunday(2026);
      const crossYearDef: CommemorationDefinition = {
        id: 'campana-invierno',
        name: 'Campaña Transanual de Invierno',
        category: 'internacional',
        basis: 'onu',
        authority: 'Organización Internacional',
        status: 'verified',
        note: 'Campaña de prueba para rangos transanuales que cruzan diciembre y enero.',
        icon: 'snowflake',
        dateRule: {
          type: 'date-range',
          startMonth: 12,
          startDay: 28,
          endMonth: 1,
          endDay: 4,
        },
      };

      // Para el año 2026:
      const items2026 = resolveDefinition(crossYearDef, 2026, easter);

      // Debe incluir los 4 días de diciembre de 2026 (28, 29, 30, 31)
      const decDays = items2026.filter(i => i.id.startsWith('commem-2026-12-'));
      expect(decDays).toHaveLength(4);
      expect(decDays[0].dateRange).toEqual({ start: '2026-12-28', end: '2027-01-04' });

      // Debe incluir los 4 días de enero de 2026 que iniciaron en diciembre de 2025 (1, 2, 3, 4)
      const janDays = items2026.filter(i => i.id.startsWith('commem-2026-01-'));
      expect(janDays).toHaveLength(4);
      expect(janDays[0].dateRange).toEqual({ start: '2025-12-28', end: '2026-01-04' });
    });

    it('day-of-year: cálculo multianual exacto del Día 256 en años bisiestos y comunes', () => {
      const years = [
        { year: 2024, isLeap: true, expectedDate: '2024-09-12' },
        { year: 2025, isLeap: false, expectedDate: '2025-09-13' },
        { year: 2026, isLeap: false, expectedDate: '2026-09-13' },
        { year: 2027, isLeap: false, expectedDate: '2027-09-13' },
        { year: 2028, isLeap: true, expectedDate: '2028-09-12' },
      ];

      for (const { year, expectedDate } of years) {
        const yearIndex = getSpecialDaysForYear(year);
        const record = yearIndex.get(expectedDate);
        expect(record).toBeDefined();
        // Slug del catálogo es 'programador' → id generado: commem-YYYY-MM-DD-programador
        const progItem = record!.items.find(i => i.id.endsWith('-programador'));
        expect(progItem).toBeDefined();
        expect(progItem!.name).toContain('Día del Programador');
      }
    });

    it('nth-weekday y last-weekday: exactitud matemática en límites de meses y años variados', () => {
      // Día de la Madre: 2º domingo de mayo
      expect(getNthWeekdayOfMonth(2024, 5, 0, 2)).toBe('2024-05-12');
      expect(getNthWeekdayOfMonth(2025, 5, 0, 2)).toBe('2025-05-11');
      expect(getNthWeekdayOfMonth(2026, 5, 0, 2)).toBe('2026-05-10');
      expect(getNthWeekdayOfMonth(2027, 5, 0, 2)).toBe('2027-05-09');

      // Día del Padre: 3º domingo de junio
      expect(getNthWeekdayOfMonth(2024, 6, 0, 3)).toBe('2024-06-16');
      expect(getNthWeekdayOfMonth(2025, 6, 0, 3)).toBe('2025-06-15');
      expect(getNthWeekdayOfMonth(2026, 6, 0, 3)).toBe('2026-06-21');
      expect(getNthWeekdayOfMonth(2027, 6, 0, 3)).toBe('2027-06-20');

      // Acoso Escolar (UNESCO): 1er jueves de noviembre
      expect(getNthWeekdayOfMonth(2024, 11, 4, 1)).toBe('2024-11-07');
      expect(getNthWeekdayOfMonth(2025, 11, 4, 1)).toBe('2025-11-06');
      expect(getNthWeekdayOfMonth(2026, 11, 4, 1)).toBe('2026-11-05');
      expect(getNthWeekdayOfMonth(2027, 11, 4, 1)).toBe('2027-11-04');

      // Día de la Niñez: último sábado de abril (Ley 724 de 2001)
      expect(getLastWeekdayOfMonth(2024, 4, 6)).toBe('2024-04-27');
      expect(getLastWeekdayOfMonth(2025, 4, 6)).toBe('2025-04-26');
      expect(getLastWeekdayOfMonth(2026, 4, 6)).toBe('2026-04-25');
      expect(getLastWeekdayOfMonth(2027, 4, 6)).toBe('2027-04-24');
    });

    it('garantiza ausencia de IDs duplicados en cada día del año y estados válidos', () => {
      const yearIndex = getSpecialDaysForYear(2026);
      for (const [, record] of yearIndex.entries()) {
        const ids = new Set<string>();
        for (const item of record.items) {
          expect(ids.has(item.id)).toBe(false);
          ids.add(item.id);
          // Los festivos oficiales inyectados desde colombiaHolidays.ts no tienen campo status
          if (item.status !== undefined) {
            expect(['verified', 'historical', 'needs-review', 'deprecated']).toContain(item.status);
          }
        }
      }
    });
  });
});

