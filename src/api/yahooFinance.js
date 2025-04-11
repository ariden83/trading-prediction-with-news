/**
 * Module pour récupérer les données du Brent depuis Yahoo Finance
 * Ce module utilise axios pour effectuer des requêtes HTTP vers l'API Yahoo Finance
 */

// Importation des dépendances
const axios = require('axios');
const moment = require('moment');

// Configuration de base
const BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const BRENT_SYMBOL = 'BZ=F';

/**
 * Récupère les données historiques du Brent pour une période donnée
 * @param {string} period - Période de données ('1d', '5d', '1mo', '6mo', '1y')
 * @param {string} interval - Intervalle entre les points de données ('5m', '30m', '1d', '1wk', '1mo')
 * @returns {Promise<Object>} - Promesse contenant les données formatées
 */
async function getBrentHistoricalData(period = '1mo', interval = '1d') {
    try {
        // Construction de l'URL avec les paramètres
        const url = `${BASE_URL}${BRENT_SYMBOL}?region=US&interval=${interval}&range=${period}&includeAdjustedClose=true`;
        
        console.log(`Récupération des données depuis: ${url}`);
        
        // Exécution de la requête
        const response = await axios.get(url);
        
        // Vérification de la réponse
        if (!response.data || !response.data.chart || !response.data.chart.result || response.data.chart.result.length === 0) {
            throw new Error('Données invalides reçues de Yahoo Finance');
        }
        
        // Extraction des données pertinentes
        const result = response.data.chart.result[0];
        const timestamps = result.timestamp;
        const quote = result.indicators.quote[0];
        const adjClose = result.indicators.adjclose ? result.indicators.adjclose[0].adjclose : null;
        
        // Formatage des données pour l'utilisation dans l'application
        const formattedData = timestamps.map((timestamp, index) => {
            return {
                date: moment.unix(timestamp).format('YYYY-MM-DD'),
                timestamp: timestamp,
                open: quote.open[index],
                high: quote.high[index],
                low: quote.low[index],
                close: quote.close[index],
                volume: quote.volume[index],
                adjClose: adjClose ? adjClose[index] : quote.close[index]
            };
        });
        
        // Récupération des métadonnées
        const metadata = {
            currency: result.meta.currency,
            symbol: result.meta.symbol,
            exchangeName: result.meta.exchangeName,
            instrumentType: result.meta.instrumentType,
            regularMarketPrice: result.meta.regularMarketPrice,
            previousClose: result.meta.chartPreviousClose,
            regularMarketTime: result.meta.regularMarketTime
        };
        
        // Calcul de la variation par rapport à la clôture précédente
        const lastPrice = metadata.regularMarketPrice;
        const previousClose = metadata.previousClose;
        const change = lastPrice - previousClose;
        const changePercent = (change / previousClose) * 100;
        
        // Ajout des informations de variation aux métadonnées
        metadata.change = change;
        metadata.changePercent = changePercent;
        
        return {
            metadata: metadata,
            data: formattedData
        };
    } catch (error) {
        console.error('Erreur lors de la récupération des données du Brent:', error);
        throw error;
    }
}

/**
 * Récupère le prix actuel du Brent
 * @returns {Promise<Object>} - Promesse contenant le prix actuel et les métadonnées
 */
async function getCurrentBrentPrice() {
    try {
        // Récupération des données du jour
        const result = await getBrentHistoricalData('1d', '1d');
        
        // Extraction du prix actuel et des métadonnées
        const currentPrice = result.metadata.regularMarketPrice;
        const change = result.metadata.change;
        const changePercent = result.metadata.changePercent;
        
        return {
            price: currentPrice,
            change: change,
            changePercent: changePercent,
            currency: result.metadata.currency,
            timestamp: result.metadata.regularMarketTime
        };
    } catch (error) {
        console.error('Erreur lors de la récupération du prix actuel du Brent:', error);
        throw error;
    }
}

// Exportation des fonctions
module.exports = {
    getBrentHistoricalData,
    getCurrentBrentPrice
};
