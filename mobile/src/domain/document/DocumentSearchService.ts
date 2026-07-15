import type { DocumentModel } from './DocumentModel';
import type { SearchQuery, SearchResult, SearchMatch } from './DocumentSearch';

export class DocumentSearchService {
  search(model: DocumentModel, query: SearchQuery): SearchResult {
    if (!query.text.trim()) {
      return { query: query.text, matches: [], total: 0 };
    }

    const matches: SearchMatch[] = [];
    const flags = query.caseSensitive ? 'g' : 'gi';
    const pattern = query.wholeWord
      ? new RegExp(`\\b${escapeRegex(query.text)}\\b`, flags)
      : new RegExp(escapeRegex(query.text), flags);

    for (const page of model.pages) {
      for (const block of page.content.textBlocks) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(block.content)) !== null) {
          const snippet = extractSnippet(block.content, match.index, query.text.length);
          matches.push({
            blockId: block.id,
            pageIndex: page.pageIndex,
            startOffset: match.index,
            endOffset: match.index + match[0].length,
            snippet,
          });
        }
      }
    }

    return { query: query.text, matches, total: matches.length };
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSnippet(text: string, matchStart: number, matchLength: number): string {
  const contextLength = 40;
  const start = Math.max(0, matchStart - contextLength);
  const end = Math.min(text.length, matchStart + matchLength + contextLength);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}
