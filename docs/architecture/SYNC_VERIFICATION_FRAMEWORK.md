# Sync Verification Framework
**Framework de Pruebas de Convergencia y Persistencia**

Este documento define la arquitectura y componentes del **Sync Verification Framework**, la infraestructura de testing diseñada específicamente para validar las garantías del Sync Protocol v1.0 y asegurar que el estado se mantenga estable a través de futuras iteraciones del protocolo.

---

## 1. Arquitectura del Framework

El framework no es solo un conjunto de tests, sino una plataforma de verificación estructurada en cuatro niveles de profundidad:

1. **Unit Tests (Nivel 1):** Verifican lógica pura sin dependencias de I/O.
   - *Ejemplos:* `DependencyResolver`, `SyncQueueReducer`, `ConflictResolver`, `VersionComparator`.
2. **Integration Tests (Nivel 2):** Validan el ciclo de encolado y persistencia local sin servidor real.
   - *Flujo:* SQLite → Synchronizer → SyncQueue → Payload JSON.
3. **Protocol Tests (Nivel 3):** Simulan dispositivos sincronizando contra el backend real.
   - *Flujo:* Device A ⇄ Backend ⇄ Device B.
4. **Recovery Tests (Nivel 4):** Validan la promesa de persistencia total del producto.
   - *Flujo:* Estado Inicial → Backup → Wipe Total → Restore → Verificación de Identidad.

---

## 2. Core Components

El diseño del framework sigue un patrón de herencia y composición estricto, aislando la complejidad de infraestructura de las aserciones de prueba:

### `SyncVerificationSuite` (Base Class)
La clase base abstracta de la cual heredan todas las suites. Define el ciclo de vida estándar:
- `setup()`: Prepara el entorno, inyecta dependencias mock o conecta con bases de datos en memoria/sandbox.
- `execute()`: Ejecuta las operaciones específicas de la suite.
- `verify()`: Compara el estado resultante contra el estado esperado.
- `collectMetrics()`: Extrae métricas de rendimiento y payload de la iteración.
- `teardown()`: Limpia el estado y restablece el entorno.

### `ScenarioRunner`
El orquestador encargado de instanciar las suites, ejecutarlas en orden, recolectar las métricas mediante `collectMetrics()` y compilar el reporte final.

### `VerificationFixtures`
Generadores de datos sintéticos pero semánticamente correctos, capaces de poblar la base de datos con grafos de entidades complejos (ej. `Subject` → `Course` → `Assessment` → `AssessmentFile`).

---

## 3. Suites Oficiales (v1.0)

El framework incluye las siguientes suites obligatorias para certificar el protocolo:

- **CreateSyncSuite:** Validación de propagación de nuevas entidades (Escenario 1).
- **UpdateSyncSuite:** Validación de propagación y merge de ediciones (Escenario 2).
- **DeleteSyncSuite:** Validación de borrados lógicos y propagación en cascada (Escenario 3).
- **ConflictSuite:** Resolución determinista bajo estrés de mutaciones concurrentes (Escenario 4).
- **AssetPipelineSuite:** Ciclo de vida híbrido de metadatos (Sync) y binarios (Backup) (Escenario 5).
- **ColdRecoverySuite:** La prueba definitiva. Restauración desde cero de un perfil de uso 100% real (Escenario 6).
- **IdempotencySuite:** Validación de sincronizaciones repetitivas en vacío (Escenario 7).
- **TopologySuite:** Somete al `DependencyResolver` a payloads con eventos caóticos y reordenados intencionalmente (Escenario 8).

*(El diseño permite incorporar fácilmente futuras suites como `StressSuite`, `MigrationSuite` o `NetworkChaosSuite`).*

---

## 4. Métricas y Reportes

El framework trasciende el binarismo de PASS/FAIL, recolectando telemetría crítica de cada ejecución para detectar regresiones de rendimiento:

```text
Protocol Verification Report
----------------------------
Create          PASS
Update          PASS
Delete          PASS
Conflict        PASS
Asset           PASS
Recovery        PASS
Topology        PASS
Idempotency     PASS

Metrics
-------
Tiempo Sync (P95)   : 2.1 s
Tiempo Restore      : 3.8 s
Payload Enviado     : 8.4 MB
Archivos Transferidos: 27
Registros JSON      : 184
Convergencia        : 100%
Conflictos Resueltos: 12
Errores Críticos    : 0
```

## 5. Criterios de Aceptación (PASS/FAIL)

Para que el framework determine un resultado global como **PASS**, se deben cumplir estrictamente las siguientes condiciones:
1. **0 Divergencias:** Las bases de datos de `Device A` y `Device B` deben ser criptográficamente o estructuralmente idénticas al finalizar la convergencia.
2. **0 Orphans:** Las aserciones de integridad referencial post-sync no deben detectar registros huérfanos.
3. **0 Duplicados:** La suite de Idempotencia no debe incrementar la cantidad de registros en operaciones redundantes.
4. **Restauración 100%:** `ColdRecoverySuite` debe regenerar todos los identificadores locales, asociaciones de archivos, y métricas de FSRS exactamente en su estado previo al wipe.
