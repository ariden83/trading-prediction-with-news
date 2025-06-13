# Makefile pour le déploiement Docker de l'application de prévision du Brent

# Variables
IMAGE_NAME = trading-prediction-news
CONTAINER_NAME = trading-prediction-container
PORT = 3001
NEWS_INTERVAL = 900000
ENABLE_WEBSOCKET = false
LOCAL_NEWS_DIR = ./news-data

# Construire l'image Docker
build:
	docker build -t $(IMAGE_NAME) .

# Déployer le service dans un container Docker
deploy: build
	@echo "Arrêt du container existant..."
	-docker stop $(CONTAINER_NAME)
	-docker rm $(CONTAINER_NAME)
	@echo "Démarrage du nouveau container..."
	mkdir -p $(LOCAL_NEWS_DIR)
	docker run -d --name $(CONTAINER_NAME) -p $(PORT):$(PORT) -v $(LOCAL_NEWS_DIR):/app/src/seeds -e NEWS_CHECK_INTERVAL=$(NEWS_INTERVAL) -e ENABLE_WEBSOCKET=$(ENABLE_WEBSOCKET) $(IMAGE_NAME)
	@echo "Service déployé sur http://localhost:$(PORT)"

# Arrêter le service
stop:
	docker stop $(CONTAINER_NAME)
	docker rm $(CONTAINER_NAME)

# Voir les logs du container
logs:
	docker logs -f $(CONTAINER_NAME)

# Redémarrer le service
restart: stop deploy

# Nettoyer les images Docker inutilisées
clean:
	docker image prune -f

# Déployer avec WebSocket activé
deploy-ws: ENABLE_WEBSOCKET = true
deploy-ws: deploy

# Afficher le statut du container
status:
	docker ps -a | grep $(CONTAINER_NAME) || echo "Container non trouvé"

.PHONY: build deploy deploy-ws stop logs restart clean status