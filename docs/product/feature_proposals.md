# Propuestas de Funcionalidades Nivel Premium para Threshold 🚀

Basado en la infraestructura actual de la aplicación (Arquitectura Offline-First, IA híbrida Gemini/Groq, motores locales LLaMA/Whisper y algoritmo de espaciado FSRS), estas son las características de alto impacto que llevarían la aplicación al siguiente nivel, enfocándonos en **gamificación, experiencia visual y herramientas cognitivas**.

---

## 1. Simulacros de Examen Inteligentes (Mock Exams) 📝
Transforma los datos pasivos (apuntes, fotos) en simulaciones activas de parciales.

- **La Idea:** Pantalla dedicada a "Simulacro de Examen". El usuario selecciona una materia y Zyren analiza todo el contexto de la misma (documentos, OCR de fotos, transcripciones) para generar un examen de 20 preguntas (estilo ECAES / Selección Múltiple / V-F).
- **El Valor Agregado:** Al finalizar el simulacro, la aplicación califica el examen instantáneamente y se conecta con el `gradingEngine` para recalcular la proyección de la nota: *"Si sacas esta calificación en tu próximo parcial, tu nota asegurada sube a 4.2"*.
- **Tecnología:** Gemini Files API para lectura de contexto + Groq LLaMA para generación rápida de reactivos.

## 2. Mapa Mental Interactivo Autogenerado (Mind Maps) 🧠
Una experiencia de "Efecto WOW" para visualizar información compleja.

- **La Idea:** En la vista de un Documento o Materia, un botón de *"Generar Mapa Mental"*. Zyren extrae la jerarquía de conceptos principales en un JSON estructurado, y el frontend lo renderiza como un mapa de nodos conectables, interactivo, con soporte para gestos (zoom, arrastrar).
- **El Valor Agregado:** El usuario sube un PDF denso de 50 páginas y en 10 segundos tiene un mapa visual para entender la estructura antes de leer.
- **Tecnología:** Gemini Files API (extracción JSON estructurada) + librerías visuales de React Native (`react-native-svg` o D3.js).

## 3. Modo de Estudio "Manos Libres" (Zyren Voice) 🎙️
Estudio pasivo/activo sin necesidad de mirar el teléfono.

- **La Idea:** Un modo donde la app te lee en voz alta las flashcards usando el motor TTS (Text-To-Speech) del sistema operativo, y tú respondes usando tu voz. 
- **El Valor Agregado:** Ideal para estudiar mientras el usuario camina, va en el bus o hace ejercicio. La app usa el modelo local de Whisper para escuchar la respuesta del usuario, la compara con la respuesta real de la tarjeta, y califica la tarjeta automáticamente usando evaluación semántica.
- **Tecnología:** `whisper.rn` (offline local) + Groq (para evaluación semántica) + TTS Nativo.

## 4. Gamificación y Heatmap de Estudio (Estilo GitHub) 🔥
Retención de usuarios a través de la psicología de la consistencia.

- **La Idea:** Integrar en el Dashboard principal un *Heatmap* de contribuciones (cuadritos que cambian de intensidad según el volumen de estudio), registrando los minutos estudiados al día o la cantidad de flashcards repasadas.
- **El Valor Agregado:** Incluir rachas (*Streaks*) de días seguidos estudiando y "XP" (Puntos de experiencia). Los estudiantes tienen un fuerte impulso psicológico a "no romper la racha", lo que garantiza la retención diaria en la app.
- **Tecnología:** Módulo existente de `StudySessionRepository` + MMKV para guardado rápido offline + UI Components premium.

## 5. Panel Avanzado de Analíticas Cognitivas (FSRS Stats) 📊
Visualización de datos profundos del aprendizaje.

- **La Idea:** Crear una pantalla de analíticas donde el usuario visualice su **Curva del Olvido**. Mostrar gráficos interactivos que indiquen: *"Tienes un 92% de retención actual en Biología Celular, pero caerá al 75% si no repasas mañana"*.
- **El Valor Agregado:** Además de la curva, incluir una sección de *"Conceptos Problemáticos"* consumiendo el endpoint `analyze-confusions`, para que la IA proponga tarjetas de diferenciación automáticamente. Le da un aura "Científica y Premium" a la aplicación.
- **Tecnología:** Algoritmo FSRS existente en backend + Librería de gráficos modernos para React Native (`react-native-gifted-charts` o similar).


---
**Tags:** #product
