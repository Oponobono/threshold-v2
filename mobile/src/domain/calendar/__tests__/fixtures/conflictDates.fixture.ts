/**
 * conflictDates.fixture.ts
 *
 * Referencia congelada de las 7 fechas donde el catálogo tiene más de una
 * efeméride compitiendo por el titular del día (2023–2035).
 *
 * headline es el ítem que encabeza el día en el motor (festivo incluido);
 * commemoration es el ítem que encabeza entre las conmemoraciones no
 * festivas (el que usa el cuerpo de la notificación).
 *
 * 4 de estas fechas conservan su titular histórico por una decisión de
 * producto explícita (ver LEGACY_TIE_BREAKS en engine/presentationPriority.ts):
 *   04-02, 07-25, 09-26, 09-28
 * Las otras 3 cambian de titular de forma deliberada con la política nueva:
 *   04-29, 05-15, 06-08
 */

export interface ConflictDateExpectation {
  /** Id del ítem que encabeza el día completo (festivo oficial incluido). */
  readonly headline: string;
  /** Id del ítem que encabeza entre las conmemoraciones no festivas. */
  readonly commemoration: string | null;
}

/** month-day -> year -> titular esperado. */
export const CONFLICT_DATE_EXPECTATIONS: Readonly<
  Record<string, Readonly<Record<string, ConflictDateExpectation>>>
> = {
  "04-02": {
    "2023": { headline: "commem-2023-04-02-domingo-ramos", commemoration: "commem-2023-04-02-domingo-ramos" },
    "2024": { headline: "commem-2024-04-02-autismo", commemoration: "commem-2024-04-02-autismo" },
    "2025": { headline: "commem-2025-04-02-autismo", commemoration: "commem-2025-04-02-autismo" },
    "2026": { headline: "holiday-2026-04-02-Jueves Santo", commemoration: "commem-2026-04-02-autismo" },
    "2027": { headline: "commem-2027-04-02-autismo", commemoration: "commem-2027-04-02-autismo" },
    "2028": { headline: "commem-2028-04-02-autismo", commemoration: "commem-2028-04-02-autismo" },
    "2029": { headline: "commem-2029-04-02-autismo", commemoration: "commem-2029-04-02-autismo" },
    "2030": { headline: "commem-2030-04-02-autismo", commemoration: "commem-2030-04-02-autismo" },
    "2031": { headline: "commem-2031-04-02-autismo", commemoration: "commem-2031-04-02-autismo" },
    "2032": { headline: "commem-2032-04-02-autismo", commemoration: "commem-2032-04-02-autismo" },
    "2033": { headline: "commem-2033-04-02-autismo", commemoration: "commem-2033-04-02-autismo" },
    "2034": { headline: "commem-2034-04-02-domingo-ramos", commemoration: "commem-2034-04-02-domingo-ramos" },
    "2035": { headline: "commem-2035-04-02-autismo", commemoration: "commem-2035-04-02-autismo" },
  },
  "04-29": {
    "2023": { headline: "commem-2023-04-29-dia-ninez-colombia", commemoration: "commem-2023-04-29-dia-ninez-colombia" },
    "2024": { headline: "commem-2024-04-29-arbol-colombia", commemoration: "commem-2024-04-29-arbol-colombia" },
    "2025": { headline: "commem-2025-04-29-arbol-colombia", commemoration: "commem-2025-04-29-arbol-colombia" },
    "2026": { headline: "commem-2026-04-29-arbol-colombia", commemoration: "commem-2026-04-29-arbol-colombia" },
    "2027": { headline: "commem-2027-04-29-arbol-colombia", commemoration: "commem-2027-04-29-arbol-colombia" },
    "2028": { headline: "commem-2028-04-29-dia-ninez-colombia", commemoration: "commem-2028-04-29-dia-ninez-colombia" },
    "2029": { headline: "commem-2029-04-29-arbol-colombia", commemoration: "commem-2029-04-29-arbol-colombia" },
    "2030": { headline: "commem-2030-04-29-arbol-colombia", commemoration: "commem-2030-04-29-arbol-colombia" },
    "2031": { headline: "commem-2031-04-29-arbol-colombia", commemoration: "commem-2031-04-29-arbol-colombia" },
    "2032": { headline: "commem-2032-04-29-arbol-colombia", commemoration: "commem-2032-04-29-arbol-colombia" },
    "2033": { headline: "commem-2033-04-29-arbol-colombia", commemoration: "commem-2033-04-29-arbol-colombia" },
    "2034": { headline: "commem-2034-04-29-dia-ninez-colombia", commemoration: "commem-2034-04-29-dia-ninez-colombia" },
    "2035": { headline: "commem-2035-04-29-arbol-colombia", commemoration: "commem-2035-04-29-arbol-colombia" },
  },
  "05-15": {
    "2023": { headline: "commem-2023-05-15-maestro-colombia", commemoration: "commem-2023-05-15-maestro-colombia" },
    "2024": { headline: "commem-2024-05-15-maestro-colombia", commemoration: "commem-2024-05-15-maestro-colombia" },
    "2025": { headline: "commem-2025-05-15-maestro-colombia", commemoration: "commem-2025-05-15-maestro-colombia" },
    "2026": { headline: "commem-2026-05-15-maestro-colombia", commemoration: "commem-2026-05-15-maestro-colombia" },
    "2027": { headline: "commem-2027-05-15-maestro-colombia", commemoration: "commem-2027-05-15-maestro-colombia" },
    "2028": { headline: "commem-2028-05-15-maestro-colombia", commemoration: "commem-2028-05-15-maestro-colombia" },
    "2029": { headline: "commem-2029-05-15-maestro-colombia", commemoration: "commem-2029-05-15-maestro-colombia" },
    "2030": { headline: "commem-2030-05-15-maestro-colombia", commemoration: "commem-2030-05-15-maestro-colombia" },
    "2031": { headline: "commem-2031-05-15-maestro-colombia", commemoration: "commem-2031-05-15-maestro-colombia" },
    "2032": { headline: "commem-2032-05-15-maestro-colombia", commemoration: "commem-2032-05-15-maestro-colombia" },
    "2033": { headline: "commem-2033-05-15-maestro-colombia", commemoration: "commem-2033-05-15-maestro-colombia" },
    "2034": { headline: "commem-2034-05-15-maestro-colombia", commemoration: "commem-2034-05-15-maestro-colombia" },
    "2035": { headline: "commem-2035-05-15-maestro-colombia", commemoration: "commem-2035-05-15-maestro-colombia" },
  },
  "06-08": {
    "2023": { headline: "commemoration-2023-06-08-Corpus Christi", commemoration: "commemoration-2023-06-08-Corpus Christi" },
    "2024": { headline: "commem-2024-06-08-estudiante-colombia", commemoration: "commem-2024-06-08-estudiante-colombia" },
    "2025": { headline: "commem-2025-06-08-pentecostes", commemoration: "commem-2025-06-08-pentecostes" },
    "2026": { headline: "holiday-2026-06-08-Corpus Christi", commemoration: "commem-2026-06-08-estudiante-colombia" },
    "2027": { headline: "commem-2027-06-08-estudiante-colombia", commemoration: "commem-2027-06-08-estudiante-colombia" },
    "2028": { headline: "commem-2028-06-08-estudiante-colombia", commemoration: "commem-2028-06-08-estudiante-colombia" },
    "2029": { headline: "commemoration-2029-06-08-Sagrado Corazón de Jesús", commemoration: "commemoration-2029-06-08-Sagrado Corazón de Jesús" },
    "2030": { headline: "commem-2030-06-08-estudiante-colombia", commemoration: "commem-2030-06-08-estudiante-colombia" },
    "2031": { headline: "commem-2031-06-08-estudiante-colombia", commemoration: "commem-2031-06-08-estudiante-colombia" },
    "2032": { headline: "commem-2032-06-08-estudiante-colombia", commemoration: "commem-2032-06-08-estudiante-colombia" },
    "2033": { headline: "commem-2033-06-08-estudiante-colombia", commemoration: "commem-2033-06-08-estudiante-colombia" },
    "2034": { headline: "commemoration-2034-06-08-Corpus Christi", commemoration: "commemoration-2034-06-08-Corpus Christi" },
    "2035": { headline: "commem-2035-06-08-estudiante-colombia", commemoration: "commem-2035-06-08-estudiante-colombia" },
  },
  "07-25": {
    "2023": { headline: "commem-2023-07-25-prevencion-ahogamientos-onu", commemoration: "commem-2023-07-25-prevencion-ahogamientos-onu" },
    "2024": { headline: "commem-2024-07-25-prevencion-ahogamientos-onu", commemoration: "commem-2024-07-25-prevencion-ahogamientos-onu" },
    "2025": { headline: "commem-2025-07-25-prevencion-ahogamientos-onu", commemoration: "commem-2025-07-25-prevencion-ahogamientos-onu" },
    "2026": { headline: "commem-2026-07-25-prevencion-ahogamientos-onu", commemoration: "commem-2026-07-25-prevencion-ahogamientos-onu" },
    "2027": { headline: "commem-2027-07-25-prevencion-ahogamientos-onu", commemoration: "commem-2027-07-25-prevencion-ahogamientos-onu" },
    "2028": { headline: "commem-2028-07-25-prevencion-ahogamientos-onu", commemoration: "commem-2028-07-25-prevencion-ahogamientos-onu" },
    "2029": { headline: "commem-2029-07-25-prevencion-ahogamientos-onu", commemoration: "commem-2029-07-25-prevencion-ahogamientos-onu" },
    "2030": { headline: "commem-2030-07-25-prevencion-ahogamientos-onu", commemoration: "commem-2030-07-25-prevencion-ahogamientos-onu" },
    "2031": { headline: "commem-2031-07-25-prevencion-ahogamientos-onu", commemoration: "commem-2031-07-25-prevencion-ahogamientos-onu" },
    "2032": { headline: "commem-2032-07-25-prevencion-ahogamientos-onu", commemoration: "commem-2032-07-25-prevencion-ahogamientos-onu" },
    "2033": { headline: "commem-2033-07-25-prevencion-ahogamientos-onu", commemoration: "commem-2033-07-25-prevencion-ahogamientos-onu" },
    "2034": { headline: "commem-2034-07-25-prevencion-ahogamientos-onu", commemoration: "commem-2034-07-25-prevencion-ahogamientos-onu" },
    "2035": { headline: "commem-2035-07-25-prevencion-ahogamientos-onu", commemoration: "commem-2035-07-25-prevencion-ahogamientos-onu" },
  },
  "09-26": {
    "2023": { headline: "commem-2023-09-26-quimico-farmaceutico-colombia", commemoration: "commem-2023-09-26-quimico-farmaceutico-colombia" },
    "2024": { headline: "commem-2024-09-26-quimico-farmaceutico-colombia", commemoration: "commem-2024-09-26-quimico-farmaceutico-colombia" },
    "2025": { headline: "commem-2025-09-26-quimico-farmaceutico-colombia", commemoration: "commem-2025-09-26-quimico-farmaceutico-colombia" },
    "2026": { headline: "commem-2026-09-26-quimico-farmaceutico-colombia", commemoration: "commem-2026-09-26-quimico-farmaceutico-colombia" },
    "2027": { headline: "commem-2027-09-26-quimico-farmaceutico-colombia", commemoration: "commem-2027-09-26-quimico-farmaceutico-colombia" },
    "2028": { headline: "commem-2028-09-26-quimico-farmaceutico-colombia", commemoration: "commem-2028-09-26-quimico-farmaceutico-colombia" },
    "2029": { headline: "commem-2029-09-26-quimico-farmaceutico-colombia", commemoration: "commem-2029-09-26-quimico-farmaceutico-colombia" },
    "2030": { headline: "commem-2030-09-26-quimico-farmaceutico-colombia", commemoration: "commem-2030-09-26-quimico-farmaceutico-colombia" },
    "2031": { headline: "commem-2031-09-26-quimico-farmaceutico-colombia", commemoration: "commem-2031-09-26-quimico-farmaceutico-colombia" },
    "2032": { headline: "commem-2032-09-26-quimico-farmaceutico-colombia", commemoration: "commem-2032-09-26-quimico-farmaceutico-colombia" },
    "2033": { headline: "commem-2033-09-26-quimico-farmaceutico-colombia", commemoration: "commem-2033-09-26-quimico-farmaceutico-colombia" },
    "2034": { headline: "commem-2034-09-26-quimico-farmaceutico-colombia", commemoration: "commem-2034-09-26-quimico-farmaceutico-colombia" },
    "2035": { headline: "commem-2035-09-26-quimico-farmaceutico-colombia", commemoration: "commem-2035-09-26-quimico-farmaceutico-colombia" },
  },
  "09-28": {
    "2023": { headline: "commem-2023-09-28-rabia-oms", commemoration: "commem-2023-09-28-rabia-oms" },
    "2024": { headline: "commem-2024-09-28-rabia-oms", commemoration: "commem-2024-09-28-rabia-oms" },
    "2025": { headline: "commem-2025-09-28-rabia-oms", commemoration: "commem-2025-09-28-rabia-oms" },
    "2026": { headline: "commem-2026-09-28-rabia-oms", commemoration: "commem-2026-09-28-rabia-oms" },
    "2027": { headline: "commem-2027-09-28-rabia-oms", commemoration: "commem-2027-09-28-rabia-oms" },
    "2028": { headline: "commem-2028-09-28-rabia-oms", commemoration: "commem-2028-09-28-rabia-oms" },
    "2029": { headline: "commem-2029-09-28-rabia-oms", commemoration: "commem-2029-09-28-rabia-oms" },
    "2030": { headline: "commem-2030-09-28-rabia-oms", commemoration: "commem-2030-09-28-rabia-oms" },
    "2031": { headline: "commem-2031-09-28-rabia-oms", commemoration: "commem-2031-09-28-rabia-oms" },
    "2032": { headline: "commem-2032-09-28-rabia-oms", commemoration: "commem-2032-09-28-rabia-oms" },
    "2033": { headline: "commem-2033-09-28-rabia-oms", commemoration: "commem-2033-09-28-rabia-oms" },
    "2034": { headline: "commem-2034-09-28-rabia-oms", commemoration: "commem-2034-09-28-rabia-oms" },
    "2035": { headline: "commem-2035-09-28-rabia-oms", commemoration: "commem-2035-09-28-rabia-oms" },
  },
};
