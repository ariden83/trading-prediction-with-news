/**
 * Module pour générer des prévisions du cours du Brent
 * Ce module utilise les données historiques et l'analyse des actualités
 * pour prédire l'évolution du cours du Brent
 */

// Importation des dépendances
const moment = require('moment');

/**
 * Génère une prévision du cours du Brent pour la journée
 * 
 * @param {Array} historicalData - Données historiques du Brent
 * @param {Object} newsSentiment - Analyse du sentiment des actualités
 * @returns {Object} - Prévision du cours avec prix, variation et confiance
 */
function generateBrentPrediction(historicalData, newsSentiment) {
    try {
        console.log('Génération de la prévision du cours du Brent');
        
        // Vérification des données d'entrée
        if (!historicalData || historicalData.length < 5) {
            throw new Error('Données historiques insuffisantes pour générer une prévision');
        }
        
        // Récupération du dernier prix connu
        const lastDataPoint = historicalData[historicalData.length - 1];
        const lastPrice = lastDataPoint.close;
        
        // Calcul de la tendance technique (moyenne mobile sur 5 jours)
        const recentPrices = historicalData.slice(-5).map(item => item.close);
        const movingAverage = recentPrices.reduce((sum, price) => sum + price, 0) / recentPrices.length;
        
        // Calcul de la tendance (positive si le prix actuel est au-dessus de la moyenne mobile)
        const technicalTrend = lastPrice > movingAverage ? 0.01 : -0.01;
        
        // Calcul de la volatilité récente (écart-type des variations quotidiennes)
        const dailyChanges = [];
        for (let i = 1; i < recentPrices.length; i++) {
            dailyChanges.push((recentPrices[i] - recentPrices[i-1]) / recentPrices[i-1]);
        }
        
        const volatility = calculateStandardDeviation(dailyChanges);
        
        // Intégration du sentiment des actualités (impact de -1% à +1%)
        const sentimentImpact = newsSentiment.score * 0.01;
        
        // Calcul de la variation prévue (combinaison de la tendance technique et du sentiment)
        const predictedChange = technicalTrend + sentimentImpact;
        
        // Application de la variation au dernier prix connu
        const predictedPrice = lastPrice * (1 + predictedChange);
        
        // Calcul du niveau de confiance (basé sur la volatilité et la confiance du sentiment)
        // Plus la volatilité est élevée, moins la confiance est grande
        const volatilityConfidence = Math.max(0, 100 - (volatility * 1000));
        const confidence = Math.round((volatilityConfidence + newsSentiment.confidence) / 2);
        
        // Préparation des facteurs d'influence
        const factors = [
            {
                name: 'Tendance technique',
                description: lastPrice > movingAverage 
                    ? 'Prix au-dessus de la moyenne mobile sur 5 jours (tendance haussière)' 
                    : 'Prix en-dessous de la moyenne mobile sur 5 jours (tendance baissière)',
                impact: lastPrice > movingAverage ? 'positif' : 'négatif'
            },
            {
                name: 'Volatilité récente',
                description: `Volatilité de ${(volatility * 100).toFixed(2)}% sur les 5 derniers jours`,
                impact: volatility > 0.02 ? 'négatif' : 'neutre'
            }
        ];
        
        // Ajout des facteurs d'influence des actualités
        newsSentiment.factors.forEach(factor => {
            factors.push({
                name: 'Actualité',
                description: factor.title,
                source: factor.source,
                impact: factor.impact
            });
        });
        
        return {
            currentPrice: lastPrice,
            predictedPrice: predictedPrice,
            change: predictedPrice - lastPrice,
            changePercent: ((predictedPrice - lastPrice) / lastPrice) * 100,
            confidence: confidence,
            factors: factors,
            predictionDate: moment().format('YYYY-MM-DD'),
            scoreHistory: newsSentiment.scoreHistory,
        };
    } catch (error) {
        console.error('Erreur lors de la génération de la prévision:', error);
        throw error;
    }
}

/**
 * Calcule l'écart-type d'un ensemble de valeurs
 * 
 * @param {Array} values - Tableau de valeurs numériques
 * @returns {number} - Écart-type
 */
function calculateStandardDeviation(values) {
    // Calcul de la moyenne
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    
    // Calcul de la somme des carrés des écarts
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    const sumOfSquaredDifferences = squaredDifferences.reduce((sum, value) => sum + value, 0);
    
    // Calcul de l'écart-type
    return Math.sqrt(sumOfSquaredDifferences / values.length);
}

// Exportation des fonctions
module.exports = {
    generateBrentPrediction
};
