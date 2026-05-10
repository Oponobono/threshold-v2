# Threshold - Documentación General

Threshold es una aplicación académica y de productividad impulsada por IA (Zyren), diseñada para unificar horarios, notas, documentos escaneados, flashcards autogeneradas, resúmenes de audio y más, en un único ecosistema seguro.

Este documento explica cómo configurar, instalar y arrancar el proyecto desde cero, además de detallar cómo aprovisionar la base de datos en la nube (Render).

---

## 1. Estructura del Proyecto

El repositorio es un *Monorepo* que se divide en dos partes principales:

* **`/backend`**: Servidor Node.js + Express. Gestiona la lógica de negocio, la conexión a la base de datos (SQLite/PostgreSQL), la autenticación JWT y la comunicación directa con las APIs de IA (Gemini, Groq, Whisper, etc.).
* **`/mobile`**: Aplicación Frontend construida con **React Native** (Expo) y TypeScript. Contiene toda la Interfaz de Usuario y se comunica con el Backend mediante peticiones REST.

---

## 2. Variables de Entorno y API Keys

Antes de iniciar cualquier servicio, debes configurar las variables de entorno. 

### Backend (`/backend/.env`)
Crea un archivo `.env` en la carpeta `backend/` con las siguientes llaves (consulta `.env.example` si existe):

```env
# Configuración del Servidor
PORT=3000
HOST=0.0.0.0
NODE_ENV=development # Cambiar a 'production' en el servidor en la nube

# Seguridad JWT
JWT_SECRET=tu_super_secreto_seguro_para_jwt_aqui

# Proveedores de IA
GEMINI_API_KEY=tu_clave_de_google_gemini
GROQ_API_KEY=tu_clave_de_groq_llama
SUPADATA_API_KEY=tu_clave_de_supadata_para_youtube

# Base de Datos de Producción (Se explica en la Sección 4)
DATABASE_URL=postgres://usuario:password@host/nombre_bd
```
> **Nota:** Si `DATABASE_URL` no está definida o está vacía, el sistema creará automáticamente un archivo local `database.sqlite` y funcionará perfectamente offline en tu máquina.

### Mobile (`/mobile/.env`)
Crea un archivo `.env` en la carpeta `mobile/`:

```env
# Dirección IP local de tu PC para que el celular físico pueda ver el backend
# Ejemplo: EXPO_PUBLIC_API_URL=http://192.168.1.10:3000/api
EXPO_PUBLIC_API_URL=http://<TU_IP_LOCAL>:3000/api
```

---

## 3. Instalación e Inicialización

Se requiere tener instalado **Node.js** (v18+) y **npm**.

### 3.1. Iniciar el Backend
1. Abre una terminal y navega a la carpeta backend:
   ```bash
   cd backend
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia el servidor:
   ```bash
   npm start
   ```
   *Verás el mensaje "Conectado a SQLite" (o Postgres) y el puerto donde corre (ej: `http://localhost:3000`).*

### 3.2. Iniciar la App Móvil (Frontend)
1. Abre **otra** pestaña en tu terminal y navega a la carpeta mobile:
   ```bash
   cd mobile
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Arranca Expo:
   ```bash
   npx expo start
   ```
   *Se abrirá un código QR en tu terminal. Puedes escanearlo con la app **Expo Go** en tu celular físico (asegúrate de que tu PC y celular estén en la misma red WiFi).*

---

## 4. Despliegue en Producción y Base de Datos (Render.com)

Threshold utiliza una **Arquitectura Híbrida**. Para producción se requiere PostgreSQL para garantizar persistencia y escalabilidad ante reinicios.

Si el servidor o la BD se cae y necesitas reconectarlo o levantar uno nuevo desde cero en Render, sigue estos pasos:

### 4.1. Crear la Base de Datos PostgreSQL en Render
1. Inicia sesión en [Render.com](https://render.com).
2. Haz clic en **New** > **PostgreSQL**.
3. Rellena el formulario:
   - **Name:** `threshold-db` (o el nombre que prefieras).
   - **Database:** `threshold`
   - **User:** `threshold_admin`
   - Selecciona el **Region** más cercano.
   - Elige el plan (Free o Starter).
4. Haz clic en **Create Database**.
5. Cuando se termine de crear, busca la sección **"Internal Database URL"** (si tu backend también estará alojado en Render) o **"External Database URL"** (si corres el backend desde otra plataforma o desde local para probar). 
   - *Ejemplo de URL:* `postgres://threshold_admin:PASSWORD_COMPLEJO@dpg-abcde-a.oregon-postgres.render.com/threshold`

### 4.2. Conectar el Proyecto a la Nueva Base de Datos
1. Copia esa URL completa generada por Render.
2. Si el backend está alojado en Render (como un *Web Service*), ve a los **Environment Variables** del *Web Service* y agrega:
   - **Key:** `DATABASE_URL`
   - **Value:** `<Pega aquí la URL copiada>`
3. En el momento en que guardes las variables, el servidor de Node se reiniciará.
4. El archivo `db.js` detectará automáticamente que ahora existe la variable `DATABASE_URL`, ignorará SQLite, se conectará al PostgreSQL de Render y ejecutará todas las tablas y sentencias `CREATE TABLE` automáticamente (gracias al sistema de migraciones que tenemos). ¡No necesitas ejecutar SQL manualmente!

### 4.3. Renovación o Cambio de Servidor
Si en un futuro cambias a otro proveedor (Heroku, Supabase, AWS RDS, etc.):
- El proceso es exactamente el mismo. Solo necesitas obtener la cadena de conexión de Postgres (`postgresql://...`), ponerla en la variable de entorno `DATABASE_URL` del backend y reiniciar. El sistema se auto-inicializará.
