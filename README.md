# 📚 Threshold - Plataforma Académica Inteligente

![Version](https://img.shields.io/badge/version-2.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green)
![React Native](https://img.shields.io/badge/React%20Native-Expo-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-enabled-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 📖 ¿Qué es Threshold?

**Threshold** es una plataforma académica de aprendizaje asistida por IA que unifica todo el ecosistema estudiantil en una sola aplicación:

- 📅 **Gestión de horarios** - Sincroniza tus clases y eventos académicos
- 📚 **Mazos de flashcards** - Genera automáticamente tarjetas de estudio con IA (Groq/Gemini)
- 🖼️ **Galería de fotos** - Organiza documentos escaneados por materia
- 🎙️ **Transcripciones de audio** - Captura y transcribe notas de clase automáticamente
- 🤖 **Asistente Zyren** - Chat inteligente con contexto académico para resolver dudas
- 📊 **Análisis de aprendizaje** - Seguimiento del progreso con predicciones SM-2 y FSRS
- ☁️ **Backup automático** - Sincronización en la nube con recuperación ante fallos
- 🔐 **Autenticación segura** - JWT + autenticación biométrica

**Stack Tecnológico:**
- 🔙 **Backend:** Node.js + Express + PostgreSQL/SQLite
- 📱 **Frontend:** React Native (Expo) + TypeScript
- 🧠 **IA:** Google Gemini + Groq (Llama) + OpenAI Whisper
- ☁️ **Cloud:** Render.com (BD) + Uploadthing (almacenamiento)
- 📦 **Base de datos:** SQLite (desarrollo) / PostgreSQL (producción)

---

## 🏗️ Estructura del Proyecto

El repositorio es un **Monorepo** dividido en:

```
threshold-v2/
├── backend/                    # Servidor Node.js + Express
│   ├── controllers/           # Lógica de negocio (IA, flashcards, análisis)
│   ├── routes/                # Endpoints REST
│   ├── database/              # Migraciones y esquema
│   ├── middlewares/           # Autenticación, validación, rate limiting
│   ├── utils/                 # Servicios: Gemini, Groq, académicos
│   ├── config/                # Variables de entorno
│   └── server.js              # Punto de entrada
│
├── mobile/                     # App React Native (Expo)
│   ├── app/                   # Rutas y pantallas
│   ├── src/
│   │   ├── components/        # Componentes reutilizables
│   │   ├── hooks/             # Custom hooks (audio, datos)
│   │   ├── services/          # Llamadas a API + lógica
│   │   ├── store/             # Zustand store (estado global)
│   │   └── styles/            # Estilos compartidos
│   └── assets/                # Imágenes y recursos
│
├── analysis/                   # Documentación técnica y análisis
└── README.md                  # Este archivo
```

**Backend `/backend`**
- Servidor Node.js + Express
- Gestiona lógica de negocio, autenticación JWT
- Comunicación directa con APIs de IA (Gemini, Groq, Whisper)
- Base de datos SQLite (desarrollo) o PostgreSQL (producción)
- Sistema de migración automática

**Mobile `/mobile`**
- Aplicación React Native con Expo y TypeScript
- Interfaz de usuario completa
- Almacenamiento local + sincronización con backend
- Soporte offline con caché inteligente

---

## ⚙️ Requisitos Previos

Antes de empezar, asegúrate de tener instalado:

- **Node.js** v18 o superior ([descargar](https://nodejs.org/))
- **npm** v8 o superior (incluido con Node.js)
- **Git** para clonar el repositorio
- **Expo CLI** (opcional, se instala con npm)
- **Android Studio o Xcode** para emular dispositivos (opcional)
- **Expo Go** app en tu celular para probar en físico (opcional)

---

## 🔑 Variables de Entorno

### Backend (`/backend/.env`)

Crea un archivo `.env` en la carpeta `backend/` con las siguientes variables:

```env
# ─────────────────────────────────────────────
# CONFIGURACIÓN DEL SERVIDOR
# ─────────────────────────────────────────────
PORT=3000
HOST=0.0.0.0
NODE_ENV=development          # 'development' o 'production'

# ─────────────────────────────────────────────
# SEGURIDAD JWT
# ─────────────────────────────────────────────
JWT_SECRET=tu_super_secreto_seguro_para_jwt_aqui_cambiar_en_produccion

# ─────────────────────────────────────────────
# PROVEEDORES DE IA
# ─────────────────────────────────────────────
GEMINI_API_KEY=tu_clave_api_de_google_gemini
GROQ_API_KEY=tu_clave_api_de_groq_llama
SUPADATA_API_KEY=tu_clave_de_supadata_para_youtube

# ─────────────────────────────────────────────
# BASE DE DATOS
# ─────────────────────────────────────────────
DATABASE_URL=postgres://usuario:password@host:5432/nombre_bd

# Si DATABASE_URL está vacío, usa SQLite local (ideal para desarrollo)
```

> **⚠️ Nota importante:** Si `DATABASE_URL` no está definida, el sistema creará automáticamente un archivo local `database.sqlite`. Perfecto para desarrollo, pero usa PostgreSQL en producción.

### Mobile (`/mobile/.env`)

Crea un archivo `.env` en la carpeta `mobile/`:

```env
# ─────────────────────────────────────────────
# API URL - Dirección del backend
# ─────────────────────────────────────────────
# Para desarrollo local:
EXPO_PUBLIC_API_URL=http://localhost:3000/api

# Para testing en celular físico (cambia 192.168.1.X por tu IP):
# EXPO_PUBLIC_API_URL=http://192.168.1.10:3000/api

# Para producción:
# EXPO_PUBLIC_API_URL=https://tu-dominio.com/api
```

---

## 🚀 Instalación y Ejecución

### Paso 1: Clonar el Repositorio

```bash
git clone https://github.com/Oponobono/threshold-v2.git
cd threshold-v2
```

### Paso 2: Instalar Backend

```bash
cd backend
npm install
```

Configura el archivo `.env` como se indicó arriba.

### Paso 3: Iniciar el Backend

```bash
npm start
```

Deberías ver:
```
✅ Conectado a SQLite (o PostgreSQL)
🚀 Servidor corriendo en http://localhost:3000
```

### Paso 4: Instalar Mobile (en otra terminal)

```bash
cd mobile
npm install
```

Configura el archivo `.env` en la carpeta `mobile/`.

### Paso 5: Iniciar Expo

```bash
npx expo start
```

Se abrirá un menú interactivo con opciones:
- Presiona `w` para abrir en navegador (Web)
- Presiona `i` para emulador iOS (Mac only)
- Presiona `a` para emulador Android
- Escanea el QR con **Expo Go** en tu celular físico

---

## 🏛️ Arquitectura de Base de Datos

### Desarrollo (SQLite)

SQLite se crea automáticamente en `backend/database.sqlite` cuando inicias el servidor.

Ventajas:
- ✅ Sin dependencias externas
- ✅ Perfecto para desarrollo
- ✅ Todo en un único archivo

### Producción (PostgreSQL en Render)

Para producción usamos PostgreSQL en Render.com para garantizar:
- ✅ Persistencia en la nube
- ✅ Escalabilidad automática
- ✅ Backups automáticos
- ✅ Alta disponibilidad

#### Crear Base de Datos en Render

1. Ve a [Render.com](https://render.com) y haz login
2. Haz clic en **New** → **PostgreSQL Database**
3. Configura:
   - **Name:** `threshold-db`
   - **Database:** `threshold`
   - **User:** `threshold_admin`
   - **Region:** Selecciona el más cercano
   - **Plan:** Starter (recomendado)
4. Espera a que se cree (2-3 minutos)
5. Copia la **External Database URL**

#### Conectar el Backend a PostgreSQL

1. En el **Web Service** del backend en Render, ve a **Environment**
2. Agrega una variable:
   - **Key:** `DATABASE_URL`
   - **Value:** (pega la URL de PostgreSQL)
3. El servidor se reiniciará automáticamente
4. El sistema ejecutará todas las migraciones automáticamente ✅

---

## 🤖 Sistema de Inteligencia Artificial

### Proveedores Soportados

Threshold soporta múltiples modelos de IA para máxima flexibilidad:

#### 1. **Groq Llama (Recomendado para velocidad)**
- Modelo: `llama-3.3-70b-versatile`
- Velocidad: Extremadamente rápido
- Caso de uso: Generación de flashcards, chats en tiempo real
- Costo: Muy económico

#### 2. **Google Gemini (Mejor para análisis)**
- Modelo: `gemini-3-flash-preview` (May 2026)
- Capacidad: Procesamiento de documentos, análisis profundo
- Caso de uso: OCR, análisis de contenido complejo
- Ventaja: Files API para documentos grandes

#### 3. **OpenAI Whisper (Transcripción)**
- Modelo: `whisper-1`
- Función: Transcribe audio a texto
- Caso de uso: Grabaciones de clase, notas de voz

### Generación de Material de Estudio

El motor **Zyren** genera automáticamente 4 tipos de ítems:

1. **Flashcards** - Pregunta/Respuesta clásico
2. **Multiple Choice** - Selección múltiple con 4 opciones
3. **Boolean** - Verdadero/Falso
4. **Mixed** - Combinación de los tres (recomendado)

**Características pedagógicas:**
- Jerarquía de Bloom (Memoria → Análisis → Evaluación)
- Distractores basados en errores conceptuales reales
- Pistas estratégicas (no respuestas parciales)
- Explicaciones profundas con contexto académico

---

## 📊 Algoritmos de Repaso

### SM-2 (SuperMemo)
Algoritmo clásico de repetición espaciada:
- Intervalo progresivo de repaso
- Factor de facilidad dinámico
- Implementación: `backend/utils/sm2Algorithm.js`

### FSRS (Free Spaced Repetition Scheduler)
Algoritmo moderno de última generación:
- Basado en machine learning
- Predicción de olvido (forgetting curve)
- Mejor rendimiento que SM-2
- Implementación: `backend/utils/fsrsAlgorithm.js`

Ambos se ejecutan en paralelo para análisis comparativo.

---

## 🎯 Flujos Principales

### 1️⃣ Registro y Autenticación
```
Usuario → POST /api/auth/register → JWT token
          ↓
      SQLite/PostgreSQL (usuarios)
          ↓
      Autenticación biométrica (opcional)
```

### 2️⃣ Generación de Flashcards
```
Contenido (texto/PDF/imagen) → Groq/Gemini API
                    ↓
            Zyren (IA instructor)
                    ↓
        JSON con ítems estructurados
                    ↓
        Inserción en BD + Caché local
                    ↓
        Usuario estudia con SM-2/FSRS
```

### 3️⃣ Chat Académico
```
Pregunta del usuario → Contexto de materia
          ↓
      Intención detectada
          ↓
   ¿Pedir generar mazo? → Groq/Gemini
          ↓
      Respuesta + acción
          ↓
    Usuario estudia resultado
```

### 4️⃣ Backup Automático
```
Cambios locales → Cola de upload
        ↓
    WiFi conectado + app en background
        ↓
    Uploadthing (almacenamiento)
        ↓
    BD marca como respaldado
        ↓
    Sincronización exitosa ✅
```

---

## 📱 Características por Pantalla

### Dashboard
- Resumen de asignaturas y progreso
- Widget de sesión de estudio
- Próximos eventos del calendario
- Auto-upload indicator

### Galería
- Vista en grid de fotos/documentos
- Agrupación por cards (múltiples fotos por card)
- Filtro por materia y búsqueda
- Favoritos y OCR recognition
- Contador de fotos correcto (total dentro de cards)

### Flashcards
- Crear/importar/estudiar mazos
- Editor visual de tarjetas
- Modo estudio con SM-2/FSRS
- Estadísticas por deck
- Generación automática desde chat

### Chat Zyren
- Contexto académico automático
- Generación de mazos en el mismo chat
- Análisis de documentos
- Sugerencias pedagógicas

### Calendario
- Sincronización con Google Calendar
- Eventos por materia
- Notificaciones

---

## 🔐 Seguridad

### Autenticación
- JWT con expiration configurable
- Refresh tokens
- Biometric authentication (Face ID/Touch ID)

### Validación
- Middleware de validación en rutas
- Rate limiting para prevenir abuso
- XSS protection
- SQL Injection prevention (prepared statements)

### Almacenamiento
- Contraseñas hasheadas con bcrypt
- Tokens seguros
- Datos sensibles encriptados

---

## 🧪 Scripts Disponibles

### Backend

```bash
cd backend

# Desarrollo
npm start              # Inicia el servidor

# Limpieza
npm run clean-db      # Script para limpiar BD (desarrollo)

# Scripts útiles
node find_hardcoded   # Encuentra strings hardcodeados
```

### Mobile

```bash
cd mobile

# Desarrollo
npx expo start        # Inicia Expo

# Builds
eas build             # Build EAS (configurado en eas.json)
eas submit            # Publica a App Store / Play Store
```

---

## 🐛 Troubleshooting

### "EXPO_PUBLIC_API_URL not found"
**Solución:** Crea `.env` en mobile con `EXPO_PUBLIC_API_URL=http://localhost:3000/api`

### "Could not connect to backend"
**Solución:** 
- Verifica que el backend está corriendo (`npm start` en backend/)
- En celular físico: usa tu IP local, no `localhost`
- Verifica que PC y celular están en la misma red WiFi

### "Database connection failed"
**Solución:**
- Desarrollo: SQLite se crea automáticamente
- Producción: Verifica que `DATABASE_URL` está en las env variables de Render

### "Flashcards no se generan"
**Solución:**
- Verifica `GEMINI_API_KEY` o `GROQ_API_KEY` en `.env`
- Verifica que tienes cuota disponible en la API
- Revisa logs del servidor

---

## 📈 Cambios y Mejoras Recientes

### Mayo 2026 - Versión 2.0

#### ✅ Corrección del Contador de Fotos en la Galería
**Problema:** El contador mostraba la cantidad de cards en lugar del total de fotos.
- **Ejemplo:** 3 cards (2+3+1 fotos) = 6 fotos, pero mostraba "3 fotos"

**Solución en `mobile/app/(tabs)/gallery.tsx`:**
- Agregado cálculo `totalPhotoCount` que suma fotos dentro de cada grupo
- Actualizado en dos ubicaciones: header y sección galería
- Ahora respeta también filtros por materia y búsqueda

**Impacto:** Usuarios ven exactamente cuántas fotos tienen, incluyendo las agrupadas

---

## 📚 Documentación Adicional

- **[API Documentation](./analysis/API_DOCUMENTATION.md)** - Todos los endpoints REST
- **[Database Schema](./analysis/DATABASE_DOCUMENTATION.md)** - Estructura de tablas
- **[Learning Engineering](./analysis/LEARNING_ENGINEERING_DOCUMENTATION.md)** - Pedagogía
- **[Spaced Repetition Logic](./analysis/spaced_repetition_logic.md)** - Algoritmos SM-2/FSRS
- **[Import Schema](./analysis/FLASHCARD_IMPORT_SCHEMA.md)** - Formato de importación
- **[MIT License Scope](./analysis/MIT_LICENSE_SCOPE.md)** - Qué puedes y no puedes hacer con Threshold

---

## 👥 Soporte

¿Problemas o sugerencias?

- 📧 **Email:** oponobono@gmail.com
- 🐛 **Issues:** [GitHub Issues](https://github.com/Oponobono/threshold-v2/issues)
- 💬 **Discusiones:** [GitHub Discussions](https://github.com/Oponobono/threshold-v2/discussions)

---

## 📄 Licencia

Este proyecto está bajo la licencia **MIT**. Ver [LICENSE](./LICENSE) para más detalles.

---

## 🙏 Agradecimientos

- **Groq** por el acceso a Llama 3.3
- **Google** por Gemini y Vision API
- **Render.com** por hosting confiable
- **Uploadthing** por almacenamiento seguro
- Comunidad de React Native y Expo

---

**Última actualización:** Mayo 19, 2026
**Versión:** 2.0
