# Diagnóstico de Bloqueos de Interfaz (Destellos Negros) y Notifee

## Contexto del Problema
En dispositivos Android con MIUI/HyperOS, se han reportado "destellos negros" (pantallazos) recurrentes, aproximadamente cada 15 segundos. Este intervalo coincide con el ciclo de `Delta Sync` de la aplicación. 
Los destellos negros son un síntoma clásico de un timeout en `SurfaceFlinger` (el compositor de ventanas de Android) provocado porque el hilo principal (Main Thread) o el hilo de JavaScript (JS Thread) están siendo bloqueados por una operación sincrónica pesada o una ráfaga inmanejable de llamadas nativas a través del Bridge de React Native.

## Hipótesis Original: Notifee (Long Running Operations)
La principal sospecha recayó sobre el sistema de notificaciones (`NotifeeOperationProvider`), encargado de mostrar el progreso del Delta Sync (Notificaciones LRO). Se hipotetizó que las continuas actualizaciones a la barra de progreso nativa saturaban el sistema de UI de Android.

## Soluciones Implementadas y Descartadas

1. **Eliminación de la barra de progreso nativa**: Se cambió el `progress: { max: 100, current: X }` por simple texto en el cuerpo de la notificación, para evitar que SystemUI se viera forzado a repintar la barra a 60fps.
2. **Throttling (Debounce)**: Se implementó un límite temporal (`UPDATE_THROTTLE_MS = 2000`) para garantizar que Notifee solo se llamara como máximo una vez cada 2 segundos por operación.
3. **Serialización del Reconciliador**: En `NotificationReconciler.ts`, se eliminó la ejecución concurrente (`Promise.all`) de cancelaciones y agendamientos, reemplazándola por bucles `for...of` secuenciales para evitar ráfagas repentinas en el Bridge nativo.
4. **Corrección de parsing de Fechas (Expo Notifications)**: Se solucionó un bug donde `triggerDate` no se leía correctamente (se recibía un timestamp en lugar de un objeto `Date`), provocando que el sistema cancelara y volviera a programar *todas* las notificaciones en cada ciclo de sync.

## Desactivación Total (Estado Actual)
A pesar de las optimizaciones, el destello negro persistió. Para aislar el problema, **el módulo de Notifee fue completamente desactivado**. 
Actualmente, los métodos visuales (`showOperationProgress`, `showOperationCompleted`, `showOperationFailed`, `showOperationCancelled`) contienen un `return;` en la primera línea. **La aplicación no está ejecutando código de notificaciones LRO.**

## Conclusión Crítica
Dado que los destellos negros **siguen ocurriendo** incluso con Notifee 100% deshabilitado (como confirmó el usuario tras las recargas), se concluye de manera definitiva que **Notifee no es el causante del destello negro**. 

El origen real del congelamiento radica en otra parte del ciclo del Delta Sync. Los principales sospechosos a investigar a continuación son:
1. **SQLite I/O Masivo / Bloqueo de Hilo**: Inserciones masivas que bloquean el JS Thread (ej. durante el upsert de sincronizaciones).
2. **React State Thrashing**: Cientos de re-renders simultáneos disparados por la invalidación de cachés (`KnowledgeProjection`) o la actualización masiva de repositorios al finalizar el sync.
3. **FSRS Aggregation**: Re-cálculo intensivo de las estadísticas de aprendizaje en el JS Thread al actualizarse el KnowledgeProvider.
