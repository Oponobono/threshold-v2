FROM node:18-bullseye-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV HOME=/tmp
ENV UNOPATH=/usr

# Instalar LibreOffice completo con filtros de conversión y fuentes.
# Sin --no-install-recommends: necesitamos los filtros PDF/PPT y fuentes reales.
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-pdf-import \
    libreoffice-ppt-import \
    fonts-liberation \
    fonts-dejavu-core \
    fontconfig \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

# Verificar que soffice está accesible
RUN which soffice && soffice --version

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
