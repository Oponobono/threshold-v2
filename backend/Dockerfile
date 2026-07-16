# Usamos una imagen oficial de Node.js ligera basada en Debian (bullseye-slim)
# que es perfecta para instalar paquetes del sistema operativo.
FROM node:18-bullseye-slim

# Evitar prompts interactivos durante la instalación
ENV DEBIAN_FRONTEND=noninteractive

# 1. Instalar LibreOffice y dependencias necesarias
# apt-get sí funciona aquí porque dentro del contenedor somos el usuario 'root' inicialmente
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    # Dependencias comunes requeridas por LibreOffice en contenedores headless
    libxext6 \
    libxrender1 \
    libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*

# 2. Configurar el directorio de trabajo dentro del contenedor
WORKDIR /app

# 3. Copiar los archivos de manifiesto de dependencias primero
# (Esto optimiza la caché de Docker: si no cambias las dependencias, 
# se salta la instalación en el siguiente build)
COPY package.json package-lock.json ./

# 4. Instalar las dependencias de Node.js
RUN npm ci

# 5. Copiar el resto del código fuente del backend
COPY . .

# 6. Exponer el puerto en el que corre el servidor
EXPOSE 3000

# 7. Comando de inicio (el equivalente a tu antiguo start command)
CMD ["npm", "start"]
