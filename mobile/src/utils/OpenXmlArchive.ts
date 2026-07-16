import JSZip from 'jszip';

export interface XmlEntry {
  readonly path: string;
  readonly content: string;
}

/**
 * OpenXmlArchive
 * 
 * Abstracción ligera y reutilizable sobre JSZip para extraer texto de archivos
 * empaquetados bajo el estándar Open XML (PPTX, DOCX, XLSX, etc.).
 * 
 * Responsabilidades:
 * - Cargar el ZIP desde un ArrayBuffer.
 * - Enumerar archivos con un filtro (ordenados numéricamente).
 * - Leer el texto contenido en los archivos.
 */
export class OpenXmlArchive {
  private zip: JSZip | null = null;

  async load(buffer: ArrayBuffer): Promise<void> {
    this.zip = await JSZip.loadAsync(buffer);
  }

  /**
   * Busca archivos dentro del archivo ZIP cuyo nombre/ruta coincida con la 
   * expresión regular dada, y los retorna ordenados numéricamente.
   * Útil para `ppt/slides/slide1.xml`, `slide2.xml`, etc.
   */
  listFiles(pattern: RegExp): string[] {
    if (!this.zip) throw new Error('Archive not loaded. Call load() first.');
    
    const matched: string[] = [];
    this.zip.forEach((relativePath) => {
      if (pattern.test(relativePath)) {
        matched.push(relativePath);
      }
    });

    // Ordenamiento natural (ej: slide2.xml < slide10.xml)
    return matched.sort((a, b) => {
      const aNumMatch = a.match(/\d+/);
      const bNumMatch = b.match(/\d+/);
      if (aNumMatch && bNumMatch) {
        return parseInt(aNumMatch[0], 10) - parseInt(bNumMatch[0], 10);
      }
      return a.localeCompare(b);
    });
  }

  /**
   * Lee y retorna el contenido de un archivo específico dentro del archivo ZIP.
   */
  async readText(path: string): Promise<string> {
    if (!this.zip) throw new Error('Archive not loaded. Call load() first.');
    const file = this.zip.file(path);
    if (!file) return '';
    return await file.async('text');
  }

  destroy(): void {
    this.zip = null;
  }
}
