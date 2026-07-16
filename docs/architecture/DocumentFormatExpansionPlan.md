# Plan de Implementación: Expansión de Formatos en DocumentWorkspace

## 1. Resumen Ejecutivo
El objetivo de este plan es dotar a la aplicación móvil (y específicamente al componente `DocumentWorkspace`) de la capacidad de procesar, extraer y visualizar múltiples formatos de archivos de forma offline o semi-offline, manteniendo una experiencia de usuario unificada.

Para lograr esto sin depender de visores externos que rompan el contexto de la aplicación, el sistema se divide estrictamente en dos dominios de responsabilidad por cada formato:
1.  **Extractores (`DocumentExtractor`)**: Responsables de parsear el archivo binario/texto y convertirlo al contrato estándar `DocumentModel` (para consumo de la IA, indexación y búsquedas).
2.  **Renderizadores (`DocumentRenderer`)**: Responsables de la representación visual del documento en pantalla y de inyectar el motor de búsqueda resaltado (highlights).

**Estado actual del sistema (Jul 2026):**

| Formato | Extractor | Renderer | Búsqueda | Highlights |
|---------|-----------|----------|----------|-----------|
| PDF | ✅ `PdfDocumentExtractor` | ✅ `NativePdfRenderer` | ✅ | ✅ |
| TXT / MD | ✅ `TextDocumentExtractor` | ✅ `NativeTextRenderer` | 🔜 | 🔜 |
| JSON | ✅ `TextDocumentExtractor` | ✅ `NativeTextRenderer` + `CodeHighlighter` | 🔜 | 🔜 |
| XLSX / XLS / CSV | ✅ `XlsxExtractor` | ✅ `SpreadsheetRenderer` | 🔜 | 🔜 |
| DOCX | 🔜 Pendiente | 🔜 Pendiente | — | — |
| PPTX | ⏳ Cloud-first | ⏳ Usa PDF convertido | — | — |

---

## 2. Invariantes Arquitectónicos (Reglas de Oro)
1.  **Aislamiento del Workspace:** Ningún documento (excepto PPTX bajo ciertas condiciones de fallback) debe abrirse en una aplicación externa mediante *Intents*. Todo debe ocurrir dentro de `DocumentWorkspace`.
2.  **Motor de Búsqueda Homologado:** Todos los renderizadores que soporten búsqueda deben exponer un contrato imperativo con los métodos `search(term)`, `next()`, `prev()`, `clear()`.
3.  **Extracción Cacheada en Dos Niveles:** (1) Cache en RAM por sesión (`modelCache`, max 5 docs). (2) Cache persistente en MMKV keyed por MD5 del archivo (`doc-extraction-cache`). Primera apertura lenta; todas las siguientes instantáneas.
4.  **Resolución por Contrato:** `ExtractorRegistry` y `RendererRegistry` resuelven por `supports()` — nunca por índice. Agregar un formato nuevo sólo requiere implementar `supports()` en el extractor y el renderer. El resto del sistema permanece estático.
5.  **Backend como Red de Seguridad (PPTX):** Las presentaciones PPTX deben convertirse a PDF en el backend. El móvil recibe el PDF resultante y usa el pipeline estándar.

---

## 3. Contratos Centrales (Interfaces)

Cualquier nuevo formato que se agregue al sistema debe implementar obligatoriamente las siguientes dos interfaces en el `DocumentSystemFactory`:

### El Contrato de Extracción
```typescript
interface DocumentExtractor {
  /**
   * Toma un archivo de origen y devuelve un ExtractedDocument estandarizado
   * que contiene bloques de texto limpios para el modelo de dominio.
   */
  extractDocument(source: DocumentSource): Promise<ExtractedDocument>;
  
  /** Devuelve true si este extractor soporta el MimeType dado */
  supports(mimeType: string): boolean;
}
```

### El Contrato de Renderizado
```typescript
interface DocumentRenderer {
  /**
   * Componente React que se montará en el DocumentWorkspace.
   * Debe aceptar el ref de búsqueda para la comunicación UI <-> Renderizador.
   */
  render(props: {
    model: DocumentModel;
    searchRef?: MutableRefObject<DocumentSearchRef | null>;
    onSearchResult?: (total: number, current: number) => void;
  }): React.ReactElement;

  supports(mimeType: string): boolean;
}

interface DocumentSearchRef {
  search: (term: string) => void;
  next: () => void;
  prev: () => void;
  clear: () => void;
}
```

---

## 4. Fases de Implementación por Formato

### Fase 1: Formatos Planos (TXT, JSON, MD)
*Complejidad: Baja | Dependencias: Ninguna*

*   **Extractor (`TextDocumentExtractor`)**: Lee el string completo vía `expo-file-system`. Divide el texto usando `\n\n` para crear bloques lógicos (párrafos).
*   **Renderizador (`NativeTextRenderer`)**:
    *   **Opción A**: Un componente `<ScrollView>` con `<Text>` nativo. La búsqueda dinámica usaría una librería como `react-native-highlight-words`.
    *   **Opción B**: Un WebView ligero que inyecte el texto en una etiqueta `<pre>` o `<div>` y reutilice exactamente el mismo código JS de búsqueda que creamos para el `NativePdfRenderer`. *(Recomendado para uniformidad).*

### Fase 2: Documentos Enriquecidos (DOCX)
*Complejidad: Media | Dependencias: `mammoth`*

*   **Librería JS**: Instalación de `mammoth.js` (diseñado para extraer HTML semántico limpio a partir de archivos `.docx`).
*   **Extractor (`DocxExtractor`)**: Usa Mammoth en modo *extract-raw-text* para popular el `DocumentModel` sin etiquetas HTML.
*   **Renderizador (`HtmlDocumentRenderer`)**:
    *   Usa Mammoth en modo *convert-to-html*.
    *   Inyecta el HTML resultante en un WebView.
    *   **Búsqueda:** Se inyecta un script JS similar al del PDF pero basado en recorrer el DOM (TreeWalker) para envolver coincidencias en `<span class="highlight">`.

### Fase 3: Hojas de Cálculo (XLSX, CSV)
*Complejidad: Media | Dependencias: `xlsx` (SheetJS)*

*   **Librería JS**: Instalación de `xlsx` (versión comunitaria) para procesar libros de cálculo.
*   **Extractor (`XlsxExtractor`)**: Itera por las hojas activas y convierte cada fila en un texto concatenado separado por comas, creando un `TextBlock` por fila para que la IA entienda el contexto tabular.
*   **Renderizador (`HtmlDocumentRenderer`)**:
    *   SheetJS incluye la función `XLSX.utils.sheet_to_html()`.
    *   El HTML resultante se envuelve en un contenedor con `overflow: auto` para permitir scroll bidireccional (horizontal y vertical).
    *   Reutiliza el mismo sistema de búsqueda en el DOM creado en la Fase 2.

### Fase 4: Presentaciones (PPTX) y Archivos Complejos
*Complejidad: Alta | Dependencias: Backend*

Dado que no existe una librería JS ligera que renderice diapositivas complejas fielmente en un WebView offline:
*   **Estrategia Cloud-First**: Al momento de subir el archivo, el backend asume la responsabilidad de convertir el PPTX a PDF (usando herramientas como LibreOffice o APIs en la nube).
*   El móvil recibe y almacena el archivo ya convertido como PDF.
*   Se procesa utilizando el `PdfExtractor` y `NativePdfRenderer` existentes.
*   **Estrategia Offline (Fallback Estricto)**: Si el archivo se importa localmente sin internet, se muestra una tarjeta de error amigable: *"El formato PPTX requiere procesamiento en la nube. Por favor, conéctese a internet para optimizar este documento."*

---

## 5. Resumen de Herramientas a Integrar

Para ejecutar este plan, se requerirá la adición y validación técnica de las siguientes librerías dentro del entorno React Native:

1.  `mammoth` (Procesamiento de Word). Validar compatibilidad con los Polyfills de buffer/fs en React Native.
2.  `xlsx` (Procesamiento de Excel). Versión *mini* para reducir el peso del bundle.
3.  Reutilización agresiva del componente `react-native-webview` como contenedor de renderizado universal.

## 6. Siguientes Pasos
Una vez aprobado este plan, el flujo de trabajo comenzará por:
1.  Implementar `TextDocumentExtractor` y `HtmlDocumentRenderer` (con soporte para búsqueda inyectada).
2.  Validar el renderizado de archivos `.txt`.
3.  Integrar `mammoth.js` e implementar el pipeline completo para `.docx`.
