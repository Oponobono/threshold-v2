import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text } from 'react-native';
import { s } from '../../styles/CodeHighlighter.styles';

interface CodeHighlighterProps {
  code: string;
  language?: string;
}

const tokenColors = {
  keyword: '#FF6B6B',
  string: '#51CF66',
  number: '#FFD43B',
  comment: '#909090',
  attr: '#A78BFA',
  builtin: '#74C0FC',
  literal: '#FFD43B',
  type: '#A78BFA',
  tag: '#FF6B6B',
  default: '#FFFFFF',
};

interface Token {
  type: string;
  text: string;
}

// Lazy initialization
let hljs: any = null;
let initialized = false;

const initializeHighlightJS = () => {
  if (initialized) return;

  try {
    hljs = require('highlight.js/lib/core');

    // Registrar lenguajes bajo demanda
    hljs.registerLanguage('javascript', require('highlight.js/lib/languages/javascript'));
    hljs.registerLanguage('js', require('highlight.js/lib/languages/javascript'));
    hljs.registerLanguage('typescript', require('highlight.js/lib/languages/typescript'));
    hljs.registerLanguage('ts', require('highlight.js/lib/languages/typescript'));
    hljs.registerLanguage('python', require('highlight.js/lib/languages/python'));
    hljs.registerLanguage('py', require('highlight.js/lib/languages/python'));
    hljs.registerLanguage('java', require('highlight.js/lib/languages/java'));
    hljs.registerLanguage('cpp', require('highlight.js/lib/languages/cpp'));
    hljs.registerLanguage('c++', require('highlight.js/lib/languages/cpp'));
    hljs.registerLanguage('csharp', require('highlight.js/lib/languages/csharp'));
    hljs.registerLanguage('cs', require('highlight.js/lib/languages/csharp'));
    hljs.registerLanguage('go', require('highlight.js/lib/languages/go'));
    hljs.registerLanguage('golang', require('highlight.js/lib/languages/go'));
    hljs.registerLanguage('rust', require('highlight.js/lib/languages/rust'));
    hljs.registerLanguage('rs', require('highlight.js/lib/languages/rust'));
    hljs.registerLanguage('php', require('highlight.js/lib/languages/php'));
    hljs.registerLanguage('swift', require('highlight.js/lib/languages/swift'));
    hljs.registerLanguage('kotlin', require('highlight.js/lib/languages/kotlin'));
    hljs.registerLanguage('kt', require('highlight.js/lib/languages/kotlin'));
    hljs.registerLanguage('ruby', require('highlight.js/lib/languages/ruby'));
    hljs.registerLanguage('rb', require('highlight.js/lib/languages/ruby'));
    hljs.registerLanguage('sql', require('highlight.js/lib/languages/sql'));
    hljs.registerLanguage('html', require('highlight.js/lib/languages/xml'));
    hljs.registerLanguage('xml', require('highlight.js/lib/languages/xml'));
    hljs.registerLanguage('css', require('highlight.js/lib/languages/css'));
    hljs.registerLanguage('bash', require('highlight.js/lib/languages/bash'));
    hljs.registerLanguage('shell', require('highlight.js/lib/languages/bash'));
    hljs.registerLanguage('sh', require('highlight.js/lib/languages/bash'));
    hljs.registerLanguage('git', require('highlight.js/lib/languages/bash'));
    hljs.registerLanguage('powershell', require('highlight.js/lib/languages/powershell'));
    hljs.registerLanguage('ps', require('highlight.js/lib/languages/powershell'));
    hljs.registerLanguage('r', require('highlight.js/lib/languages/r'));
    hljs.registerLanguage('scala', require('highlight.js/lib/languages/scala'));
    hljs.registerLanguage('groovy', require('highlight.js/lib/languages/groovy'));
    hljs.registerLanguage('elixir', require('highlight.js/lib/languages/elixir'));
    hljs.registerLanguage('ex', require('highlight.js/lib/languages/elixir'));
    hljs.registerLanguage('dart', require('highlight.js/lib/languages/dart'));
    hljs.registerLanguage('objectivec', require('highlight.js/lib/languages/objectivec'));
    hljs.registerLanguage('objc', require('highlight.js/lib/languages/objectivec'));
    hljs.registerLanguage('vbnet', require('highlight.js/lib/languages/vbnet'));
    hljs.registerLanguage('json', require('highlight.js/lib/languages/json'));
    hljs.registerLanguage('plsql', require('highlight.js/lib/languages/sql'));
    hljs.registerLanguage('oracle', require('highlight.js/lib/languages/sql'));
    hljs.registerLanguage('tsql', require('highlight.js/lib/languages/sql'));
    hljs.registerLanguage('t-sql', require('highlight.js/lib/languages/sql'));
    hljs.registerLanguage('mssql', require('highlight.js/lib/languages/sql'));
    hljs.registerLanguage('plpgsql', require('highlight.js/lib/languages/sql'));
    hljs.registerLanguage('postgresql', require('highlight.js/lib/languages/sql'));
    hljs.registerLanguage('postgres', require('highlight.js/lib/languages/sql'));
    hljs.registerLanguage('graphql', require('highlight.js/lib/languages/graphql'));
    hljs.registerLanguage('mongodb', require('highlight.js/lib/languages/javascript'));
    hljs.registerLanguage('mongo', require('highlight.js/lib/languages/javascript'));

    initialized = true;
  } catch (error) {
    console.warn('Warning: highlight.js initialization failed:', error);
    hljs = null;
  }
};

const parseHighlightedHTML = (html: string): Token[] => {
  const tokens: Token[] = [];
  // Expresión regular que busca apertura de span, cierre de span o texto.
  const regex = /(<span class="hljs-[^"]+">)|(<\/span>)|([^<]+)/g;
  let match;
  const currentTypes: string[] = []; // Pila para manejar anidación de spans

  while ((match = regex.exec(html)) !== null) {
    if (match[1]) {
      // Apertura de un span
      const classMatch = match[1].match(/class="hljs-([^"]+)"/);
      if (classMatch) {
        currentTypes.push(classMatch[1]);
      }
    } else if (match[2]) {
      // Cierre de un span
      currentTypes.pop();
    } else if (match[3]) {
      // Texto: decodificar entidades HTML básicas que highlight.js escapa
      let text = match[3]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'");
      
      const type = currentTypes.length > 0 ? currentTypes[currentTypes.length - 1] : 'default';
      // Evitar empujar tokens vacíos
      if (text.length > 0) {
        tokens.push({ type, text });
      }
    }
  }

  return tokens;
};

const getColorForToken = (tokenType: string): string => {
  // tokenType puede contener múltiples clases separadas por espacio, ej: "title function_" o "variable language_"
  const types = tokenType.split(' ');

  const typeMap: { [key: string]: string } = {
    keyword: tokenColors.keyword,
    'built_in': tokenColors.builtin,     // highlight.js usa guión bajo
    type: tokenColors.type,
    string: tokenColors.string,
    number: tokenColors.number,
    literal: tokenColors.literal,
    attr: tokenColors.attr,
    attribute: tokenColors.attr,
    function: '#74C0FC',
    title: '#74C0FC',                    // Nombres de funciones y clases en general
    'title.class_': tokenColors.type,    // Clases específicas
    'title.function_': '#74C0FC',        // Funciones específicas
    class: tokenColors.type,
    comment: tokenColors.comment,
    tag: tokenColors.tag,
    name: tokenColors.tag,               // Etiquetas HTML/XML
    variable: '#E5C07B',                 // Variables (Amarillo anaranjado claro)
    property: '#61AFEF',                 // Propiedades de objetos (Azul)
    params: '#D19A66',                   // Parámetros de funciones (Naranja)
    operator: '#ABB2BF',                 // Operadores
    punctuation: '#ABB2BF',              // Puntuación
    subst: '#FFFFFF',                    // Sustituciones dentro de strings (ej: `${var}`)
    meta: '#E06C75',                     // Metadatos (ej: #include en C++)
  };

  // Buscar coincidencia exacta primero
  if (typeMap[tokenType]) return typeMap[tokenType];
  
  // Comprobar la combinación clase_principal + modificador (ej: title.function_)
  if (types.length > 1) {
    const combined = `${types[0]}.${types[1]}`;
    if (typeMap[combined]) return typeMap[combined];
  }

  // Fallback a la primera clase (la principal)
  return typeMap[types[0]] || tokenColors.default;
};

export const CodeHighlighter: React.FC<CodeHighlighterProps> = ({
  code,
  language = 'plaintext',
}) => {
  // Aseguramos que hljs esté inicializado síncronamente antes de procesar los tokens.
  // Hacerlo en useEffect causaba que el primer render fuera sin color (hljs = null)
  // y como hljs es una variable global, no disparaba un re-render al asignarse.
  if (!initialized) {
    initializeHighlightJS();
  }

  const tokens = useMemo(() => {
    if (!hljs) {
      return [{ type: 'default', text: code }];
    }

    let highlightedHTML = code;
    let parsedTokens: Token[] = [];

    try {
      if (language && language !== 'plaintext') {
        try {
          const result = hljs.highlight(code, { language, ignoreIllegals: true });
          highlightedHTML = result.value;
        } catch {
          try {
            const result = hljs.highlightAuto(code);
            highlightedHTML = result.value;
          } catch {
            return [{ type: 'default', text: code }];
          }
        }
      }

      parsedTokens = parseHighlightedHTML(highlightedHTML);
    } catch (error) {
      console.error('Error highlighting code:', error);
      parsedTokens = [{ type: 'default', text: code }];
    }

    return parsedTokens;
  }, [code, language]);

  return (
    <View style={s.codeBlockContainer}>
      {language && language !== 'plaintext' && (
        <View style={s.headerBar}>
          <Text style={s.languageText}>{language}</Text>
        </View>
      )}
      <View style={s.codeWrapper}>
        <Text style={s.codeText}>
          {tokens.map((token, idx) => (
            <Text key={idx} style={{ color: getColorForToken(token.type) }}>
              {token.text}
            </Text>
          ))}
        </Text>
      </View>
    </View>
  );
};
