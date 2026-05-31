/**
 * gbnfGrammars.ts
 *
 * Gramáticas GBNF (GGML BNF) para forzar a los modelos locales
 * (llama.rn) a generar JSON válido con estructura predecible.
 *
 * Estas gramáticas garantizan que incluso modelos pequeños (1B-3B)
 * produzcan parseos 100% exitosos sin alucinaciones de sintaxis.
 */

/**
 * Gramática para generar un array de flashcards en JSON.
 * Cada flashcard tiene: front, back, topic, tags[].
 */
export const FLASHCARD_ARRAY_GRAMMAR = `
root   ::= "[" "]" | "[" flashcard ("," flashcard)* "]"
flashcard ::= "{"  ws  "\\"front\\""  ws  ":"  ws  string  ws  ","  ws  "\\"back\\""  ws  ":"  ws  string  ws  ","  ws  "\\"topic\\""  ws  ":"  ws  string  ws  ","  ws  "\\"tags\\""  ws  ":"  ws  array  ws  "}"
string ::= "\\""  ([^"\\\\] | "\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))*  "\\""
array  ::= "["  ws  "]"  |  "["  ws  string  (ws  ","  ws  string)*  ws  "]"
ws     ::= [ \\t\\n]*
`.trim();

/**
 * Gramática para generar material de estudio (mixed: flashcards, MC, boolean, matching).
 */
export const STUDY_MATERIAL_GRAMMAR = `
root   ::= "{"  ws  "\\"title\\""  ws  ":"  ws  string  ws  ","  ws  "\\"items\\""  ws  ":"  ws  items  ws  "}"
items  ::= "["  ws  "]"  |  "["  ws  item  (ws  ","  ws  item)*  ws  "]"
item   ::= flashcard | mc | boolean | matchingMatch

flashcard ::= "{"  ws  "\\"type\\""  ws  ":"  ws  "\\"flashcard\\""  ws  ","  ws  "\\"front\\""  ws  ":"  ws  string  ws  ","  ws  "\\"back\\""  ws  ":"  ws  string  ws  "}"
mc        ::= "{"  ws  "\\"type\\""  ws  ":"  ws  "\\"multiple_choice\\""  ws  ","  ws  "\\"question\\""  ws  ":"  ws  string  ws  ","  ws  "\\"options\\""  ws  ":"  ws  array  ws  ","  ws  "\\"correct\\""  ws  ":"  ws  string  ws  "}"
boolean   ::= "{"  ws  "\\"type\\""  ws  ":"  ws  "\\"true_false\\""  ws  ","  ws  "\\"statement\\""  ws  ":"  ws  string  ws  ","  ws  "\\"answer\\""  ws  ":"  ws  ("true" | "false")  ws  "}"
matchingMatch ::= "{"  ws  "\\"type\\""  ws  ":"  ws  "\\"matching\\""  ws  ","  ws  "\\"pairs\\""  ws  ":"  ws  pairs  ws  "}"
pairs    ::= "["  ws  "]"  |  "["  ws  pair  (ws  ","  ws  pair)*  ws  "]"
pair     ::= "{"  ws  "\\"left\\""  ws  ":"  ws  string  ws  ","  ws  "\\"right\\""  ws  ":"  ws  string  ws  "}"
string   ::= "\\""  ([^"\\\\] | "\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))*  "\\""
array    ::= "["  ws  "]"  |  "["  ws  string  (ws  ","  ws  string)*  ws  "]"
ws       ::= [ \\t\\n]*
`.trim();

/**
 * Gramática para diferenciación de dos conceptos (differentiation card).
 */
export const DIFFERENTIATION_CARD_GRAMMAR = `
root   ::= "{"  ws  "\\"conceptA\\""  ws  ":"  ws  string  ws  ","  ws  "\\"conceptB\\""  ws  ":"  ws  string  ws  ","  ws  "\\"difference\\""  ws  ":"  ws  string  ws  ","  ws  "\\"example\\""  ws  ":"  ws  string  ws  "}"
string ::= "\\""  ([^"\\\\] | "\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))*  "\\""
ws     ::= [ \\t\\n]*
`.trim();

/**
 * Gramática para respuesta de chat académico (texto libre, sin estructura fija).
 * No se aplica restricción — se deja al modelo generar texto natural.
 */
export const CHAT_GRAMMAR = '';

/**
 * Gramática para análisis de confusiones en un deck.
 */
export const DECK_CONFUSIONS_GRAMMAR = `
root   ::= "{"  ws  "\\"confusions\\""  ws  ":"  ws  confusions  ws  "}"
confusions ::= "["  ws  "]"  |  "["  ws  confusion  (ws  ","  ws  confusion)*  ws  "]"
confusion ::= "{"  ws  "\\"concept_a\\""  ws  ":"  ws  string  ws  ","  ws  "\\"concept_b\\""  ws  ":"  ws  string  ws  ","  ws  "\\"reason\\""  ws  ":"  ws  string  ws  "}"
string ::= "\\""  ([^"\\\\] | "\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))*  "\\""
ws     ::= [ \\t\\n]*
`.trim();

/**
 * Gramática para resumen académico (JSON con estructura de puntos clave).
 */
export const SUMMARY_GRAMMAR = `
root   ::= "{"  ws  "\\"title\\""  ws  ":"  ws  string  ws  ","  ws  "\\"keyPoints\\""  ws  ":"  ws  points  ws  ","  ws  "\\"conclusion\\""  ws  ":"  ws  string  ws  "}"
points ::= "["  ws  "]"  |  "["  ws  string  (ws  ","  ws  string)*  ws  "]"
string ::= "\\""  ([^"\\\\] | "\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))*  "\\""
ws     ::= [ \\t\\n]*
`.trim();

export type GrammarType =
  | 'flashcards'
  | 'study_material'
  | 'differentiation'
  | 'chat'
  | 'confusions'
  | 'summary';

export function getGrammar(type: GrammarType): string {
  const grammars: Record<GrammarType, string> = {
    flashcards: FLASHCARD_ARRAY_GRAMMAR,
    study_material: STUDY_MATERIAL_GRAMMAR,
    differentiation: DIFFERENTIATION_CARD_GRAMMAR,
    chat: CHAT_GRAMMAR,
    confusions: DECK_CONFUSIONS_GRAMMAR,
    summary: SUMMARY_GRAMMAR,
  };
  return grammars[type];
}
