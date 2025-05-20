# ────────────────────────────────────────────────────────────────
# 1) Etap: kompilujemy podatne ImageMagick 7.1.0-48
# ────────────────────────────────────────────────────────────────
FROM node:16-bullseye AS im-builder

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential pkg-config wget \
      libjpeg-dev libpng-dev libtiff-dev libfreetype6-dev libxml2-dev zlib1g-dev \
 && rm -rf /var/lib/apt/lists/*

RUN wget https://download.imagemagick.org/ImageMagick/download/releases/ImageMagick-7.1.0-48.tar.xz \
 && tar xf ImageMagick-7.1.0-48.tar.xz \
 && cd ImageMagick-7.1.0-48 \
 && ./configure --prefix=/usr/local --disable-docs \
 && make -j"$(nproc)" \
 && make install \
 && ldconfig \
 && cd .. && rm -rf ImageMagick-7.1.0-48*

# ────────────────────────────────────────────────────────────────
# 2) Etap: budujemy finalny obraz z Node.js + podatne IM
# ────────────────────────────────────────────────────────────────
FROM node:16-bullseye-slim

# Zainstaluj build‐deps dla better-sqlite3
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ libsqlite3-dev \
 && rm -rf /var/lib/apt/lists/*

# Przenieś ImageMagick z etapu im-builder
COPY --from=im-builder /usr/local /usr/local

# Upewnij się, że CLI magick/convert działa
RUN command -v magick

WORKDIR /app

# Zainstaluj zależności back-endu
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Skopiuj kod serwera i zbuduj front-end
COPY . .
RUN cd client && npm ci && npm run build

# Przygotuj katalogi uploadów
RUN mkdir -p uploads/temp uploads/profiles

EXPOSE 5000
ENV PORT=5000
# JWT_SECRET nadpisz przy uruchomieniu
ENV JWT_SECRET=demo_secret
CMD ["node", "server.js"]

