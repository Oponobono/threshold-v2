# 🔒 SETUP SEGURO - Threshold

## 1️⃣ **Configuración Inicial**

Después de clonar o cambiar de rama, ejecuta:

```bash
# Copiar archivos de ejemplo
cp backend/.env.example backend/.env
cp mobile/.env.example mobile/.env
```

## 2️⃣ **Agregar tus API Keys**

### Backend (`backend/.env`)
```bash
# Edita backend/.env y agrega:
GROQ_API_KEY=tu_clave_aqui
SUPADATA_API_KEY=tu_clave_aqui
```

### Mobile (`mobile/.env.local`)
```bash
# Agrega configuraciones específicas del móvil si las necesitas
```

## 3️⃣ **Verificar que los Secretos NO se Suban**

```bash
# Antes de hacer commit:
git check-ignore backend/.env mobile/.env
# Debe mostrar: .gitignore:X:.env   backend/.env

# Si no está ignord, ejecuta:
git rm --cached backend/.env mobile/.env
```

## 4️⃣ **Workflow Seguro**

```bash
# ✅ HACES CAMBIOS EN TU CÓDIGO
git add backend/controllers/...
git add mobile/src/...

# ❌ NUNCA hagas:
git add backend/.env
git add mobile/.env

# ✅ Commit seguro:
git commit -m "feat: agregar nueva feature"
git push origin main
```

## 5️⃣ **Regenerar API Keys (IMPORTANTE)**

Si las keys estaban expuestas en el historio anterior:

1. **Groq:** https://console.groq.com/keys
   - Crear nueva key
   - Revocar la anterior
   - Actualizar en `backend/.env`

2. **Supadata:** https://supadata.ai/dashboard
   - Crear nueva key
   - Actualizar en `backend/.env`

## 6️⃣ **Instalar Dependencias**

```bash
# Backend
cd backend
npm install

# Mobile
cd ../mobile
npm install

# Docs
cd ../docs
npm install
```

## 7️⃣ **Empezar a Desarrollar**

```bash
# Backend
cd backend
npm start

# Mobile (en otra terminal)
cd mobile
npm start
# o con Expo:
npx expo start
```

---

## ⚠️ **Checklist de Seguridad**

- [ ] `.env` local NO está commiteado
- [ ] API keys están en `backend/.env` (no en GitHub)
- [ ] `.gitignore` ignora `.env`, `*.sqlite`, etc.
- [ ] Nunca hacer `git add .env`
- [ ] Si ves `.env` en `git status`, ejecuta `git restore .env`

---

## 🚀 **Repositorios**

- **Público (limpio):** https://github.com/Oponobono/threshold-v2
- **Rama local:** `C:\Users\cris7\OneDrive\Desktop\Threshold`

Ambos están sincronizados y protegidos contra secretos.
