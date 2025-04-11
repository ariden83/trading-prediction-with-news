/**
 * app.js - Script serveur principal pour les actualités et prévisions du Brent
 * Ce fichier est destiné à être exécuté dans un environnement Node.js
 */

// Importation des modules
const yahooFinance = require('./api/yahooFinance');
const newsAnalyzer = require('./api/newsAnalyzer');
const predictionEngine = require('./api/predictionEngine');

// Configuration globale
const config = {
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

// Fonctions d'API que nous pouvons exposer

/**
 * Récupère les données historiques pour une période donnée
 * @param {string} period - Période ('1d', '5d', '1mo', '6mo', '1y')
 * @returns {Promise<Object>} - Données et metadata formatées
 */
async function getHistoricalData(period) {
    try {
        console.log(`Récupération des données historiques pour la période: ${period}`);
        
        // Détermination de l'intervalle en fonction de la période
        const interval = config.periods[period].interval;
        
        // Récupération des données via l'API Yahoo Finance
        const result = await yahooFinance.getBrentHistoricalData(period, interval);
        
        return result;
    } catch (error) {
        console.error('Erreur lors de la récupération des données historiques:', error);
        throw error;
    }
}

/**
 * Récupère le prix actuel du Brent
 * @returns {Promise<Object>} - Prix actuel et métadonnées
 */
async function getCurrentPrice() {
    try {
        console.log('Récupération du prix actuel du Brent');
        
        const result = await yahooFinance.getCurrentBrentPrice();
        return result;
    } catch (error) {
        console.error('Erreur lors de la récupération du prix actuel:', error);
        throw error;
    }
}

/**
 * Récupère les actualités récentes sur le Brent
 * @returns {Promise<Array>} - Liste des actualités
 */
async function getNews() {
    try {
        console.log('Récupération des actualités sur le Brent');

        let news = await newsAnalyzer.getBrentNews();
        // Tri par date décroissante (du plus récent au plus ancien)
        news = news.sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 50);
        return news;
    } catch (error) {
        console.error('Erreur lors de la récupération des actualités:', error);
        throw error;
    }
}

/**
 * Génère une prévision basée sur les données historiques et les actualités
 * @param {Array} historicalData - Données historiques
 * @param {Array} news - Actualités récentes
 * @returns {Object} - Prévision du cours
 */
function generatePrediction(historicalData, news) {
    try {
        console.log('Génération de la prévision du Brent');
        
        // Vérification des données nécessaires
        if (historicalData.length === 0 || news.length === 0) {
            throw new Error('Données insuffisantes pour générer une prévision');
        }
        
        // Analyse du sentiment des actualités
        const newsSentiment = newsAnalyzer.analyzeNewsSentiment(news);
        
        // Génération de la prévision
        const prediction = predictionEngine.generateBrentPrediction(historicalData, newsSentiment);
        
        return prediction;
    } catch (error) {
        console.error('Erreur lors de la génération de la prévision:', error);
        throw error;
    }
}

/**
 * Point d'entrée principal pour obtenir toutes les données en une seule requête
 * @param {string} period - Période pour les données historiques
 * @returns {Promise<Object>} - Toutes les données nécessaires pour l'interface
 */
async function getAllData(period = '1d') {
    try {
        console.log(`Récupération de toutes les données pour la période: ${period}`);
        
        // Récupération parallèle des données historiques et des actualités
        const [historicalResult, news] = await Promise.all([
            getHistoricalData(period),
            getNews()
        ]);
        
        // Génération de la prévision
        const prediction = generatePrediction(historicalResult.data, news);
        
        // Préparation du résultat complet
        return {
            currentPrice: {
                price: historicalResult.metadata.regularMarketPrice,
                change: historicalResult.metadata.change,
                changePercent: historicalResult.metadata.changePercent,
                timestamp: historicalResult.metadata.regularMarketTime
            },
            historicalData: historicalResult.data,
            news: news,
            prediction: prediction
        };
    } catch (error) {
        console.error('Erreur lors de la récupération des données complètes:', error);
        
        // En cas d'erreur, on peut retourner des données simulées
        // Ce serait à implémenter selon les besoins
        throw error;
    }
}

// Exportation des fonctions d'API
module.exports = {
    getHistoricalData,
    getCurrentPrice,
    getNews,
    generatePrediction,
    getAllData
};