import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { documentRepository, type DocumentWithSubject } from '../services/database/repositories/DocumentRepository';
import { useRouter } from 'expo-router';

export interface DocumentSection {
  subjectName: string;
  subjectColor?: string;
  items: DocumentWithSubject[];
}

function getFormatFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'doc';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm') || lower.endsWith('.xls') || lower.endsWith('.csv')) return 'xls';
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return 'ppt';
  if (lower.endsWith('.txt')) return 'txt';
  if (lower.endsWith('.json')) return 'json';
  return 'other';
}

export const useDocumentsManager = () => {
  const { t } = useTranslation();
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentWithSubject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCourseFilter, setActiveCourseFilter] = useState<string>('all');
  const [activeSubjectFilter, setActiveSubjectFilter] = useState<string>('all');
  const [activeFormatFilter, setActiveFormatFilter] = useState<string>('all');
  const isLoadingRef = useRef(false);

  const loadDocuments = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      const docs = await documentRepository.getAllWithSubjects();
      setDocuments(docs);
    } catch (e) {
      console.warn('[useDocumentsManager] Error loading documents:', e);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const courses = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    documents.forEach((d) => {
      if (d.course_id && d.course_name && !map.has(d.course_id)) {
        map.set(d.course_id, { id: d.course_id, name: d.course_name });
      }
    });
    return Array.from(map.values());
  }, [documents]);

  const subjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; courseId?: string | null }>();
    documents.forEach((d) => {
      if (d.subject_id && d.subject_name && !map.has(d.subject_id)) {
        map.set(d.subject_id, { id: d.subject_id, name: d.subject_name, courseId: d.course_id });
      }
    });
    return Array.from(map.values());
  }, [documents]);

  const filteredSubjects = useMemo(() => {
    if (activeCourseFilter === 'all') return subjects;
    return subjects.filter((s) => s.courseId === activeCourseFilter);
  }, [subjects, activeCourseFilter]);

  const availableFormats = useMemo(() => {
    const counts: Record<string, number> = {};
    const filtered = activeCourseFilter === 'all' ? documents
      : documents.filter((d) => d.course_id === activeCourseFilter);
    filtered.forEach((d) => {
      const fmt = getFormatFromUri(d.local_uri || '');
      counts[fmt] = (counts[fmt] || 0) + 1;
    });
    return ['pdf', 'doc', 'xls', 'ppt', 'txt', 'json'].filter((f) => counts[f] && counts[f] > 0);
  }, [documents, activeCourseFilter]);

  const sections: DocumentSection[] = useMemo(() => {
    const UNCLASSIFIED = t('dashboard.audioRecorderModal.unclassified') || 'Sin clasificar';
    const q = searchQuery.trim().toLowerCase();
    const bySubject = new Map<string, DocumentSection>();

    const getOrCreate = (name: string, color?: string): DocumentSection => {
      if (!bySubject.has(name)) {
        bySubject.set(name, { subjectName: name, subjectColor: color, items: [] });
      }
      return bySubject.get(name)!;
    };

    documents.forEach((doc) => {
      if (activeCourseFilter !== 'all' && doc.course_id !== activeCourseFilter) return;
      if (activeSubjectFilter !== 'all' && doc.subject_id !== activeSubjectFilter) return;
      if (activeFormatFilter !== 'all' && getFormatFromUri(doc.local_uri || '') !== activeFormatFilter) return;
      if (q && !(doc.name || '').toLowerCase().includes(q) && !(doc.subject_name || '').toLowerCase().includes(q)) return;

      const subjectName = doc.subject_name || UNCLASSIFIED;
      const section = getOrCreate(subjectName, doc.subject_color || undefined);
      section.items.push(doc);
    });

    return Array.from(bySubject.values())
      .filter((s) => s.items.length > 0)
      .sort((a, b) => {
        if (a.subjectName === UNCLASSIFIED) return 1;
        if (b.subjectName === UNCLASSIFIED) return -1;
        return a.subjectName.localeCompare(b.subjectName);
      });
  }, [documents, searchQuery, activeCourseFilter, activeSubjectFilter, activeFormatFilter, t]);

  const handlePressDocument = useCallback((doc: DocumentWithSubject) => {
    if (!doc.local_uri) return;
    router.push({
      pathname: '/documents/[documentUri]',
      params: {
        documentUri: doc.local_uri,
        documentTitle: doc.name || 'Documento',
        documentId: doc.id,
      },
    });
  }, [router]);

  const handleDeleteDocument = useCallback(async (docId: string) => {
    try {
      await documentRepository.delete(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (e) {
      console.warn('[useDocumentsManager] Error deleting document:', e);
    }
  }, []);

  return {
    documents,
    isLoading,
    searchQuery,
    setSearchQuery,
    activeCourseFilter,
    setActiveCourseFilter,
    activeSubjectFilter,
    setActiveSubjectFilter,
    activeFormatFilter,
    setActiveFormatFilter,
    courses,
    subjects,
    availableFormats,
    sections,
    loadDocuments,
    handlePressDocument,
    handleDeleteDocument,
  };
};
