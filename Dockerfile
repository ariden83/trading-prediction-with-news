# Dockerfile pour l'application de prévision du Brent
FROM node:18-alpine

# Installer Python et pip
RUN apk add --no-cache python3 py3-pip

# Créer le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
COPY requirements-docker.txt ./

# Installer les dépendances Node.js
RUN npm ci --only=production

# Installer les dépendances Python dans un environnement virtuel
RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir -r requirements-docker.txt

# Copier le code source
COPY . .

# Exposer le port
EXPOSE 3001

# Variables d'environnement pour la configuration
ENV NEWS_CHECK_INTERVAL=900000
ENV ENABLE_WEBSOCKET=false
ENV PATH="/app/venv/bin:$PATH"

# Commande de démarrage
CMD ["npm", "start"]