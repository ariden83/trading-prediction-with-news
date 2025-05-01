/**
 * Serveur Express pour l'application de prévision du Brent
 * Ce serveur expose les API REST nécessaires et sert les fichiers statiques
 */

// Importation des modules
const express = require('express');
const cors = require('cors');
const path = require('path');
const appService = require('./src/app');

// Création de l'application Express
const app = express();
const port = process.env.PORT || 3001; // Utilisation du port 3001 au lieu de 3000

// Configuration des middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Route pour récupérer toutes les données en une fois
app.get('/api/all-data', async (req, res) => {
    try {
        const period = req.query.period || '1d';
        const data = await appService.getAllData(period);
        res.json(data);
    } catch (error) {
        console.error('Erreur lors de la récupération de toutes les données:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des données' });
    }
});

// Route pour récupérer les données historiques
app.get('/api/historical-data', async (req, res) => {
    try {
        const period = req.query.period || '1d';
        const data = await appService.getHistoricalData(period);
        res.json(data);
    } catch (error) {
        console.error('Erreur lors de la récupération des données historiques:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des données historiques' });
    }
});

// Route pour récupérer le prix actuel
app.get('/api/current-price', async (req, res) => {
    try {
        const price = await appService.getCurrentPrice();
        res.json(price);
    } catch (error) {
        console.error('Erreur lors de la récupération du prix actuel:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération du prix actuel' });
    }
});

// Route pour récupérer les actualités
app.get('/api/news', async (req, res) => {
    try {
        const news = await appService.getNews();
        res.json(news);
    } catch (error) {
        console.error('Erreur lors de la récupération des actualités:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des actualités' });
    }
});

// Route pour générer une prévision
app.post('/api/prediction', (req, res) => {
    try {
        const { historicalData, news } = req.body;
        
        // Vérification des données d'entrée
        if (!historicalData || !news || historicalData.length === 0 || news.length === 0) {
            return res.status(400).json({ error: 'Données insuffisantes pour générer une prévision' });
        }
        
        // Génération de la prévision
        const prediction = appService.generatePrediction(historicalData, news);
        res.json(prediction);
    } catch (error) {
        console.error('Erreur lors de la génération de la prévision:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la génération de la prévision' });
    }
});

// Route pour gérer toutes les autres requêtes (pour le SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Démarrage du serveur
app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
    console.log(`API disponible sur http://localhost:${port}/api`);
});
