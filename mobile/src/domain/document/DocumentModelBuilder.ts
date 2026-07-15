import type { ExtractedDocument } from './ExtractedDocument';
import type { DocumentModel, DocumentPage, DocumentTocEntry } from './DocumentModel';
import type { TextBlock, TextBlockRole } from './types';
import { DocumentCapabilities } from './DocumentCapabilities';
import { DocumentAction } from './DocumentAction';

const CHARS_PER_PAGE = 3000;

export class DocumentModelBuilder {
  private readonly _extracted: ExtractedDocument;
  private readonly _capabilities: DocumentCapabilities;

  constructor(extracted: ExtractedDocument, capabilities?: DocumentCapabilities) {
    this._extracted = extracted;
    this._capabilities = capabilities ?? defaultCapabilities(extracted);
  }

  build(documentId: string, title: string): DocumentModel {
    const taggedBlocks = tagRoles(this._extracted.textBlocks);
    const extracted: ExtractedDocument = { ...this._extracted, textBlocks: taggedBlocks };
    const pages = buildPages(extracted);
    const tableOfContents = buildToc(taggedBlocks, pages);

    return {
      documentId,
      title,
      pages,
      tableOfContents,
      capabilities: this._capabilities,
    };
  }
}

function tagRoles(blocks: readonly TextBlock[]): TextBlock[] {
  return blocks.map((block): TextBlock => {
    const firstLine = block.content.split('\n')[0]?.trim() ?? '';
    const wordCount = firstLine.split(/\s+/).length;
    const charCount = firstLine.length;

    let role: TextBlockRole = 'paragraph';

    if (charCount > 0 && charCount <= 60 && wordCount <= 8) {
      if (/^#{1,2}\s/.test(firstLine) || /^[A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚ\s]{2,}$/.test(firstLine)) {
        role = 'heading';
      } else if (/^#{3}\s/.test(firstLine) || /^\d+[\.\)]\s[A-Z]/.test(firstLine)) {
        role = 'subheading';
      } else if (/^[A-ZÁÉÍÓÚ]/.test(firstLine) && charCount <= 80 && !firstLine.endsWith('.')) {
        role = 'subheading';
      }
    }

    return { ...block, role };
  });
}

function buildPages(extracted: ExtractedDocument): readonly DocumentPage[] {
  if (extracted.textBlocks.length === 0) {
    return [{ pageIndex: 0, content: extracted }];
  }

  // If blocks already carry page metadata (startIndex clustered), group them
  // Otherwise, split by character budget preserving block boundaries
  const groups = groupBlocksByPage(extracted.textBlocks);

  return groups.map((blocks, i) => ({
    pageIndex: i,
    content: {
      textBlocks: blocks,
      images: [],
      tables: [],
      metadata: extracted.metadata,
    },
  }));
}

function groupBlocksByPage(blocks: readonly TextBlock[]): TextBlock[][] {
  const groups: TextBlock[][] = [];
  let current: TextBlock[] = [];
  let charCount = 0;

  for (const block of blocks) {
    const len = block.content.length;
    // Start a new page if budget exceeded, but never split mid-heading
    if (charCount + len > CHARS_PER_PAGE && current.length > 0 && block.role !== 'heading') {
      groups.push(current);
      current = [];
      charCount = 0;
    }
    current.push(block);
    charCount += len;
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}

function buildToc(
  blocks: readonly TextBlock[],
  pages: readonly DocumentPage[],
): readonly DocumentTocEntry[] {
  const entries: DocumentTocEntry[] = [];

  for (const block of blocks) {
    if (block.role !== 'heading' && block.role !== 'subheading') continue;
    const firstLine = block.content.split('\n')[0]?.trim();
    if (!firstLine) continue;

    // Find which page this block lives in
    const pageIndex = pages.findIndex(p =>
      p.content.textBlocks.some(b => b.startIndex === block.startIndex),
    );

    entries.push({ title: firstLine, pageIndex: pageIndex >= 0 ? pageIndex : 0 });
  }

  if (entries.length === 0 && pages.length > 1) {
    pages.forEach((_, i) => entries.push({ title: `Página ${i + 1}`, pageIndex: i }));
  }

  return entries;
}

function defaultCapabilities(extracted: ExtractedDocument): DocumentCapabilities {
  const actions = [DocumentAction.Search, DocumentAction.Copy];

  if (extracted.textBlocks.length > 0) {
    actions.push(DocumentAction.Highlight);
    actions.push(DocumentAction.AskAI);
    actions.push(DocumentAction.CreateFlashcard);
  }

  return new DocumentCapabilities(actions);
}
