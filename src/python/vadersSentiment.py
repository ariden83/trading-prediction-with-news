from deep_translator import GoogleTranslator
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import json
import spacy
import re
import nltk
nltk.download('punkt')
from nltk.tokenize import sent_tokenize

# Chargement modèle spaCy anglais
nlp = spacy.load("en_core_web_sm")

analyzer = SentimentIntensityAnalyzer()

# Définition mots-clés pétrole
oil_keywords = set([
    'brent', 'oil', 'crude', 'wti', 'petroleum', 'fuel', 'gasoline',
    'oil prices', 'brent crude', 'crude oil', 'oil market', 'oil production',
    'oil supply', 'oil demand', 'oil reserves', 'oil futures'
])

# Définition mots directionnels
up_keywords = {
    'rise', 'rises', 'rose', 'increase', 'increases', 'increased', 'up',
    'gain', 'gained', 'surge', 'surged', 'jump', 'jumped', 'soar', 'soared',
    'skyrocket', 'skyrocketed', 'spike', 'spiked', 'climb', 'climbed',
    'boost', 'boosted', 'rebound', 'rebounded'
}
down_keywords = {
    'fall', 'falls', 'fell', 'decrease', 'decreases', 'decreased', 'down',
    'drop', 'dropped', 'slip', 'slipped', 'plunge', 'plunged', 'tumble',
    'tumbled', 'sink', 'sank', 'plummet', 'plummeted', 'dive', 'dived',
    'crash', 'crashed', 'collapse', 'collapsed', 'slump', 'slumped'
}

def translate_to_english(text):
    return GoogleTranslator(source='auto', target='en').translate(text)

def extract_oil_related_sentences(text):
    sentences = sent_tokenize(text)
    return [s for s in sentences if any(k in s.lower() for k in oil_keywords)]

def detect_oil_price_direction(sentences):
    up_count = 0
    down_count = 0
    verb_hits = []

    for sentence in sentences:
        doc = nlp(sentence)
        for token in doc:
            # Recherche d’un sujet lié à un verbe
            if token.dep_ == "nsubj" and token.head.pos_ == "VERB":
                subject = token.text.lower()
                verb = token.head.lemma_.lower()
                if subject in oil_keywords:
                    if verb in up_keywords:
                        up_count += 1
                        verb_hits.append((subject, verb, "up"))
                    elif verb in down_keywords:
                        down_count += 1
                        verb_hits.append((subject, verb, "down"))

    # Définir la direction
    if up_count > down_count:
        direction = "positive"
        confidence = round(min(up_count / 5, 1.0) * 2 - 1, 2)
    elif down_count > up_count:
        direction = "negative"
        confidence = round(min(down_count / 5, 1.0) * -2 + 1, 2)
    else:
        direction = "neutral"
        confidence = 0.0

    return direction, confidence, verb_hits

def sentiment_to_direction(sentiment):
    compound = sentiment.get("compound", 0.0)
    if compound > 0.00:
        return 'positive'
    elif compound < -0.00:
        return 'negative'
    else:
        return 'neutral'

def handle_request(text):
    translated = translate_to_english(text)
    oil_sentences = extract_oil_related_sentences(translated)
    sentiment = analyzer.polarity_scores(translated)

    direction = None
    confidence = 0.0
    note = None
    verb_analysis = []

    if oil_sentences:
        direction, confidence, verb_analysis = detect_oil_price_direction(oil_sentences)
        if direction == "neutral":
            direction = sentiment_to_direction(sentiment)
            confidence = sentiment["compound"]
            note = "No directional verb found; fallback to sentiment"
        else:
            sentiment["compound"] = confidence
    else:
        direction = sentiment_to_direction(sentiment)
        confidence = sentiment["compound"]
        note = "No oil-related content detected"

    return json.dumps({
        "direction": direction,
        "confidence": round(confidence, 3),
        "analyzed_sentences": oil_sentences,
        "verbs_detected": verb_analysis,
        "sentiment": sentiment,
        "translated_text": translated,
        "note": note
    }, indent=2)

if __name__ == "__main__":
    import sys
    text = sys.argv[1]
    print(handle_request(text))
