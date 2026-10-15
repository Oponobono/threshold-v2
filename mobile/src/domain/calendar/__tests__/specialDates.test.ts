import { getEasterSunday } from '../easter';
import { getColombiaHolidays } from '../colombiaHolidays';
import {
  getSpecialDaysForYear,
  isColombianHoliday,
  getSpecialDayRecord,
  getMonthHolidayDaysSet,
  clearSpecialDatesCache,
} from '../specialDatesEngine';
import { SpecialDateOverride } from '../types';

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
});
