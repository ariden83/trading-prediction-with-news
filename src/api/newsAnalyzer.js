/**
 * Module pour récupérer et analyser les actualités du Brent
 * Ce module utilise axios pour effectuer des requêtes HTTP vers les sources d'actualités
 */

// Importation des dépendances
const axios = require('axios');
const moment = require('moment');
const cheerio = require('cheerio');
const express = require('express');
const { exec } = require('child_process')
const xml2js = require('xml2js');
const tough = require('tough-cookie');
const { CookieJar } = require('tough-cookie');
const storage = require('node-persist');

// Initialisation du stockage persistant
(async () => {
    await storage.init({
        dir: './cache', // Répertoire où seront stockées les données
        stringify: JSON.stringify,
        parse: JSON.parse,
        encoding: 'utf8',
        ttl: 2 * 60 * 60 * 1000 // 2 heures (en millisecondes)
    });
})();

// Configuration des sources d'actualités
const NEWS_SOURCES = [
    {
        name: 'prixdubaril.com',
        url: 'https://prixdubaril.com/news-petrole.feed?type=atom',
        type: 'atom',
        entriesPath: 'feed.entry',
        titlePath: 'title',
        linkPath: 'link.$.href',
        datePath: 'published'
    },
    /*{
        name: 'Investing.com – Commodities (Oil)',
        url: 'https://www.investing.com/rss/news_301.rss',
        selector: '.newsItem', // Sélecteur CSS fictif pour l'exemple
        titleSelector: '.title',
        dateSelector: '.date'
    },
    {
        name: 'OilPrice.com – Brent Crude',
        url: 'https://oilprice.com/rss/main',
        selector: '.news-item', // Sélecteur CSS fictif pour l'exemple
        titleSelector: '.title',
        dateSelector: '.date'
    },*/
    {
        name: 'Reuters – Commodities / Energy',
        url: 'https://news.google.com/rss/search?q=Reuters+brent&when:24h+allinurl:reuters.com&hl=en-US&gl=US&ceid=US:en',
        type: 'rss',
        entriesPath: 'rss.channel.item',
        titlePath: 'title',
        linkPath: 'link',
        datePath: 'pubDate'
    },
    {
        name: 'Bloomberg – Energy News',
        url: 'https://news.google.com/rss/search?q=bloomberg+brent&when:24h+allinurl:bloomberg.com&hl=en-US&gl=US&ceid=US:en',
        type: 'rss',
        entriesPath: 'rss.channel.item',
        titlePath: 'title',
        linkPath: 'link',
        datePath: 'pubDate'
    }/*,
    {
        name: 'U.S. Energy Information Administration (EIA)',
        url: 'https://news.google.com/rss/search?q=eia.com+brent&when:24h+allinurl:eia.gov&hl=en-US&gl=US&ceid=US:en',
        type: 'rss',
        entriesPath: 'rss.channel.item',
        titlePath: 'title',
        linkPath: 'link',
        datePath: 'pubDate'
    },*/
];

const jar = new CookieJar();

async function fetchWithManualRedirects(url, retries = 3, delay = 100) {
    let cookieHeader = ''; // Initialisation du cookie header

    for (let i = 0; i < retries; i++) {
        try {
            console.log('Récupération des données depuis:', url);

            // Configuration des headers pour simuler un navigateur
            let headers = {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
                'priority': 'u=0, i',
                'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Linux"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'none',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
                'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
            };

            // Si des cookies ont été récupérés précédemment, on les ajoute aux headers
            if (cookieHeader) {
                headers['Cookie'] = cookieHeader;
            }

            // Faire la requête avec axios
            const response = await axios.get(url, {
                headers,
                maxRedirects: 0, // Limite de redirections
                validateStatus: status => status >= 200 && status < 400, // Accepter tous les codes de statut entre 200 et 399
            });

            // Récupérer les cookies s'il y en a dans la réponse
            const setCookie = response.headers['set-cookie'];
            if (setCookie) {
                setCookie.forEach(c => jar.setCookieSync(c, url)); // Sauvegarder les cookies dans le CookieJar
                cookieHeader = jar.getCookieStringSync(url); // Récupérer la chaîne de cookies
            }

            // Gérer la redirection si un code de statut 3xx est renvoyé
            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.location;
                console.warn(`Redirection (${response.status}) détectée depuis ${url}`);
                if (location) {
                    console.warn(`URL de redirection: ${location}`);
                }
                // Suivre la redirection
                url = location; // Mettre à jour l'URL avec la nouvelle destination
            } else {
                return response; // Si pas de redirection, retourner la réponse
            }

        } catch (err) {
            console.error(`Erreur lors de la récupération (${i + 1}/${retries}): ${err.message}`);
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay)); // Attendre avant de réessayer
            } else {
                throw err; // Si toutes les tentatives échouent, lancer l'erreur
            }
        }
    }
}


const cache = new Map(); // Map<url, { data: any, expires: number }>
const CACHE_DURATION_MS = 1 * 60 * 60 * 1000; // 60 minutes * 2h

async function getBrentNews() {
    const parser = new xml2js.Parser({ explicitArray: false });
    let allNews = [];
    const cacheVersion = "v1.0.0"

    for (const source of NEWS_SOURCES) {
        try {
            const now = Date.now();
            const cached = await storage.getItem(encodeURIComponent(cacheVersion+source.url));

            let entries;
            let allNewsFromURL = [];

            if (cached && cached.expires > now) {
                console.log('utilisation du cache pour', source.name);
                allNewsFromURL = cached.data;

            } else {
                // Fetch + parse
                const response = await fetchWithManualRedirects(source.url);
                const parsed = await parser.parseStringPromise(response.data);

                entries = getNested(parsed, source.entriesPath);

                const items = Array.isArray(entries) ? entries : [entries];

                for (const item of items) {
                    const title = getNested(item, source.titlePath);
                    const date = getNested(item, source.datePath);
                    const link = getNested(item, source.linkPath);

                    let sentimentsItem = await getSentimentFromPython(title);
                    let sentiment = 'neutre';
                    if (sentimentsItem.compound > 0) {
                        sentiment = 'positive'
                    } else if (sentimentsItem.compound < 0) {
                        sentiment = 'negative'
                    }

                    const formattedDate = date
                        ? moment(date).format('YYYY-MM-DD')
                        : null;

                    const timestamp = date
                        ? moment(date).valueOf()
                        : null;

                    if (title && formattedDate) {
                        allNewsFromURL.push({
                            title,
                            date: formattedDate,
                            timestamp: timestamp,
                            url: link,
                            source: source.name,
                            sentiment: sentiment,
                            sentiments: sentimentsItem,
                        });
                    }
                }

                storage.setItem(encodeURIComponent(cacheVersion+source.url), {
                    data: allNewsFromURL,
                    expires: now + CACHE_DURATION_MS
                });
            }

            allNews.push(...allNewsFromURL);
        } catch (err) {
            console.error(`Erreur avec ${source.name} : ${err.message}`);
        }
    }

    console.log('Nombre total d\'actualités:', allNews.length);
    saveNewsToFile(allNews);
    return allNews;
}

function saveNewsToFile(allNews) {
    console.log('Nombre total d\'actualités:', allNews.length);

    const fs = require('fs');
    const path = require('path');
    const today = moment().format('YYYY-MM-DD');
    const seedsDir = path.join(__dirname, '../seeds');

    if (!fs.existsSync(seedsDir)) {
        fs.mkdirSync(seedsDir, { recursive: true });
    }

    const filename = path.join(seedsDir, `brent-news-${today}.json`);

    if (fs.existsSync(filename)) {
        console.log(`Le fichier ${filename} existe déjà. Mise à jour des données...`);
    }

    fs.writeFileSync(filename, JSON.stringify(allNews, null, 2), 'utf8');
    console.log(`Données sauvegardées dans: ${filename}`);
}

function getNested(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

/**
 * Analyse le sentiment des actualités pour déterminer l'impact sur le prix du Brent
 *
 * @param {Array} news - Liste des actualités avec leur sentiment
 * @returns {Object} - Résultat de l'analyse avec score et facteurs d'influence
 */
function analyzeNewsSentiment(news) {
    let sentimentScore = 0;
    const factors = [];
    const history = {};

    // Regrouper les news par jour (format YYYY-MM-DD)
    const newsByDay = {};

    news.forEach(item => {
        const dateKey = moment(item.date).format('YYYY-MM-DD');
        if (!newsByDay[dateKey]) {
            newsByDay[dateKey] = [];
        }
        newsByDay[dateKey].push(item);
    });

    // Calculer l'historique jour par jour
    for (const [date, dailyNews] of Object.entries(newsByDay)) {
        let dailyScore = 0;

        dailyNews.forEach(item => {
            if (item.sentiment === 'positive' || item.sentiment === 'negative') {
                dailyScore += item.sentiments.compound;
            }
        });

        history[date] = dailyScore;
    }

    // Calculer score et facteurs uniquement pour aujourd’hui
    const todayKey = moment().format('YYYY-MM-DD');
    const todayNews = newsByDay[todayKey] || [];

    todayNews.forEach(item => {
        const daysOld = moment().diff(moment(item.date), 'days');
        const recencyWeight = Math.max(0, 1 - (daysOld * 0.2));

        if (item.sentiment === 'positive') {
            sentimentScore += item.sentiments.compound;
            if (recencyWeight > 0.5) {
                factors.push({
                    title: item.title,
                    impact: 'positif',
                    source: item.source
                });
            }
        } else if (item.sentiment === 'negative') {
            sentimentScore += item.sentiments.compound;
            if (recencyWeight > 0.5) {
                factors.push({
                    title: item.title,
                    impact: 'négatif',
                    source: item.source
                });
            }
        }
    });

    return {
        score: sentimentScore,
        factors: factors,
        confidence: Math.min(100, 50 + (todayNews.length * 10)),
        scoreHistory: history
    };
}


function getSentimentFromPython(text) {
    return new Promise((resolve, reject) => {
        // Utilisation de child_process.exec pour exécuter le script Python
        exec(`python3 ./src/python/vadersSentiment.v2.py "${text}"`, (error, stdout, stderr) => {
            if (error) {
                return reject(`Error executing Python script: ${stderr}`);
            }

            try {
                const sentiment = JSON.parse(stdout); // Parse la sortie du script Python en JSON
                resolve(sentiment);  // Retourne les résultats au format JSON
            } catch (e) {
                reject('Error parsing sentiment response');
            }
        });
    });
}

// Exportation des fonctions
module.exports = {
    getBrentNews,
    analyzeNewsSentiment
};
