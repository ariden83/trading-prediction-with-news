#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// === CONFIGURATION ===
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, `launcher-${new Date().toISOString().split('T')[0]}.log`);
const PID_FILE = path.join(__dirname, 'current_process.pid');

// Créer dossier de logs s'il n'existe pas
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

function log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, logEntry);
    console.error(logEntry);
}

// === GESTION DES MESSAGES NATIFS ===
let buffer = Buffer.alloc(0);
let currentProcess = null;

// Fonction d'envoi vers stdout avec header Native Messaging
function sendNativeMessage(messageObject) {
    const messageString = JSON.stringify(messageObject);
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32LE(Buffer.byteLength(messageString, 'utf8'), 0);
    process.stdout.write(lengthBuffer);
    process.stdout.write(messageString);
}

// Lecture du flux entrant
process.stdin.on('readable', () => {
    let chunk;
    while ((chunk = process.stdin.read()) !== null) {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 4) {
            const messageLength = buffer.readUInt32LE(0);
            if (buffer.length >= 4 + messageLength) {
                const messageContent = buffer.slice(4, 4 + messageLength).toString('utf8');
                buffer = buffer.slice(4 + messageLength);  // enlever le message traité

                handleMessage(messageContent);
            } else {
                break;  // attendre plus de données
            }
        }
    }
});

function handleMessage(messageContent) {
    try {
        log(`Message reçu: ${messageContent}`);
        const message = JSON.parse(messageContent);

        if (message.command === 'start' && message.projectPath) {
            log(`Commande START reçue, chemin: ${message.projectPath}`);

            if (currentProcess) {
                log('Un processus est déjà en cours, tentative d\'arrêt avant redémarrage.');
                stopCurrentProcess(() => startNewProcess(message.projectPath));
            } else {
                startNewProcess(message.projectPath);
            }
        }
        else if (message.command === 'close') {
            log('Commande CLOSE reçue');
            stopCurrentProcess(() => {
                sendNativeMessage({ success: true, message: 'Processus arrêté' });
            });
        }
        else {
            log('Commande inconnue');
            sendNativeMessage({ success: false, error: 'Commande inconnue' });
        }

    } catch (error) {
        log(`Erreur lors du traitement du message: ${error.message}`);
        sendNativeMessage({ success: false, error: 'Erreur lors du traitement du message' });
    }
}

function startNewProcess(projectPath) {
    currentProcess = exec('npm run start', { cwd: projectPath }, (error, stdout, stderr) => {
        if (error) {
            log(`Erreur d'exécution: ${error.message}`);
            log(`Stderr: ${stderr}`);
            sendNativeMessage({ success: false, error: stderr });
        } else {
            log(`Exécution réussie, sortie: ${stdout.substring(0, 200)}...`);
            sendNativeMessage({ success: true, output: stdout });
        }
        currentProcess = null;  // Réinitialiser après la fin
    });

    if (currentProcess.pid) {
        fs.writeFileSync(PID_FILE, currentProcess.pid.toString());
        log(`Processus lancé avec PID ${currentProcess.pid}`);
    }
}

function stopCurrentProcess(callback) {
    if (!currentProcess) {
        log('Aucun processus à arrêter');
        callback();
        return;
    }

    log('Tentative d\'arrêt du processus');
    if (process.platform === 'win32') {
        exec(`taskkill /pid ${currentProcess.pid} /T /F`, (error) => {
            if (error) {
                log(`Erreur lors de l'arrêt: ${error.message}`);
            } else {
                log('Processus arrêté avec succès');
            }
            currentProcess = null;
            callback();
        });
    } else {
        try {
            currentProcess.kill('SIGTERM');
            log('Processus arrêté avec succès');
        } catch (error) {
            log(`Erreur lors de l\'arrêt: ${error.message}`);
        }
        currentProcess = null;
        callback();
    }
}

process.on('uncaughtException', (error) => {
    log(`Exception non capturée: ${error.message}\n${error.stack}`);
});

log(`starting launcher...`);
