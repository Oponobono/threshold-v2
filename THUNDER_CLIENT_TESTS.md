# Pruebas de Diagnóstico - Notas (Assessments)

**Base URL:** `http://localhost:3000/api`  
**User:** user  
**Password:** 1234  
**UserID:** 2

---

## 1️⃣ PASO 1: Login - Obtener Token JWT

**Método:** `POST`  
**URL:** `http://localhost:3000/api/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "username": "user",
  "password": "1234"
}
```

**Qué esperar:**
- ✅ Status: `200 OK`
- ✅ Response debe contener: `token`, `user.id`, `user.username`
- 📝 **COPIA EL TOKEN** (lo necesitarás en todas las pruebas siguientes)

**Salida esperada (ejemplo):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "username": "user",
    "email": "user@example.com"
  }
}
```

---

## 2️⃣ PASO 2: GET - Obtener todas las notas del usuario

**Método:** `GET`  
**URL:** `http://localhost:3000/api/assessments/user/2`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {PEGA_TU_TOKEN_AQUI}
```

**Body:** (vacío)

**Qué esperar:**
- ✅ Status: `200 OK`
- ✅ Response: Array de notas (puede estar vacío `[]` si no hay notas)
- 🔍 **Si ves error de autenticación:** Verifica que el token sea correcto

**Ejemplo de respuesta:**
```json
[
  {
    "id": 1,
    "subject_id": 5,
    "name": "Examen Matemáticas",
    "type": "exam",
    "date": "2024-05-20",
    "score": 85,
    "percentage": 85,
    "weight": "20"
  }
]
```

**O vacío:**
```json
[]
```

---

## 3️⃣ PASO 3: POST - Crear una nueva nota

**Método:** `POST`  
**URL:** `http://localhost:3000/api/assessments`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {PEGA_TU_TOKEN_AQUI}
```

**Body (JSON):**
```json
{
  "subject_id": 8,
  "name": "Test Note - Diagnóstico",
  "type": "note",
  "date": "2024-05-22",
  "weight": "10",
  "out_of": 100,
  "score": 85,
  "percentage": 85,
  "grade_value": 4.0
}
```

**Qué esperar:**
- ✅ Status: `201 Created`
- ✅ Response contiene: `id`, `message` o `success: true`
- 📝 **COPIA EL ID** de la nota creada (lo usaremos en los siguientes pasos)

**Ejemplo de respuesta:**
```json
{
  "id": 42,
  "message": "Evaluación agregada"
}
```

**O si falla:**
```json
{
  "error": "subject_id es requerido"
}
```

---

## 4️⃣ PASO 4: PUT - Actualizar la nota creada

**Método:** `PUT`  
**URL:** `http://localhost:3000/api/assessments/{NOTA_ID}` (Cambia {NOTA_ID} por el ID del paso anterior, ej: 42)

**Ejemplo completo:** `http://localhost:3000/api/assessments/42`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {PEGA_TU_TOKEN_AQUI}
```

**Body (JSON):**
```json
{
  "score": 90,
  "percentage": 90,
  "grade_value": 4.5
}
```

**Qué esperar:**
- ✅ Status: `200 OK`
- ✅ Response contiene: `message` o datos actualizados

**Ejemplo de respuesta:**
```json
{
  "message": "Evaluación actualizada"
}
```

---

## 5️⃣ PASO 5: GET - Verificar que la nota fue actualizada

**Método:** `GET`  
**URL:** `http://localhost:3000/api/assessments/user/2`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {PEGA_TU_TOKEN_AQUI}
```

**Qué esperar:**
- ✅ Status: `200 OK`
- ✅ Debes ver la nota creada con `score: 90` y `percentage: 90`

---

## 📋 CHECKLIST DE DIAGNÓSTICO

Marca cada paso:

- [ ] **1. Login:** ¿Obtuviste el token? ¿Sin errores?
- [ ] **2. GET notas:** ¿Retorna array vacío o con datos? ¿Algún error?
- [ ] **3. POST crear nota:** ¿Se creó exitosamente? ¿Obtuviste un ID?
- [ ] **4. PUT actualizar nota:** ¿Se actualizó sin errores?
- [ ] **5. GET verificar:** ¿Aparece la nota actualizada?

---

## 🔍 INFORMACIÓN A REPORTAR

Para cada prueba, reporta:

1. **Status Code** (200, 201, 400, 401, 500, etc.)
2. **Response Body** (completo, en JSON)
3. **Tiempo de respuesta** (en ms)
4. **Cualquier error o mensaje** que veas

**Formato sugerido:**

```
✅ PRUEBA 1: Login
Status: 200
Response: {...}
Token: eyJhbGc...

✅ PRUEBA 2: GET notas
Status: 200
Response: []

❌ PRUEBA 3: POST crear nota
Status: 400
Response: {"error": "subject_id es requerido"}
```

---

## 📱 INFORMACIÓN DEL CLIENTE MÓVIL

Mientras haces las pruebas del servidor, también revisa en la app móvil:

1. **¿Ves que se creó la nota en la app?**
2. **¿Ves logs/errores en la consola del cliente?**
3. **¿Cuánto tiempo tarda en aparecer?**

---

## 🛠️ NOTAS TÉCNICAS

- El token JWT expira después de cierto tiempo. Si una prueba falla con "Token inválido", repite el login.
- Asegúrate de usar `subject_id: 1` o verifica que ese sujeto exista en tu BD.
- Si `subject_id` no existe, obtendrás un error de FOREIGN KEY.
