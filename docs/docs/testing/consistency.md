# Consistency Report

## Propósito

El Consistency Report se ejecuta post-suite para verificar la integridad de los datos entre dispositivos y backend.

## Verificaciones

### 1. Conteo de Entidades

Compara el número de filas por tabla entre todos los dispositivos y el backend (D0).

| Tabla | Device A | Device B | Backend | Coinciden |
|---|---|---|---|---|
| subjects | 5 | 5 | 5 | ✅ |
| courses | 3 | 3 | 3 | ✅ |
| flashcard_decks | 8 | 8 | 8 | ✅ |
| ... | ... | ... | ... | ... |

### 2. Integridad Referencial

| Verificación | Descripción |
|---|---|
| **FK orphans** | IDs que referencian padres inexistentes |
| **Duplicate PKs** | IDs duplicados en una tabla |
| **Missing deletions** | Entidades borradas en backend pero presentes en device |

### 3. Estado de Colas

| Dispositivo | Pending | Failed |
|---|---|---|
| Device A | 0 | 0 |
| Device B | 0 | 0 |

### 4. Consistencia de Versiones

| Tabla | Backend version | Device A | Device B | Max table |
|---|---|---|---|---|
| subjects | 42 | 42 | 42 | 42 |
| courses | 35 | 35 | 35 | 35 |

## Interpretación

| Resultado | Significado |
|---|---|
| ✅ **CONSISTENT** | Todos los dispositivos y backend tienen el mismo estado |
| ❌ **INCONSISTENT** | Hay diferencias — el sync no converge |
| ⚠️ **QUEUE_NOT_EMPTY** | Hay operaciones pendientes — sync incompleto |
