import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { theme } from '../../styles/theme';
import type {
  DocumentRenderer,
  OnPageChange,
  OnDocumentReady,
  OnTextSelection,
  ScrollToPageRef,
  OnSearchResult,
} from '../../domain/document/DocumentRenderer';
import type { DocumentModel } from '../../domain/document/DocumentModel';
import type { DocumentSource } from '../../domain/document/DocumentSource';
import type { DocumentHighlight } from '../../domain/document/DocumentHighlight';
import type { MutableRefObject } from 'react';

export interface PdfHighlightRef {
  set: (highlights: readonly DocumentHighlight[]) => void;
}

export class NativePdfRenderer implements DocumentRenderer {
  supports(model: DocumentModel): boolean {
    const format = model.pages[0]?.content?.metadata?.format?.toLowerCase() || '';
    return format === 'pdf' || format === 'application/pdf';
  }

  render(
    model: DocumentModel,
    onPageChange?: OnPageChange,
    scrollToPageRef?: ScrollToPageRef,
    onDocumentReady?: OnDocumentReady,
    onSelection?: OnTextSelection,
    _highlightedBlockId?: string,
    searchRef?: MutableRefObject<PdfSearchRef | null>,
    onSearchResult?: OnSearchResult,
    highlightsRef?: MutableRefObject<PdfHighlightRef | null>,
    onHighlightTapped?: (id: string) => void,
    _source?: DocumentSource,
  ): unknown {
    const fileUri = model.documentId.startsWith('file://')
      ? model.documentId
      : `${FileSystem.documentDirectory}Threshold/pdf/${model.documentId}`;

    return (
      <NativePdfRendererContent
        fileUri={fileUri}
        onPageChange={onPageChange}
        scrollToPageRef={scrollToPageRef}
        onDocumentReady={onDocumentReady}
        onSelection={onSelection}
        searchRef={searchRef}
        onSearchResult={onSearchResult}
        highlightsRef={highlightsRef}
        onHighlightTapped={onHighlightTapped}
      />
    );
  }
}

interface NativePdfRendererContentProps {
  fileUri: string;
  onPageChange?: OnPageChange;
  scrollToPageRef?: ScrollToPageRef;
  onDocumentReady?: OnDocumentReady;
  onSelection?: OnTextSelection;
  searchRef?: MutableRefObject<PdfSearchRef | null>;
  onSearchResult?: OnSearchResult;
  highlightsRef?: MutableRefObject<PdfHighlightRef | null>;
  onHighlightTapped?: (id: string) => void;
}

export interface PdfSearchRef {
  search: (term: string) => void;
  next: () => void;
  prev: () => void;
  clear: () => void;
}

function buildHtmlFromUri(fileUri: string, bgColor: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=4.0, user-scalable=yes" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: ${bgColor}; width: 100%; overflow-x: hidden; }
    #pdf-container {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      padding: 8px 0;
      gap: 8px;
      width: 100%;
    }
    .page-wrapper {
      position: relative;
      width: 100%;
      background-color: white;
      margin-bottom: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    canvas {
      position: absolute;
      left: 0;
      top: 0;
      width: 100% !important;
      height: 100% !important;
    }
    .highlight {
      position: absolute;
      background: rgba(255, 220, 0, 0.45);
      border-radius: 2px;
      pointer-events: none;
      z-index: 5;
    }
    .highlight.active {
      background: rgba(255, 140, 0, 0.65);
    }
    .textLayer {
      position: absolute;
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      overflow: hidden;
      line-height: 1.0;
      -webkit-user-select: none;
      user-select: none;
      pointer-events: auto;
      z-index: 10;
    }
    .textLayer > span, .textLayer > br {
      position: absolute;
      white-space: pre;
      transform-origin: 0% 0%;
      color: rgba(0,0,0,0.01) !important;
      cursor: text;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
  </style>
</head>
<body>
  <div id="pdf-container"></div>
  <script>
    function postMsg(obj) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      }
    }

    window.onerror = function(message, source, lineno) {
      postMsg({ type: 'error', message: 'Global Error: ' + message + ' at line ' + lineno });
    };

    try {
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF.js falló al cargar. Verifica tu conexión a internet.');
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    } catch (err) {
      postMsg({ type: 'error', message: err.message });
    }

    var totalPages = 0;
    var lastReportedPage = 0;
    var pageData = {};
    var allMatches = [];
    var currentMatchIndex = -1;
    var currentHighlights = [];
    var currentSearchTerm = '';

    function getCurrentPage() {
      var wrappers = document.querySelectorAll('.page-wrapper[data-page]');
      if (!wrappers.length) return 1;
      var mid = window.scrollY + window.innerHeight / 2;
      var current = 1;
      wrappers.forEach(function(w) {
        if (w.offsetTop <= mid) {
          current = parseInt(w.getAttribute('data-page'), 10);
        }
      });
      return current;
    }

    window.addEventListener('scroll', function() {
      var p = getCurrentPage();
      if (p !== lastReportedPage) {
        lastReportedPage = p;
        postMsg({ type: 'pageChange', page: p });
      }
    }, { passive: true });

    function clearHighlights() {
      document.querySelectorAll('.highlight:not(.persistent-highlight)').forEach(function(el) { el.remove(); });
      allMatches = [];
      currentMatchIndex = -1;
    }

    function buildHighlight(wrapper, item, unscaledW, unscaledH, isActive) {
      var canvas = wrapper.querySelector('canvas');
      var rect = canvas.getBoundingClientRect();
      var actualW = rect.width > 0 ? rect.width : canvas.offsetWidth;
      var effectiveScale = actualW / unscaledW;
      var pageHeightCSS  = unscaledH * effectiveScale;

      var userX = item.transform[4];
      var userY = item.transform[5];
      var fontSizeUser  = Math.abs(item.transform[3]);
      var fontSizePx    = fontSizeUser * effectiveScale;
      var ascentPx      = fontSizePx * 0.8;

      var el = document.createElement('div');
      el.className = 'highlight' + (isActive ? ' active' : '');
      el.style.left   = (userX * effectiveScale) + 'px';
      el.style.top    = (pageHeightCSS - userY * effectiveScale - ascentPx) + 'px';
      el.style.width  = (item.width * effectiveScale) + 'px';
      el.style.height = fontSizePx + 'px';
      wrapper.appendChild(el);
      return el;
    }

    function searchInAllPages(term) {
      currentSearchTerm = term;
      clearHighlights();
      if (!term || !term.trim()) {
        postMsg({ type: 'searchResult', total: 0, current: 0 });
        return;
      }
      var lower = term.toLowerCase();
      var matches = [];

      Object.keys(pageData).sort(function(a,b){ return parseInt(a)-parseInt(b); }).forEach(function(pageNum) {
        var data = pageData[pageNum];
        if (!data || !data.textItems) return;
        var wrapper = document.querySelector('.page-wrapper[data-page="' + pageNum + '"]');
        if (!wrapper) return;

        data.textItems.forEach(function(item) {
          if (!item.str || !item.str.toLowerCase().includes(lower)) return;
          matches.push({
            pageNum: parseInt(pageNum),
            wrapper: wrapper,
            unscaledW: data.unscaledW,
            unscaledH: data.unscaledH,
            item: item
          });
        });
      });

      allMatches = matches;
      matches.forEach(function(m) {
        m.el = buildHighlight(m.wrapper, m.item, m.unscaledW, m.unscaledH, false);
      });

      if (matches.length > 0) {
        currentMatchIndex = 0;
        activateMatch(0);
      } else {
        postMsg({ type: 'searchResult', total: 0, current: 0 });
      }
    }

    function activateMatch(index) {
      allMatches.forEach(function(m, i) {
        if (m.el) {
          m.el.className = 'highlight' + (i === index ? ' active' : '');
        }
      });
      var m = allMatches[index];
      if (m && m.el) {
        m.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      postMsg({ type: 'searchResult', total: allMatches.length, current: index });
    }

    function searchNext() {
      if (!allMatches.length) return;
      currentMatchIndex = (currentMatchIndex + 1) % allMatches.length;
      activateMatch(currentMatchIndex);
    }

    function searchPrev() {
      if (!allMatches.length) return;
      currentMatchIndex = (currentMatchIndex - 1 + allMatches.length) % allMatches.length;
      activateMatch(currentMatchIndex);
    }

    window.handleRNCommand = function(json) {
      try {
        var cmd = JSON.parse(json);
        if (cmd.type === 'search')      { searchInAllPages(cmd.term); }
        else if (cmd.type === 'next')   { searchNext(); }
        else if (cmd.type === 'prev')   { searchPrev(); }
        else if (cmd.type === 'clear')  { clearHighlights(); postMsg({ type: 'searchResult', total: 0, current: 0 }); }
        else if (cmd.type === 'goPage') {
          var c = document.querySelector('.page-wrapper[data-page="' + cmd.page + '"]');
          if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        else if (cmd.type === 'renderHighlights') { 
          currentHighlights = cmd.highlights;
          renderAllPersistentHighlights(); 
        }
        else if (cmd.type === 'clearSelection') { clearCustomSelection(); }
      } catch(e) {}
    };

    function renderPersistentHighlightsForPage(pageNum) {
      var wrapper = document.querySelector('.page-wrapper[data-page="' + pageNum + '"]');
      if (!wrapper) return;
      wrapper.querySelectorAll('.persistent-highlight').forEach(function(el) { el.remove(); });
      
      var data = pageData[pageNum];
      if (!data || data.state !== 'rendered') return;
      
      var pageHighlights = currentHighlights.filter(function(hl) { return (hl.pageIndex + 1) === pageNum; });
      if (!pageHighlights.length) return;

      var canvas = wrapper.querySelector('canvas');
      if (!canvas) return;
      var rect = canvas.getBoundingClientRect();
      var actualW = rect.width > 0 ? rect.width : canvas.offsetWidth;
      var effectiveScale = actualW / data.unscaledW;
      var pageHeightCSS = data.unscaledH * effectiveScale;

      var colorMap = {
        yellow: 'rgba(255, 220, 0, 0.45)',
        green:  'rgba(0, 200, 83, 0.35)',
        blue:   'rgba(33, 150, 243, 0.35)',
        pink:   'rgba(233, 30, 99, 0.30)',
        orange: 'rgba(255, 152, 0, 0.40)',
      };

      pageHighlights.forEach(function(hl) {
        var startIdx = hl.anchorOffset != null ? hl.anchorOffset : 0;
        var endIdx = hl.focusOffset != null ? hl.focusOffset : 0;
        
        var spanIdx = 0;
        var lineBlocks = [];
        var currentBlock = null;

        for (var i = 0; i < data.textItems.length; i++) {
          var item = data.textItems[i];
          if (!item.str || !item.str.trim()) continue;
          
          if (spanIdx >= startIdx && spanIdx <= endIdx) {
            var userX = item.transform[4];
            var userY = item.transform[5];
            var fontSizeUser = Math.abs(item.transform[3]);
            var itemWidth = item.width || (item.str.length * fontSizeUser * 0.5);

            if (!currentBlock) {
               currentBlock = { y: userY, minX: userX, maxX: userX + itemWidth, fontSize: fontSizeUser };
            } else {
               if (Math.abs(currentBlock.y - userY) < 5) { // Same line tolerance
                  currentBlock.minX = Math.min(currentBlock.minX, userX);
                  currentBlock.maxX = Math.max(currentBlock.maxX, userX + itemWidth);
                  currentBlock.fontSize = Math.max(currentBlock.fontSize, fontSizeUser);
               } else {
                  lineBlocks.push(currentBlock);
                  currentBlock = { y: userY, minX: userX, maxX: userX + itemWidth, fontSize: fontSizeUser };
               }
            }
          } else if (spanIdx > endIdx) {
            break; // Stop looping past the highlight end
          }
          spanIdx++;
        }
        if (currentBlock) lineBlocks.push(currentBlock);

        lineBlocks.forEach(function(block) {
          var el = document.createElement('div');
          el.className = 'highlight persistent-highlight';
          el.style.background = colorMap[hl.color] || colorMap.yellow;
          el.setAttribute('data-hl-id', hl.id);
          el.style.borderRadius = '3px';

          var fontSizePx = block.fontSize * effectiveScale;
          var ascentPx = fontSizePx * 0.8;

          el.style.left = (block.minX * effectiveScale) + 'px';
          el.style.top = (pageHeightCSS - block.y * effectiveScale - ascentPx) + 'px';
          el.style.width = ((block.maxX - block.minX) * effectiveScale) + 'px';
          el.style.height = fontSizePx + 'px';

          wrapper.appendChild(el);
        });
      });
    }

    function renderAllPersistentHighlights() {
      Object.keys(pageData).forEach(function(pageNum) {
        var p = parseInt(pageNum, 10);
        if (pageData[p] && pageData[p].state === 'rendered') {
          renderPersistentHighlightsForPage(p);
        }
      });
    }

    var selectionMode = false;
    var longPressTimer = null;
    var touchStartX = 0, touchStartY = 0;
    var selStartSpan = null;
    var selEndSpan = null;

    function clearCustomSelection() {
      document.querySelectorAll('.custom-selection').forEach(function(el) { el.remove(); });
      selStartSpan = null;
      selEndSpan = null;
    }

    function renderCustomSelection() {
      document.querySelectorAll('.custom-selection').forEach(function(el) { el.remove(); });
      if (!selStartSpan || !selEndSpan) return '';
      
      var pageNum = selStartSpan.page;
      var startIdx = Math.min(selStartSpan.idx, selEndSpan.idx);
      var endIdx = Math.max(selStartSpan.idx, selEndSpan.idx);
      
      var wrapper = document.querySelector('.page-wrapper[data-page="' + pageNum + '"]');
      if (!wrapper) return '';
      var data = pageData[pageNum];
      if (!data) return '';
      
      var canvas = wrapper.querySelector('canvas');
      var rect = canvas.getBoundingClientRect();
      var actualW = rect.width > 0 ? rect.width : canvas.offsetWidth;
      var effectiveScale = actualW / data.unscaledW;
      var pageHeightCSS = data.unscaledH * effectiveScale;
      
      var spanIdx = 0;
      var textParts = [];
      var lineBlocks = [];
      var currentBlock = null;

      data.textItems.forEach(function(item) {
        if (!item.str || !item.str.trim()) return;
        if (spanIdx >= startIdx && spanIdx <= endIdx) {
          textParts.push(item.str);
          
          var userX = item.transform[4];
          var userY = item.transform[5];
          var fontSizeUser = Math.abs(item.transform[3]);
          var itemWidth = item.width || (item.str.length * fontSizeUser * 0.5);

          if (!currentBlock) {
             currentBlock = { y: userY, minX: userX, maxX: userX + itemWidth, fontSize: fontSizeUser };
          } else {
             if (Math.abs(currentBlock.y - userY) < 5) {
                currentBlock.minX = Math.min(currentBlock.minX, userX);
                currentBlock.maxX = Math.max(currentBlock.maxX, userX + itemWidth);
                currentBlock.fontSize = Math.max(currentBlock.fontSize, fontSizeUser);
             } else {
                lineBlocks.push(currentBlock);
                currentBlock = { y: userY, minX: userX, maxX: userX + itemWidth, fontSize: fontSizeUser };
             }
          }
        }
        spanIdx++;
      });
      if (currentBlock) lineBlocks.push(currentBlock);

      lineBlocks.forEach(function(block) {
         var el = document.createElement('div');
         el.className = 'highlight custom-selection';
         el.style.background = 'rgba(0, 110, 255, 0.3)';
         el.style.borderRadius = '3px';
         
         var fontSizePx = block.fontSize * effectiveScale;
         var ascentPx = fontSizePx * 0.8;
         
         el.style.left = (block.minX * effectiveScale) + 'px';
         el.style.top = (pageHeightCSS - block.y * effectiveScale - ascentPx) + 'px';
         el.style.width = ((block.maxX - block.minX) * effectiveScale) + 'px';
         el.style.height = fontSizePx + 'px';
         
         wrapper.appendChild(el);
      });
      return textParts.join(' ');
    }

    document.addEventListener('touchstart', function(e) {
      if (e.touches.length !== 1) return;
      var touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      
      if (!selectionMode && selStartSpan) {
        var el = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!el || !el.classList.contains('custom-selection')) {
           clearCustomSelection();
           postMsg({ type: 'textSelection', text: '', page: 1, startItemIdx: 0, endItemIdx: 0 }); 
        }
      }

      longPressTimer = setTimeout(function() {
        selectionMode = true;
        var el = document.elementFromPoint(touchStartX, touchStartY);
        if (el && el.hasAttribute('data-item-idx')) {
           var pageWrapper = el.closest('.page-wrapper');
           var pageNum = parseInt(pageWrapper.getAttribute('data-page'), 10);
           var idx = parseInt(el.getAttribute('data-item-idx'), 10);
           selStartSpan = { page: pageNum, idx: idx };
           selEndSpan = { page: pageNum, idx: idx };
           renderCustomSelection();
           if (window.navigator && window.navigator.vibrate) {
              window.navigator.vibrate(50);
           }
        }
      }, 400);
    }, { passive: false });

    document.addEventListener('touchmove', function(e) {
      if (selectionMode) {
        e.preventDefault(); 
        var touch = e.touches[0];
        var el = document.elementFromPoint(touch.clientX, touch.clientY);
        if (el && el.hasAttribute('data-item-idx')) {
           var pageWrapper = el.closest('.page-wrapper');
           if (pageWrapper) {
             var pageNum = parseInt(pageWrapper.getAttribute('data-page'), 10);
             if (pageNum === selStartSpan.page) { 
               var idx = parseInt(el.getAttribute('data-item-idx'), 10);
               if (idx !== selEndSpan.idx) {
                 selEndSpan.idx = idx;
                 renderCustomSelection();
               }
             }
           }
        }
      } else if (longPressTimer) {
         var touch = e.touches[0];
         var dx = touch.clientX - touchStartX;
         var dy = touch.clientY - touchStartY;
         if (dx*dx + dy*dy > 100) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
         }
      }
    }, { passive: false });

    document.addEventListener('touchend', function(e) {
      if (longPressTimer) {
         clearTimeout(longPressTimer);
         longPressTimer = null;
      }
      if (selectionMode) {
         selectionMode = false;
         if (selStartSpan && selEndSpan) {
            var text = renderCustomSelection();
            var startIdx = Math.min(selStartSpan.idx, selEndSpan.idx);
            var endIdx = Math.max(selStartSpan.idx, selEndSpan.idx);
            postMsg({
               type: 'textSelection',
               text: text,
               page: selStartSpan.page,
               startItemIdx: startIdx,
               endItemIdx: endIdx
            });
         }
      }
    });

    document.addEventListener('contextmenu', function(e) {
      e.preventDefault(); 
    });

    function buildTextLayer(textLayerDiv, textItems, unscaledW, unscaledH, actualCSSWidth) {
      var effectiveScale = actualCSSWidth / unscaledW;
      var pageHeightCSS  = unscaledH * effectiveScale;

      textLayerDiv.innerHTML = '';
      var spanIdx = 0;
      textItems.forEach(function(item, i) {
        if (!item.str || item.str.trim() === '') return;
        var span = document.createElement('span');
        span.textContent = item.str;
        span.setAttribute('data-item-idx', spanIdx);

        var userX = item.transform[4];
        var userY = item.transform[5];
        var fontSizeUser = Math.abs(item.transform[3]);
        var fontSizePx   = fontSizeUser * effectiveScale;
        var ascentPx     = fontSizePx * 0.8;

        span.style.left       = (userX * effectiveScale) + 'px';
        span.style.top        = (pageHeightCSS - userY * effectiveScale - ascentPx) + 'px';
        span.style.fontSize   = fontSizePx + 'px';
        span.style.fontFamily = item.fontName || 'sans-serif';
        
        var itemWidth = item.width || (item.str.length * fontSizeUser * 0.5);
        span.style.width      = (itemWidth * effectiveScale) + 'px';
        span.style.height     = fontSizePx + 'px';

        var angle = Math.atan2(item.transform[1], item.transform[0]);
        if (Math.abs(angle) > 0.001) {
          span.style.transform = 'rotate(' + (-angle) + 'rad)';
        }
        textLayerDiv.appendChild(span);
        spanIdx++;
      });
    }

    var pdfDocument = null;

    async function renderPDF(pdfUri) {
      try {
        var loadingTask = pdfjsLib.getDocument({ url: pdfUri });
        pdfDocument = await loadingTask.promise;
        totalPages = pdfDocument.numPages;
        postMsg({ type: 'ready', totalPages: totalPages });
        
        var container = document.getElementById('pdf-container');

        var page1 = await pdfDocument.getPage(1);
        var vp1 = page1.getViewport({ scale: 1.0 });
        var defaultW = vp1.width;
        var defaultH = vp1.height;
        var defaultRatio = defaultH / defaultW;
        page1.cleanup();

        for (var i = 1; i <= totalPages; i++) {
          var wrapper = document.createElement('div');
          wrapper.className = 'page-wrapper';
          wrapper.setAttribute('data-page', String(i));
          wrapper.style.paddingBottom = (defaultRatio * 100) + '%';
          container.appendChild(wrapper);
          
          pageData[i] = { 
            state: 'empty', 
            textExtracted: false,
            unscaledW: defaultW, 
            unscaledH: defaultH, 
            textItems: [] 
          };
        }
        
        postMsg({ type: 'loaded' }); 

        var observer = new IntersectionObserver(function(entries) {
           entries.forEach(function(entry) {
              if (entry.isIntersecting) {
                 var pageNum = parseInt(entry.target.getAttribute('data-page'), 10);
                 renderPageVisuals(pageNum, entry.target);
              }
           });
        }, { rootMargin: "1000px 0px" }); 

        document.querySelectorAll('.page-wrapper').forEach(function(el) {
           observer.observe(el);
        });

        extractTextInBackground();

      } catch (e) {
        postMsg({ type: 'error', message: e.message });
      }
    }

    async function extractTextInBackground() {
      for (var pageNum = 1; pageNum <= totalPages; pageNum++) {
        if (pageData[pageNum].textExtracted) continue;
        try {
          var page = await pdfDocument.getPage(pageNum);
          var textContent = await page.getTextContent();
          
          var newItems = [];
          textContent.items.forEach(function(item) {
             if (!item.str || !item.str.trim()) return;
             var charWidth = (item.width || 0) / Math.max(1, item.str.length);
             var currentX = item.transform[4];
             var words = item.str.split(' ');
             words.forEach(function(w) {
                if (w.trim() !== '') {
                   var newItem = Object.assign({}, item);
                   newItem.str = w;
                   newItem.width = w.length * charWidth;
                   newItem.transform = item.transform.slice();
                   newItem.transform[4] = currentX;
                   newItems.push(newItem);
                }
                currentX += (w.length + 1) * charWidth;
             });
          });

          pageData[pageNum].textItems = newItems;
          pageData[pageNum].textExtracted = true;
          
          var vp = page.getViewport({ scale: 1.0 });
          pageData[pageNum].unscaledW = vp.width;
          pageData[pageNum].unscaledH = vp.height;
          
          page.cleanup();
          await new Promise(function(r) { setTimeout(r, 10); });
        } catch(e) {}
      }
    }

    async function renderPageVisuals(pageNum, wrapper) {
       var data = pageData[pageNum];
       if (data.state !== 'empty') return;
       data.state = 'loading';

       try {
         var page = await pdfDocument.getPage(pageNum);
         var unscaledW = page.getViewport({ scale: 1.0 }).width;
         var unscaledH = page.getViewport({ scale: 1.0 }).height;
         
         wrapper.style.paddingBottom = ((unscaledH / unscaledW) * 100) + '%';
         data.unscaledW = unscaledW;
         data.unscaledH = unscaledH;

         var pixelRatio = window.devicePixelRatio || 1;
         var renderScale = 2 * pixelRatio;
         var renderVP = page.getViewport({ scale: renderScale });

         var canvas = document.createElement('canvas');
         canvas.setAttribute('data-page', String(pageNum));
         var ctx = canvas.getContext('2d');
         canvas.width = renderVP.width;
         canvas.height = renderVP.height;
         wrapper.appendChild(canvas);

         await page.render({ canvasContext: ctx, viewport: renderVP }).promise;

         if (!data.textExtracted) {
           var textContent = await page.getTextContent();
           var newItems = [];
           textContent.items.forEach(function(item) {
              if (!item.str || !item.str.trim()) return;
              var charWidth = (item.width || 0) / Math.max(1, item.str.length);
              var currentX = item.transform[4];
              var words = item.str.split(' ');
              words.forEach(function(w) {
                 if (w.trim() !== '') {
                    var newItem = Object.assign({}, item);
                    newItem.str = w;
                    newItem.width = w.length * charWidth;
                    newItem.transform = item.transform.slice();
                    newItem.transform[4] = currentX;
                    newItems.push(newItem);
                 }
                 currentX += (w.length + 1) * charWidth;
              });
           });
           data.textItems = newItems;
           data.textExtracted = true;
         }

         var textLayerDiv = document.createElement('div');
         textLayerDiv.className = 'textLayer';
         textLayerDiv.setAttribute('data-page', String(pageNum));
         wrapper.appendChild(textLayerDiv);

         var w = wrapper.offsetWidth;
         if (w > 0) {
            buildTextLayer(textLayerDiv, data.textItems, unscaledW, unscaledH, w);
         }
         
         var ro = new ResizeObserver(function(entries) {
            var cw = entries[0].contentRect.width;
            if (cw > 0) buildTextLayer(textLayerDiv, data.textItems, unscaledW, unscaledH, cw);
         });
         ro.observe(wrapper);

         data.state = 'rendered';
         page.cleanup();
         
         if (currentHighlights && currentHighlights.length) {
            renderPersistentHighlightsForPage(pageNum);
         }
         if (currentSearchTerm) {
            searchInAllPages(currentSearchTerm);
         }
         
         postMsg({ type: 'pageRendered', page: pageNum, total: totalPages });
       } catch(e) {
         data.state = 'empty';
       }
    }

    renderPDF('${fileUri}');
  </script>
</body>
</html>`;
}

function NativePdfRendererContent({
  fileUri,
  onPageChange,
  scrollToPageRef,
  onDocumentReady,
  onSelection,
  searchRef,
  onSearchResult,
  highlightsRef,
  onHighlightTapped,
}: NativePdfRendererContentProps) {
  const [loading, setLoading] = useState(true);
  const [html, setHtml] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  const injectCommand = (cmd: object) => {
    const js = `(function(){ window.handleRNCommand('${JSON.stringify(cmd).replace(/'/g, "\\'")
}'); true; })();`;
    webViewRef.current?.injectJavaScript(js);
  };

  // Expose searchRef so DocumentWorkspace can drive search
  useEffect(() => {
    if (!searchRef) return;
    searchRef.current = {
      search: (term: string) => injectCommand({ type: 'search', term }),
      next:   ()             => injectCommand({ type: 'next' }),
      prev:   ()             => injectCommand({ type: 'prev' }),
      clear:  ()             => injectCommand({ type: 'clear' }),
    };
    return () => { if (searchRef) searchRef.current = null; };
  }, [searchRef]);

  // Expose page scroll
  useEffect(() => {
    if (!scrollToPageRef) return;
    scrollToPageRef.current = (page: number) => injectCommand({ type: 'goPage', page: page + 1 });
    return () => { if (scrollToPageRef) scrollToPageRef.current = null; };
  }, [scrollToPageRef]);

  // Expose highlights
  useEffect(() => {
    if (!highlightsRef) return;
    highlightsRef.current = {
      set: (highlights: readonly DocumentHighlight[]) => {
        injectCommand({ type: 'renderHighlights', highlights });
      },
    };
    return () => { if (highlightsRef) highlightsRef.current = null; };
  }, [highlightsRef]);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      setHtml(buildHtmlFromUri(fileUri, theme.colors.background));
    }
  }, [fileUri]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        onDocumentReady?.(data.totalPages);
      } else if (data.type === 'pageChange') {
        onPageChange?.(data.page - 1);
      } else if (data.type === 'loaded') {
        setLoading(false);
      } else if (data.type === 'error') {
        console.error('[PDF.js]', data.message);
        setLoading(false);
      } else if (data.type === 'searchResult') {
        onSearchResult?.(data.total, data.current);
      } else if (data.type === 'textSelection') {
        onSelection?.({
          documentId: fileUri,
          pageIndex: (data.page || 1) - 1,
          blockIndex: 0,
          text: data.text,
          startIndex: data.startItemIdx || 0,
          endIndex: data.endItemIdx || 0,
        });
      } else if (data.type === 'highlightTapped') {
        if (data.id) {
           onHighlightTapped?.(data.id);
        }
      }
    } catch {}
  };

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ uri: fileUri }}
          style={styles.webview}
          onLoadEnd={() => setLoading(false)}
        />
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )}
      </View>
    );
  }

  if (!html) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html, baseUrl: fileUri.substring(0, fileUri.lastIndexOf('/') + 1) }}
          style={styles.webview}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          allowFileAccessFromFileURLs={true}
          mixedContentMode="always"
          onMessage={handleMessage}
        />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});
