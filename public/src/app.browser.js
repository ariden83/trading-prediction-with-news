/**
 * app.browser.js - Script client pour les actualités et prévisions du Brent
 * Ce fichier est destiné à être exécuté dans un navigateur
 */

// Configuration globale
const config = {
    // URL de base pour les appels API
    apiBaseUrl: 'http://localhost:3001/api', // URL complète du serveur Express
    // Symbole du Brent sur Yahoo Finance
    brentSymbol: 'BZ=F',
    // Périodes disponibles pour l'affichage des données
    periods: {
        '1d': { interval: '5m', days: 1 },
        '5d': { interval: '30m', days: 5 },
        '1mo': { interval: '1d', days: 30 },
        '6mo': { interval: '1wk', days: 180 },
        '1y': { interval: '1mo', days: 365 }
    }
};

// Variables globales
let chart; // Instance du graphique
let scoreChart;
let currentPeriod = '1d'; // Période d'affichage par défaut
let historicalData = []; // Données historiques
let newsData = []; // Données d'actualités
let predictionData = null; // Données de prévision
let updateInterval = null;
let updateNewsInterval = null;

window.addEventListener('beforeunload', () => {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    if (updateNewsInterval) {
        clearInterval(updateNewsInterval);
    }
});

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Application de prévision du Brent initialisée');

    // Initialisation des écouteurs d'événements
    initEventListeners();

    // Chargement des données initiales
    loadInitialData();
});

// Initialisation des écouteurs d'événements
function initEventListeners() {

    updateInterval = setInterval(() => {
        fetchHistoricalDataLight(currentPeriod).catch(error => {
            console.error('Erreur lors de la mise à jour automatique des données:', error);
        });
    }, 60000 * 5); // Mise à jour toutes les 60 secondes * 5

    updateNewsInterval = setInterval(() => {
        fetchNewsData().catch(error => {
            console.error('Erreur lors de la mise à jour automatique des données:', error);
        });
    }, 60000 * 60 + 10); // Mise à jour toutes les 60 secondes * 5

    // Gestion des boutons de période
    const periodButtons = document.querySelectorAll('.period-selector button');
    periodButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Mise à jour de la période active
            periodButtons.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');

            // Récupération de la période sélectionnée
            currentPeriod = e.target.getAttribute('data-period');
            console.log("*** CLIC SUR PÉRIODE:", currentPeriod);

            // Arrêter l'intervalle précédent s'il existe
            if (updateInterval) {
                clearInterval(updateInterval);
                updateInterval = null;
            }

            try {
                // Si la période est '1d', démarrer un intervalle pour les mises à jour automatiques
                if (currentPeriod === '1d') {
                    updateInterval = setInterval(() => {
                        fetchHistoricalDataLight(currentPeriod).catch(error => {
                            console.error('Erreur lors de la mise à jour automatique des données:', error);
                        });
                    }, 60000 * 5); // Mise à jour toutes les 60 secondes * 5
                }

                // Chargement des données pour la nouvelle période
                fetchHistoricalDataLight(currentPeriod).catch(error => {
                    console.error('Erreur lors du chargement des données historiques:', error);
                });
            } catch (error) {
                console.error('Erreur lors du chargement des données:', error);
            }
        });
    });
}

// Chargement des données initiales
function loadInitialData() {
    // Affichage d'un message de chargement
    updateLoadingStatus('Chargement des données en cours...');

    // Approche plus robuste - charger chaque partie séparément
    // pour éviter qu'une erreur dans une partie n'empêche l'affichage des autres

    // Chargement des données historiques
    fetchHistoricalData(currentPeriod).catch((error) => {
        console.error('Erreur lors du chargement initial des données historiques:', error);
        // La gestion des erreurs est déjà faite dans fetchHistoricalData
    });

    // Chargement des actualités indépendamment des données historiques
    fetchNewsData().catch((error) => {
        console.error('Erreur lors du chargement initial des actualités:', error);
        // La gestion des erreurs est déjà faite dans fetchNewsData
    });
}

// Affiche un message d'erreur lorsque l'API n'est pas disponible
function showApiErrorMessage() {
    // Créer un bandeau d'erreur
    const errorBanner = document.createElement('div');
    errorBanner.className = 'error-banner';
    errorBanner.innerHTML = `
        <div class="error-content">
            <h2>Erreur de connexion</h2>
            <p>Impossible de communiquer avec le serveur. Veuillez vérifier que le serveur est démarré et réessayer.</p>
            <button id="retry-button">Réessayer</button>
        </div>
    `;

    // Insérer le bandeau au début du body
    document.body.insertBefore(errorBanner, document.body.firstChild);

    // Nettoyer l'interface des données partielles ou incorrectes
    clearDataDisplay();

    // Ajouter un événement au bouton de réessai
    document.getElementById('retry-button').addEventListener('click', () => {
        // Supprimer le bandeau d'erreur
        errorBanner.remove();
        // Réessayer de charger les données
        loadInitialData();
    });
}

// Nettoyer l'affichage des données
function clearDataDisplay() {
    // Effacer le graphique
    const ctx = document.getElementById('price-chart').getContext('2d');
    if (chart) {
        chart.destroy();
        chart = null;
    }

    // Effacer le prix actuel
    document.getElementById('current-price').textContent = '--,-- $';
    document.getElementById('price-change').textContent = '--,-- (--,--%) ';
    document.getElementById('price-direction').textContent = '';

    // Effacer les actualités
    document.getElementById('news-container').innerHTML = '<p class="loading-message">Données non disponibles</p>';

    // Effacer la prévision
    document.getElementById('prediction-price').textContent = '--,-- $';
    document.getElementById('prediction-change').textContent = '--,-- (--,--%) ';
    document.getElementById('prediction-direction').textContent = '';
    document.getElementById('confidence-level').textContent = '--';
    document.getElementById('factors-list').innerHTML = '<li>Données non disponibles</li>';
}

async function fetchHistoricalDataLight(period) {
    try {
        console.log(`Récupération des données historiques pour la période: ${period}`);

        // Log explicite pour la période
        console.log(`La période actuelle est: ${period}`);

        // Affichage d'un message de chargement
        updateLoadingStatus('Récupération des données historiques...');

        // URL pour récupérer les données historiques
        const url = `${config.apiBaseUrl}/historical-data?period=${period}`;
        console.log(`Requête API: ${url}`);

        // Appel à l'API
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        // Traitement des données
        const responseText = await response.text();
        // console.log('Réponse brute:', responseText);

        const result = JSON.parse(responseText);
        // console.log('Données historiques reçues:', result);

        // Vérification des données
        if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
            console.error('Données historiques invalides ou vides');
            throw new Error('Données historiques invalides ou vides');
        }

        // Vérification des métadonnées
        if (!result.metadata) {
            console.error('Métadonnées manquantes dans la réponse');
            throw new Error('Métadonnées manquantes dans la réponse');
        }

        // console.log(`AVANT: Nombre de points de données pour la période ${currentPeriod}: ${historicalData.length}`);

        // Mise à jour explicite des données historiques
        historicalData = [...result.data]; // Copie profonde pour s'assurer que c'est une nouvelle référence

        // console.log(`APRÈS: Nombre de points de données pour la période ${period}: ${historicalData.length}`);
        // console.log('Exemple de données :', historicalData.slice(0, 3));

        // Mise à jour de l'affichage du prix actuel
        updatePriceDisplay(
            result.metadata.regularMarketPrice,
            result.metadata.change,
            result.metadata.changePercent
        );

        // Force la destruction et recréation du graphique
        if (chart) {
            console.log('Destruction forcée du graphique existant');
            chart.destroy();
            chart = null;
        }

        // Création d'un délai court pour s'assurer que le DOM est mis à jour
        setTimeout(() => {
            try {
                // Mise à jour du graphique avec les nouvelles données
                console.log(`Mise à jour du graphique avec ${result.data.length} points de données pour la période ${period}`);

                // Force le changement de la période courante au moment du rafraîchissement
                currentPeriod = period;

                // Mise à jour du graphique
                recreateChartWithData(result.data);

            } catch (chartError) {
                console.error('Erreur lors de la mise à jour du graphique:', chartError);
            }
        }, 100);

        // Suppression de tout bandeau d'erreur existant puisque la requête a réussi
        const existingErrorBanner = document.querySelector('.error-banner');
        if (existingErrorBanner) {
            existingErrorBanner.remove();
        }

        console.log('Données historiques récupérées avec succès');
        return result;
    } catch (error) {
        console.error('Erreur lors de la récupération des données historiques:', error);
        updateLoadingStatus('Erreur lors de la récupération des données.');

        // Afficher un message d'erreur
        showApiErrorMessage();
        throw error; // Propager l'erreur
    }
}

// Récupération des données historiques
async function fetchHistoricalData(period) {
    try {
        console.log(`Récupération des données historiques pour la période: ${period}`);

        // Log explicite pour la période
        console.log(`La période actuelle est: ${period}`);

        // Affichage d'un message de chargement
        updateLoadingStatus('Récupération des données historiques...');

        // URL pour récupérer les données historiques
        const url = `${config.apiBaseUrl}/historical-data?period=${period}`;
        console.log(`Requête API: ${url}`);

        // Appel à l'API
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        // Traitement des données
        const responseText = await response.text();
        console.log('Réponse brute:', responseText);

        const result = JSON.parse(responseText);
        console.log('Données historiques reçues:', result);

        // Vérification des données
        if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
            console.error('Données historiques invalides ou vides');
            throw new Error('Données historiques invalides ou vides');
        }

        // Vérification des métadonnées
        if (!result.metadata) {
            console.error('Métadonnées manquantes dans la réponse');
            throw new Error('Métadonnées manquantes dans la réponse');
        }

        console.log(`AVANT: Nombre de points de données pour la période ${currentPeriod}: ${historicalData.length}`);

        // Mise à jour explicite des données historiques
        historicalData = [...result.data]; // Copie profonde pour s'assurer que c'est une nouvelle référence

        console.log(`APRÈS: Nombre de points de données pour la période ${period}: ${historicalData.length}`);
        console.log('Exemple de données :', historicalData.slice(0, 3));

        // Mise à jour de l'affichage du prix actuel
        updatePriceDisplay(
            result.metadata.regularMarketPrice,
            result.metadata.change,
            result.metadata.changePercent
        );

        // Force la destruction et recréation du graphique
        if (chart) {
            console.log('Destruction forcée du graphique existant');
            chart.destroy();
            chart = null;
        }

        // Création d'un délai court pour s'assurer que le DOM est mis à jour
        setTimeout(() => {
            try {
                // Mise à jour du graphique avec les nouvelles données
                console.log(`Mise à jour du graphique avec ${result.data.length} points de données pour la période ${period}`);

                // Force le changement de la période courante au moment du rafraîchissement
                currentPeriod = period;

                // Mise à jour du graphique
                recreateChartWithData(result.data);

                // Génération de la prévision si nous avons des actualités
                if (newsData.length > 0) {
                    try {
                        generatePrediction();
                    } catch (predictionError) {
                        console.error('Erreur lors de la génération de la prévision:', predictionError);
                    }
                }
            } catch (chartError) {
                console.error('Erreur lors de la mise à jour du graphique:', chartError);
            }
        }, 100);

        // Suppression de tout bandeau d'erreur existant puisque la requête a réussi
        const existingErrorBanner = document.querySelector('.error-banner');
        if (existingErrorBanner) {
            existingErrorBanner.remove();
        }

        console.log('Données historiques récupérées avec succès');
        return result;
    } catch (error) {
        console.error('Erreur lors de la récupération des données historiques:', error);
        updateLoadingStatus('Erreur lors de la récupération des données.');

        // Afficher un message d'erreur
        showApiErrorMessage();
        throw error; // Propager l'erreur
    }
}

// Récupération des actualités
async function fetchNewsData() {
    try {
        console.log('Récupération des actualités');

        // Affichage d'un message de chargement
        updateLoadingStatus('Récupération des actualités...');

        // URL pour récupérer les actualités
        const url = `${config.apiBaseUrl}/news`;

        // Appel à l'API
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        // Traitement des données
        const news = await response.json();

        // Mise à jour des données d'actualités
        newsData = news;

        // Mise à jour de l'affichage des actualités
        updateNewsDisplay(news);

        // Génération de la prévision si nous avons des données historiques
        if (historicalData.length > 0) {
            try {
                generatePrediction();
            } catch (error) {
                console.error('Erreur lors de la génération de la prévision:', error);
                // Ne pas arrêter le flux principal
            }
        }

        console.log('Actualités récupérées avec succès');
    } catch (error) {
        console.error('Erreur lors de la récupération des actualités:', error);
        updateLoadingStatus('Erreur lors de la récupération des actualités.');

        // Message simple dans la section actualités au lieu d'un bandeau d'erreur
        // si nous avons déjà chargé les données historiques avec succès
        if (historicalData.length > 0) {
            // Afficher un message dans la section actualités
            const newsContainer = document.getElementById('news-container');
            newsContainer.innerHTML = '<p class="loading-message">Impossible de charger les actualités. Veuillez réessayer plus tard.</p>';
        } else {
            // Sinon, afficher le bandeau d'erreur
            showApiErrorMessage();
            throw error; // Propager l'erreur seulement si on n'a pas les données historiques
        }
    }
}

// Génération de la prévision
async function generatePrediction() {
    try {
        console.log('Génération de la prévision');

        // Vérification des données nécessaires
        if (historicalData.length === 0 || newsData.length === 0) {
            console.error('Données insuffisantes pour générer une prévision');
            return;
        }

        // URL pour générer la prévision
        const url = `${config.apiBaseUrl}/prediction`;

        // Préparation des données pour l'appel API
        const requestData = {
            historicalData: historicalData,
            news: newsData.map(item => {
                const today = moment().format('YYYY-MM-DD');
                const newsItem = {
                    sentiment: item.sentiment,
                    date: item.date,
                    sentiments: {
                        compound: item.sentiments.compound,
                    }
                };
                if (item.date === today) {
                    newsItem.title = item.title;
                    newsItem.source = item.source;
                }
                return newsItem;
            }),
        };

        // Appel à l'API
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        // Traitement des données
        const prediction = await response.json();

        // Mise à jour des données de prévision
        predictionData = prediction;

        // Mise à jour de l'affichage de la prévision
        await updatePredictionDisplay(prediction);

        console.log('Prévision générée avec succès');


        await new Promise(resolve => setTimeout(resolve, 500));
        await updateScoreChart(prediction.scoreHistory);


    } catch (error) {
        console.error('Erreur lors de la génération de la prévision:', error);
        updateLoadingStatus('Erreur lors de la génération de la prévision.');

        // Ne pas afficher le bandeau d'erreur et ne pas propager l'erreur pour les prévisions
        // car c'est une fonctionnalité secondaire et les données principales sont déjà chargées

        // Mettre à jour l'interface avec un message pour indiquer que la prévision n'est pas disponible
        document.getElementById('prediction-price').textContent = '--,-- $';
        document.getElementById('prediction-change').textContent = '--,-- (--,--%) ';
        document.getElementById('prediction-direction').textContent = '';
        document.getElementById('confidence-level').textContent = '--';
        document.getElementById('factors-list').innerHTML = '<li>Prévision non disponible pour le moment</li>';
    }
}

async function fetchDailyHistoric() {
    // URL pour récupérer les données historiques
    const url = `${config.apiBaseUrl}/historical-data?period=1mo`;
    console.log(`Requête API: ${url}`);

    // Appel à l'API
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
        }
    });

    if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
    }

    // Traitement des données
    const responseText = await response.text();
    console.log('Réponse brute:', responseText);

    const result = JSON.parse(responseText);
    console.log('Données historiques reçues:', result);

    // Vérification des données
    if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        console.error('Données historiques invalides ou vides');
        throw new Error('Données historiques invalides ou vides');
    }

    // Vérification des métadonnées
    if (!result.metadata) {
        console.error('Métadonnées manquantes dans la réponse');
        throw new Error('Métadonnées manquantes dans la réponse');
    }

    // Mise à jour explicite des données historiques
    return [...result.data]; // Copie profonde pour s'assurer que c'est une nouvelle référence
}

async function updateScoreChart(scoreHistory) {
    // Récupération du canvas
    const chartContainer = document.querySelector('.prediction-factors-score');
    const existingCanvas = document.getElementById('score-chart');

    if (scoreChart) {
        try {
            scoreChart.destroy();
        } catch (e) {
            console.error('Erreur lors de la destruction du graphique:', e);
        }
        scoreChart = null;
    }

    // Suppression du canvas existant
    if (existingCanvas && existingCanvas.parentNode) {
        existingCanvas.parentNode.removeChild(existingCanvas);
    }

    // Création d'un nouveau canvas
    const newCanvas = document.createElement('canvas');
    newCanvas.id = 'score-chart';
    newCanvas.style.height = '400px'; // Hauteur fixe en pixels
    chartContainer.appendChild(newCanvas);

    // Transformation des données de scoreHistory en labels et valeurs

    const labels = Object.keys(scoreHistory).reverse();
    const values = Object.values(scoreHistory).reverse();


    const dayHistoricMetadata = await fetchDailyHistoric();

    // Calcul des variations journalières à partir de historicalData
// Calcul des variations journalières en pourcentage
    const dailyChanges = labels.map((label, index) => {
        const currentItem = dayHistoricMetadata.find(d => d.date === label);
        const previousItem = index > 0 ? dayHistoricMetadata.find(d => d.date === labels[index - 1]) : null;

        if (currentItem && previousItem) {
            const percentageChange = ((currentItem.close - previousItem.close) / previousItem.close) * 100;
            return percentageChange.toFixed(2); // Arrondi à 2 décimales
        }
        return 0; // Pas de changement si pas de données précédentes
    });

// Vérification du dataset généré
    if (dailyChanges.length !== labels.length) {
        console.error('Incohérence dans le dataset généré');
        return;
    }

    // Création du nouveau graphique
    const ctx = newCanvas.getContext('2d');
    scoreChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Score de Sentiment par Date',
                    data: values,
                    borderColor: '#3498db',
                    backgroundColor: values.map(value => value > 0 ? 'rgba(52, 152, 219, 0.1)' : 'rgba(231, 76, 60, 0.1)'), // Bleu pour positif, rouge pour négatif
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointStyle: values.map(value => {
                        if (value > 0) return 'triangle'; // Triangle pour les valeurs positives
                        if (value < 0) return 'triangle'; // Triangle pour les valeurs négatives
                        return 'circle'; // Cercle pour les valeurs nulles
                    }),
                    pointBackgroundColor: values.map(value => {
                        if (value > 0) return 'green'; // Vert pour les valeurs positives
                        if (value < 0) return 'red'; // Rouge pour les valeurs négatives
                        return 'gray'; // Gris pour les valeurs nulles
                    }),
                    pointBorderColor: values.map(value => {
                        if (value > 0) return 'green';
                        if (value < 0) return 'red';
                        return 'gray';
                    }),
                    pointRadius: 6 // Taille des points
                },
                {
                    label: 'Variation Journalière',
                    data: dailyChanges,
                    borderColor: '#bfbfbf',
                    backgroundColor: 'rgba(191, 191, 191, 0.1)', // Rouge pour la variation
                    borderWidth: 2,
                    tension: 0.4,
                    fill: false,
                    pointStyle: dailyChanges.map(value => (value > 0 ? 'triangle' : 'circle')), // Triangle pour hausse, cercle pour baisse
                    pointBackgroundColor: dailyChanges.map(value => (value > 0 ? '#6faa6f' : '#aa6f6f')), // Vert grisé pour hausse, rouge grisé pour baisse
                    pointBorderColor: dailyChanges.map(value => (value > 0 ? '#6faa6f' : '#aa6f6f')),
                    pointRadius: 6 // Taille des points
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 500 // Animation plus rapide
            },
            plugins: {
                legend: {
                    display: true // Afficher la légende pour distinguer les deux lignes
                },
            },
            scales: {
                y: {
                    beginAtZero: false
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Mise à jour de l'affichage du prix actuel
function updatePriceDisplay(price, change = 0, changePercent = 0) {
    try {
        const priceElement = document.getElementById('current-price');
        const changeElement = document.getElementById('price-change');
        const directionElement = document.getElementById('price-direction');
        const lastUpdateElement = document.getElementById('last-update-time');

        // Mise à jour du prix
        priceElement.textContent = `${price.toFixed(2)} $`;

        // Mise à jour de la variation
        changeElement.textContent = `${change.toFixed(2)} (${changePercent.toFixed(2)}%) `;

        // Mise à jour de la direction (flèche)
        if (change > 0) {
            directionElement.textContent = '▲';
            changeElement.classList.add('price-up');
            changeElement.classList.remove('price-down');
        } else if (change < 0) {

            directionElement.textContent = '▼';
            changeElement.classList.add('price-down');
            changeElement.classList.remove('price-up');
        } else {
            directionElement.textContent = '►';

            changeElement.classList.remove('price-up');
            changeElement.classList.remove('price-down');
        }

        // Mise à jour de l'heure de dernière mise à jour
        const now = new Date();
        lastUpdateElement.textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    } catch (e) {
        console.error(e)
    }
}

// Recréation complète du graphique avec de nouvelles données
function recreateChartWithData(data) {
    console.log('Recréation complète du graphique avec période:', currentPeriod);
    console.log('Données pour la recréation:', data);

    // Récupération du canvas
    const chartContainer = document.querySelector('.chart-container');
    const existingCanvas = document.getElementById('price-chart');

    if (chart) {
        try {
            chart.destroy();
        } catch (e) {
            console.error('Erreur lors de la destruction du graphique:', e);
        }
        chart = null;
    }

    // Suppression du canvas existant
    if (existingCanvas && existingCanvas.parentNode) {
        existingCanvas.parentNode.removeChild(existingCanvas);
    }

    // Création d'un nouveau canvas
    const newCanvas = document.createElement('canvas');
    newCanvas.id = 'price-chart';
    chartContainer.appendChild(newCanvas);

    // Formatage des dates pour meilleure lisibilité
    const formattedData = [];
    for (let i = 0; i < data.length; i++) {
        formattedData.push({
            ...data[i],
            formattedDate: formatDate(data[i].date, currentPeriod)
        });
    }

    // Tri des données par date (croissant)
    formattedData.sort((a, b) => {
        return new Date(a.date) - new Date(b.date);
    });

    // Préparation des données pour le graphique
    const labels = formattedData.map(item => item.formattedDate);
    const prices = formattedData.map(item => item.close);

    console.log(`Préparation du graphique avec ${labels.length} labels et ${prices.length} prix.`);

    // Adapter le nombre de ticks en fonction de la période
    let ticksConfig = {};
    if (currentPeriod === '1m') {
        ticksConfig = {maxTicksLimit: 6};
    } else if (currentPeriod === '1d') {
        ticksConfig = { maxTicksLimit: 6 };
    } else if (currentPeriod === '5d') {
        ticksConfig = { maxTicksLimit: 10 };
    } else if (currentPeriod === '1mo') {
        ticksConfig = { maxTicksLimit: 15 };
    } else {
        ticksConfig = { maxTicksLimit: 12 };
    }

    // Création du nouveau graphique
    const ctx = newCanvas.getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Prix du Brent (USD)',
                data: prices,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 500 // Animation plus rapide
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(tooltipItem) {
                            if (!tooltipItem[0]) {
                                return "";
                            }
                            return 'Date: ' + tooltipItem[0].raw.x;
                        },
                        label: function(context) {
                            return 'Prix: ' + context.parsed.y.toFixed(2) + ' $';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: ticksConfig
                },
                y: {
                    beginAtZero: false,
                    // suggestedMin: Math.min(...prices) * 0.995,
                    // suggestedMax: Math.max(...prices) * 1.005
                }
            }
        }
    });

    console.log('Graphique créé avec succès pour la période:', currentPeriod);
}

// Formater la date en fonction de la période
function formatDate(dateString, period) {
    const date = new Date(dateString);

    if (period === '5m') {
        return date.getHours().toString().padStart(2, '0') + ':' +
            date.getMinutes().toString().padStart(2, '0');
    } else if (period === '1d') {
        // Pour une journée, afficher l'heure
        return date.getHours().toString().padStart(2, '0') + ':' +
               date.getMinutes().toString().padStart(2, '0');
    } else if (period === '5d') {
        // Pour 5 jours, afficher le jour et l'heure
        return (date.getMonth() + 1).toString().padStart(2, '0') + '/' +
               date.getDate().toString().padStart(2, '0') + ' ' +
               date.getHours().toString().padStart(2, '0') + 'h';
    } else if (period === '1mo') {
        // Pour un mois, afficher le jour
        return (date.getMonth() + 1).toString().padStart(2, '0') + '/' +
               date.getDate().toString().padStart(2, '0');
    } else {
        // Pour les périodes plus longues, afficher mois/année
        return (date.getMonth() + 1).toString().padStart(2, '0') + '/' +
               date.getFullYear().toString().substring(2);
    }
}

// Mise à jour de l'affichage des actualités
function updateNewsDisplay(news) {
    const newsContainer = document.getElementById('news-container');

    // Effacement du contenu actuel
    newsContainer.innerHTML = '';

    // Ajout des actualités
    if (news.length === 0) {
        newsContainer.innerHTML = '<p class="loading-message">Aucune actualité disponible</p>';
    } else {
        news.forEach(item => {
            const newsItem = document.createElement('div');
            newsItem.className = 'news-item';

            const li = document.createElement('li');
            const impactIcon = item.sentiment === 'positive' ? '▲' :
                item.sentiment === 'negative' ? '▼' : '';

            newsItem.innerHTML = `
                <div class="news-title">${item.title} ${impactIcon} </div>
                <div class="news-source">Source: <a href="${item.url}" target="_blank" title="${item.source}"> ${item.source}</a></div>
                <div class="news-date">Date: ${item.date}</div>
            `;

            newsContainer.appendChild(newsItem);
        });
    }
}

// Mise à jour de l'affichage de la prévision
function updatePredictionDisplay(prediction) {
    // Récupération des éléments du DOM
    const predictionPriceElement = document.getElementById('prediction-price');
    const predictionChangeElement = document.getElementById('prediction-change');
    const predictionDirectionElement = document.getElementById('prediction-direction');
    const confidenceLevelElement = document.getElementById('confidence-level');
    const factorsListElement = document.getElementById('factors-list');

    // Mise à jour du prix prévu
    predictionPriceElement.textContent = `${prediction.predictedPrice.toFixed(2)} $`;

    // Mise à jour de la variation prévue
    predictionChangeElement.textContent = `${prediction.change.toFixed(2)} (${prediction.changePercent.toFixed(2)}%) `;

    // Mise à jour de la direction (flèche)
    if (prediction.change > 0) {
        predictionDirectionElement.textContent = '▲';
        predictionChangeElement.classList.add('price-up');
        predictionChangeElement.classList.remove('price-down');
    } else if (prediction.change < 0) {
        predictionDirectionElement.textContent = '▼';
        predictionChangeElement.classList.add('price-down');
        predictionChangeElement.classList.remove('price-up');
    } else {
        predictionDirectionElement.textContent = '►';
        predictionChangeElement.classList.remove('price-up');
        predictionChangeElement.classList.remove('price-down');
    }

    // Mise à jour du niveau de confiance
    confidenceLevelElement.textContent = prediction.confidence;

    // Mise à jour des facteurs d'influence
    factorsListElement.innerHTML = '';

    prediction.factors.forEach(factor => {
        const li = document.createElement('li');
        const impactIcon = factor.impact === 'positif' ? '▲' :
            factor.impact === 'négatif' ? '▼' : '';

        li.textContent = `${factor.name}: ${factor.description} (impact ${factor.impact} ${impactIcon})`;
        factorsListElement.appendChild(li);
    });
}

// Mise à jour du statut de chargement
function updateLoadingStatus(message) {
    console.log(message);
    // Possibilité d'ajouter un indicateur visuel de chargement
}