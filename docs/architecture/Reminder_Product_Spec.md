# Reminder System — Product Specification

Este documento define el **comportamiento** del sistema de recordatorios de Threshold desde la perspectiva del usuario. No es un documento técnico. Define qué hace el sistema, cuándo reacciona, cuándo insiste y cuándo deja de insistir.

---

## 1. Alcance

Threshold es una aplicación de estudio. Su propósito central es ayudar al usuario a:

- Asistir a clases
- Entregar trabajos
- Preparar exámenes
- Hacer repasos de flashcards
- Mantener hábitos de estudio

Los recordatorios no son un feature complementario. Son **parte del núcleo del producto**. Un usuario que no recibe el recordatorio correcto en el momento correcto pierde la razón de usar la app.

---

## 2. Categorías de Recordatorio

No clasificamos recordatorios por la entidad que los originan (examen, clase, mazo). Los clasificamos por su **comportamiento temporal**.

### 2.1 Recordatorio de Momento Fijo

**Definición**: Se dispara en un instante específico relativo a un evento. No repite.

**Entidades que lo generan**:

| Entidad | Ejemplo de regla |
|---------|-----------------|
| Assessment (examen, tarea, trabajo) | 7 días antes, 3 días antes, 24h antes, 1h antes |
| CalendarEvent (evento puntual) | 30 min antes, 5 min antes |
| GradingPeriod (cierre de nota) | 7 días antes, 1 día antes |

**Comportamiento**:
- La secuencia se define por la Policy de la entidad.
- Cada regla se dispara una sola vez.
- Si el usuario ignora una regla, la siguiente se dispara según lo programado.
- Si el usuario descarta la última regla de la secuencia, la secuencia termina.

### 2.2 Recordatorio de Evento Recurrente

**Definición**: Se dispara antes de cada ocurrencia de un evento que se repite en el tiempo.

**Entidades que lo generan**:

| Entidad | Ejemplo de regla |
|---------|-----------------|
| Schedule (horario de clase) | 30 min antes, 5 min antes, a la hora exacta |
| Habit (futuro) | Diariamente a una hora fija |

**Comportamiento**:
- La secuencia se repite por cada ocurrencia del evento.
- Al completarse una ocurrencia (clase iniciada o finalizada), la secuencia se resetea para la próxima.
- Si el usuario modifica el horario, se regenera la secuencia completa.

### 2.3 Recordatorio Persistente

**Definición**: No deja de insistir hasta que el usuariorealice una acción concreta o el evento expire.

**Entidades que lo generan**:

| Entidad | Ejemplo de regla |
|---------|-----------------|
| FlashcardDeck (mazo con review pendiente) | Cada 2 horas hasta que haga el repaso |
| StudySession (sesión pendiente) | Cada hora hasta que inicie la sesión |

**Comportamiento**:
- No tiene secuencia fija. Repite con un intervalo configurable.
- Solo termina cuando:
  - El usuario realiza la acción (marca el mazo como repasado, inicia la sesión).
  - El evento pierde vigencia (el mazo ya no tiene reviews pendientes).
- **No termina** porque el usuario descarte la notificación.
- **No termina** por el solo hecho de que el usuario abra la app.

### 2.4 Recordatorio Inteligente

**Definición**: Adapta su comportamiento basándose en el contexto del usuario.

**Entidades que lo generan**:

| Entidad | Ejemplo de regla |
|---------|-----------------|
| Review FSRS (review calculado por FSRS) | Reprogramar si el usuario no responde |
| StudySession (sesión con deadline) | Escalar frecuencia cuando el deadline se acerca |

**Comportamiento**:
- La secuencia no es estática. El sistema recalcula los timestamps cuando:
  - El usuario ignora repetidamente.
  - El contexto cambia (hora del día, día de la semana, urgencia del evento).
- Puede saltar pasos de la secuencia si detecta urgencia creciente.
- Puede reducir frecuencia si detecta que el usuario está activo (ya hizo repasos hoy).

### 2.5 Recordatorio de Progreso

**Definición**: Informa sobre el estado de un proceso en ejecución. No es un recordatorio temporal.

**Entidades que lo generan**:

| Entidad | Ejemplo |
|---------|---------|
| Backup upload/download | "Subiendo backup... 45%" |
| AI model download | "Descargando modelo de IA... 72%" |

**Comportamiento**:
- Se muestra, se actualiza, se elimina. No tiene secuencia.
- No participa del sistema de recordatorios. Se maneja directamente como notificación de progreso.
- El usuario puede cerrarlo en cualquier momento sin consecuencias.

### 2.6 Notificación de Resumen

**Definición**: Agrupa información de múltiples entidades en un solo recordatorio periódico.

**Entidades que lo generan**:

| Entidad | Ejemplo |
|---------|---------|
| Resumen semanal | "Tienes 3 exámenes esta semana, 2 mazos pendientes" |

**Comportamiento**:
- Se dispara una vez por período (semanal, mensual).
- No tiene secuencia. Es un evento aislado.
- No es un recordatorio de acción — informa, no recuerda.
- El usuario puede configurar día y hora de envío.

---

## 3. Interacciones del Usuario

### 3.1 Tipos de Interacción

Cuando el usuario recibe una notificación, puede realizar una de estas acciones:

| Acción | Descripción |
|--------|-------------|
| **Tocar** | Toca la notificación y abre la app |
| **Descartar** | Desliza para eliminar la notificación |
| **Ignorar** | No realiza ninguna acción (la notificación queda visible) |
| **Abrir la app manualmente** | Abre Threshold sin tocar la notificación |
| **Marcar como hecha** | Realiza la acción que el recordatorio sugiere (repasa el mazo, marca la clase como iniciada) |

### 3.2 Consecuencias por Acción

#### Tocar la notificación

| Categoría | Consecuencia |
|-----------|-------------|
| Momento Fijo | Se navega a la entidad. La notificación se elimina. Las siguientes reglas de la secuencia se mantienen programadas. |
| Recurrente | Se navega a la entidad. La notificación se elimina. La secuencia para esta ocurrencia termina. |
| Persistente | Se navega a la entidad. La notificación se elimina. Si el usuario realiza la acción, la secuencia termina. Si no, la siguiente regla se mantiene. |
| Inteligente | Se navega a la entidad. La notificación se elimina. El sistema recalcula según el feedback. |

#### Descartar la notificación

| Categoría | Consecuencia |
|-----------|-------------|
| Momento Fijo | Se elimina la notificación actual. Las siguientes reglas **se mantienen programadas**. Descartar no equivale a "entiendo, para de insistir". |
| Recurrente | Se elimina. Las siguientes reglas de la secuencia **se mantienen**. |
| Persistente | Se elimina. La siguiente regla **se mantiene**. El sistema no interpreta descarte como "dejó de insistir". |
| Inteligente | Se elimina. El sistema registra "descartó" y puede ajustar la frecuencia de la siguiente regla. |

#### Ignorar (no tocar, no descartar)

| Categoría | Consecuencia |
|-----------|-------------|
| Momento Fijo | La notificación permanece. La siguiente regla se dispara normalmente. |
| Recurrente | La notificación permanece. La siguiente regla se dispara normalmente. |
| Persistente | La notificación permanece. La siguiente regla se dispara según el intervalo. |
| Inteligente | La notificación permanece. El sistema registra "ignoró" y puede escalar frecuencia o cambiar tono. |

#### Abrir la app manualmente (sin tocar la notificación)

| Categoría | Consecuencia |
|-----------|-------------|
| Todas | Las notificaciones programadas se mantienen. Abrir la app no cancela nada. Solo la interacción explícita (tocar, descartar, marcar como hecha) tiene consecuencias sobre las reglas. |

#### Marcar como hecha (realizar la acción)

| Categoría | Consecuencia |
|-----------|-------------|
| Momento Fijo | La secuencia termina completamente. Se cancelan todas las notificaciones pendientes de esa secuencia. |
| Recurrente | La secuencia para esta ocurrencia termina. Las próximas ocurrencias generan nuevas secuencias. |
| Persistente | La secuencia termina. |
| Inteligente | La secuencia termina. El sistema registra "completó" como señal positiva para futuras adaptaciones. |

---

## 4. Secuencias por Defecto

### 4.1 Assessment (Examen / Tarea / Trabajo)

```
-7 días    →  "En 7 días tienes {name}"
-3 días    →  "En 3 días tienes {name}"
-24 horas  →  "Mañana tienes {name}"
-1 hora    →  "En 1 hora: {name}"
-0         →  "Es hora de: {name}"
```

**Perfil**: Standard (5 reglas).
**Perfil Minimal**: -24h, -1h, 0 (3 reglas).
**Perfil Persistent**: -7d, -3d, -24h, -1h, 0, +10min, +30min (7 reglas).

### 4.2 Schedule (Clase)

```
-30 min  →  "Clase de {subject} en 30 minutos"
-5 min   →  "Clase de {subject} en 5 minutos"
0        →  "Es hora de {subject}"
+10 min  →  "¿Ya estás en {subject}?" (si no la marcó como iniciada)
+20 min  →  "¿Todo bien con {subject}?" (si no la marcó como iniciada)
```

**Perfil**: Standard (5 reglas).
**Perfil Minimal**: -5min, 0 (2 reglas).
**Perfil Persistent**: -30min, -5min, 0, +10min, +20min, +30min (6 reglas).

**Regla de corte**: Las reglas post-evento (+10, +20, +30) solo se emiten si la clase no fue marcada como iniciada. Si el usuario la marcó, la secuencia termina en 0.

### 4.3 FlashcardDeck (Review Pendiente)

```
+0     →  "Tienes {count} tarjetas pendientes en {deck}"
+2h    →  "¿Listo para repasar {deck}?" (si no repasó)
+4h    →  "Todavía pendiente: {deck}" (si no repasó)
Mañana →  "No olvides repasar {deck}"
```

**Perfil**: Standard (4 reglas, intervalo creciente).
**Perfil Minimal**: +0, Mañana (2 reglas).
**Perfil Persistent**: +0, +2h, +4h, +8h, Mañana (5 reglas).

**Regla de corte**: Si el usuario repasa el mazo en cualquier momento, la secuencia se cancela.

### 4.4 Review FSRS (Próximo review calculado)

```
Cuando vence  →  "Es hora de repasar {subject}"
+2h            →  "¿Vamos con el repaso?" (si no respondió)
+4h            →  "Todavía pendiente: {subject}"
Mañana         →  "No olvides tu repaso de {subject}"
```

**Perfil**: Standard (4 reglas).
**Perfil Persistent**: +0, +2h, +4h, +8h, Mañana, +1día (6 reglas).

### 4.5 Notificación de Resumen (Semanal)

```
Día configurado, hora configurada →  "Tu resumen semanal: {summary}"
```

**Perfil**: Siempre 1 regla. Sin secuencia.

### 4.6 GradingPeriod (Cierre de Nota)

```
-7 días  →  "Cierre de {period} en 7 días"
-3 días  →  "Cierre de {period} en 3 días"
-24h     →  "Mañana cierra {period}"
```

**Perfil**: Standard (3 reglas).

---

## 5. Perfiles de Recordatorio

El usuario puede elegir un nivel de intensidad por categoría:

| Perfil | Característica | Uso recomendado |
|--------|---------------|-----------------|
| **Minimal** | Pocas notificaciones, solo lo esencial | Usuarios que no quieren ser interrumpidos |
| **Standard** | Balance entre alerta y respeto | Default para todos los tipos |
| **Persistent** | Insiste hasta que el usuario actúe | Examenes importantes, clases críticas |
| **Custom** | El usuario define sus reglas | Power users |

**Nota**: El perfil modifica la **estrategia temporal de la secuencia** (cantidad de recordatorios, distribución de los offsets y duración de la secuencia), pero no cambia la prioridad de interrupción ni la lógica de negocio. La prioridad de interrupción (qué recordatorio gana si hay varios al mismo tiempo) se asigna automáticamente según la urgencia contextual: un examen a pocas horas tiene prioridad alta, una clase normal tiene prioridad normal. Son ejes ortogonales — un reminder puede pertenecer a un perfil minimal pero tener prioridad alta por su contexto, o ser persistente pero rutinario.

**Default**: Standard para todas las categorías.

**Configuración por usuario**: Se almacena localmente (no se sincroniza entre dispositivos).

---

## 6. Reglas de Expiración

Cada categoría tiene un punto de expiración después del cual el recordatorio deja de ser útil:

| Categoría | Expira después de |
|-----------|------------------|
| Assessment | La fecha/hora del evento + 1 hora |
| Schedule | La hora de fin de la clase + 30 minutos |
| FlashcardDeck | Cuando el deck ya no tiene reviews pendientes |
| Review FSRS | Cuando el review se completó |
| GradingPeriod | La fecha de cierre del período |
| Notificación de Resumen | Nunca (se repite indefinidamente) |

---

## 7. Persistencia

Los recordatorios se reconstruyen automáticamente a partir de los datos del usuario. No existe una tabla de "recordatorios pendientes" que persista. La fuente de verdad son las entidades (assessments, schedules, flashcard decks, etc.), no las reglas que deciden cuándo notificar.

| Dato | Persistencia | Sincronización |
|------|-------------|----------------|
| Secuencias de recordatorios | No persisten. Se regeneran al montar desde las entidades. | No aplica |
| Plan de entrega (qué se muestra finalmente) | No persiste. Se recalcula cada vez que se necesita. | No aplica |
| Preferencias de usuario (perfil, categorías activas) | Almacenamiento local | No (preferencia local) |
| Feedback del usuario (tocó, descartó, ignoró) | Solo en memoria durante la sesión. | No aplica |

**Por qué no persistir las secuencias**: las secuencias son un índice derivado de entidades que ya existen. Si desaparecen, simplemente se reconstruyen desde las entidades. No hay pérdida porque la fuente de verdad nunca fue la regla, sino la entidad que la origina.

---

## 8. Comportamiento en Condiciones Especiales

### 8.1 App cerrada

Las notificaciones programadas permanecen registradas en el sistema operativo incluso si la aplicación está cerrada. No dependen de que la app esté abierta.

### 8.2 Teléfono apagado / reiniciado

Al reiniciar, el sistema operativo reprograma automáticamente las notificaciones que estaban registradas. Las que se hubieran disparado durante el apagado se pierden (no se recuperan retroactivamente).

**Decisión de producto**: Esto es aceptable. Si el usuario apagó el teléfono durante 3 horas y tenía una notificación de "clase en 5 minutos", no tiene sentido mostrársela al reiniciar. La siguiente regla de la secuencia se dispara normalmente.

### 8.3 Modo No Molestar (DND)

El sistema operativo suprime las notificaciones visualmente, pero las notificaciones siguen registrándose internamente. Threshold no necesita implementar lógica especial para DND. El SO la maneja.

### 8.4 Sin conexión a internet

Las notificaciones locales no requieren internet. Todo el sistema de recordatorios funciona 100% offline.

### 8.5 Múltiples dispositivos

Las secuencias de recordatorios no se sincronizan entre dispositivos. Cada dispositivo genera sus propias notificaciones de forma independiente. Esto es aceptable porque las notificaciones son experiencia local.

---

## 9. Decisiones de Producto Pendientes

Estas preguntas requieren una decisión antes de implementar:

| # | Pregunta | Opciones | Recomendación |
|---|----------|---------|---------------|
| 1 | ¿Las reglas post-evento (+10, +20 de clases) se disparan si la app está cerrada? | Sí / Solo si la app está abierta | Solo si la app está abierta (son contextuales, pierden valor si llegan tarde) |
| 2 | ¿El usuario puede silenciar una categoría completa temporalmente (ej: "no molestar por 2 horas")? | Sí / No | Sí (es feature de producto madura) |
| 3 | ¿Se muestra un badge en el ícono de la app con el count de recordatorios pendientes? | Sí / No | Sí (mantiene la urgencia visual) |
| 4 | ¿Las notificaciones de persistente (flashcard review) se muestran como ongoing notification (notification persistente en Android)? | Sí / No | Evaluar: ongoing evita que el usuario la descarte, pero puede ser molesto |
| 5 | ¿Se permite "posponer" un recordatorio (snooze 5/10/15 min)? | Sí / No | Sí, al menos para Standard y Persistent |
| 6 | ¿La notificación de resumen semanal incluye predicciones FSRS (ej: "vas a olvidar X si no repasas hoy")? | Sí / No | Sí (conecta con el dominio Knowledge que ya existe) |
| 7 | ¿Qué hace la app cuando el usuario niega permisos de notificación? | Bloquear funcionalidad / Mostrar banner en Configuración | Mostrar recordatorio persistente en Configuración explicando el beneficio y permitiendo reactivar. Nunca bloquear funcionalidades. |

---
