# Patrones Arquitectónicos de Threshold

A medida que Threshold evoluciona, han emergido diversos patrones arquitectónicos comunes en sus subsistemas principales (Sync, Reminders, Academic Import, etc.). Este documento no explica módulos individuales, sino que define las reglas fundamentales y los patrones estructurales que rigen la creación de nuevos componentes en el sistema.

## 1. Domain Isolation (Aislamiento de Dominio)
Todo modelo de dominio debe ser absolutamente independiente de:
- Frameworks UI (React, React Native, Expo)
- Detalles de persistencia (SQLite, MMKV)
- Formatos de entrada/salida (CSV, PDF, JSON externos)
- Librerías de terceros (i18n, APIs de red)

*Regla: Si un archivo en la capa de dominio importa algo de infraestructura o de la capa de vista, está rompiendo este principio.*

## 2. Pipeline Pattern
Para flujos complejos de ingesta o procesamiento, el sistema se divide en etapas unidireccionales puras. Un pipeline típico fluye así:

`Input` → `Importer/Parser` → `Domain Model` → `Validators` → `Transformers` → `Executor`

Cada etapa tiene una única responsabilidad y un único motivo para cambiar.

## 3. Builder / Transformer Pattern
Los constructores y transformadores son responsables de mapear un estado (o modelo de dominio) hacia otra forma (ej. ViewModel o Preview).
- **Entrada:** `Domain Model` + inyecciones secundarias (ej. Warnings/Errors)
- **Salida:** `ViewModel` / `PreviewModel`
- **Regla:** Un Builder NO debe validar negocio ni ejecutar efectos secundarios (como llamadas a DB). Su naturaleza debe acercarse lo más posible a una función pura.

## 4. Validator Pattern
Los validadores procesan reglas de negocio u operativas sin mutar el modelo.
- **Responsabilidad:** Producir listas de advertencias (`Warnings`) y errores (`Errors`).
- **Composición:** Pueden dividirse por capa (`BusinessValidator`, `DuplicateValidator`, `HeaderValidator`).
- **Regla:** Un Validator nunca modifica el estado del `Domain Model`, solo retorna sus hallazgos. Los errores deben apoyarse en códigos (ej. Enums) y no depender únicamente de mensajes de texto, permitiendo así soporte multi-idioma nativo.

## 5. Executor Pattern
Los Executors consumen modelos previamente validados para interactuar con la infraestructura (persistir, notificar, enviar a red).
- **Responsabilidad:** Consolidar transacciones, invocar a la base de datos o encolar tareas.
- **Regla:** Los Executors no validan datos, no parsean formatos ni renderizan salidas. Confían ciegamente en que el modelo entregado por el Pipeline ya es estructuralmente correcto y libre de errores de negocio.

---
*Nota: Aplicar estos patrones asegura que Threshold se mantenga altamente testeable, escalable y mantenible. Si encuentras un componente sobrecargado (God Component), considera refractarlo aplicando estas reglas.*
