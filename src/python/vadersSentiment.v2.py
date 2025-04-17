from deep_translator import GoogleTranslator
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import spacy
from spacy.matcher import PhraseMatcher
import json
import re

nlp = spacy.load("en_core_web_sm")

oil_keywords = set([
    'brent', 'oil', 'crude', 'wti', 'petroleum', 'fuel', 'gasoline',
    'oil prices', 'brent crude', 'crude oil', 'oil market', 'oil production',
    'oil supply', 'oil demand', 'oil reserves', 'oil futures'
])

up_keywords = {
    'rise', 'rises', 'rose', 'increase', 'increases', 'increased', 'up', 'gains',
    'gain', 'gained', 'surge', 'surged', 'jump', 'jumped', 'soar', 'soared',
    'skyrocket', 'skyrocketed', 'spike', 'spiked', 'climb', 'climbed',
    'boost', 'boosted', 'rebound', 'rebounded', 'rises', 'rising', 'climb', 'jumps',
    'approaches one-month highs', 'approaches one-month high',
}
down_keywords = {'dives',
    'fall', 'falls', 'fell', 'decrease', 'decreases', 'decreased', 'down',
    'drop', 'dropped', 'slip', 'slipped', 'plunge', 'plunged', 'tumble',
    'tumbled', 'sink', 'sank', 'plummet', 'plummeted', 'dive', 'dived', 'approaches one-month low',
    'crash', 'crashed', 'collapse', 'collapsed', 'slump', 'slumped', 'settles down',
}


# Ensemble de ponctuations à prendre en compte comme délimiteurs
PUNCT = {",", ".", ";", ":", "!", "?"}

matcher = PhraseMatcher(nlp.vocab, attr="LOWER")
patterns = [nlp.make_doc(keyword) for keyword in oil_keywords]
matcher.add("OIL_TERMS", patterns)

analyzer = SentimentIntensityAnalyzer()
# sentiment_pipeline = pipeline("sentiment-analysis", model="cardiffnlp/twitter-roberta-base-sentiment")

def translate_to_english(text):
    return GoogleTranslator(source='auto', target='en').translate(text)

LABEL_MAPPING = {
    "LABEL_0": "negative",
    "LABEL_1": "neutral",
    "LABEL_2": "positive"
}

def analyze_sentiment(text):

    txt_translated = translate_to_english(text)
    txt_final = detect_svc_with_keywords(txt_translated)
    sentiment = analyzer.polarity_scores(txt_final)

    # hf_result = sentiment_pipeline(txt_translated)[0]  # ex: {'label': 'NEGATIVE', 'score': 0.998}

    # sentiment["huggingface_sentiment"] = {
    #    "label": LABEL_MAPPING.get(hf_result["label"], hf_result["label"]),
    #    "score": round(hf_result["score"], 4)
    #}

    if  sentiment["compound"] == 0.0:
        sentiment["direction"] = keyword_sentiment(txt_final)
        if sentiment["direction"] == "positive":
            sentiment["compound"] = 1
        elif sentiment["direction"] == "negative":
            sentiment["compound"] = -1

    sentiment["txt_original"] = text
    sentiment["txt_translated"] = txt_translated
    sentiment["txt_final"] = txt_final

    return sentiment

def handle_request(text):
    sentiment = analyze_sentiment(text)
    return json.dumps(sentiment)


def keyword_sentiment(text):
    # On transforme le texte en minuscules et on extrait les mots avec une regex
    words = re.findall(r'\b\w+\b', text.lower())

    # On compte les occurrences de chaque type de mot-clé
    up_count = sum(1 for word in words if word in up_keywords)
    down_count = sum(1 for word in words if word in down_keywords)

    if up_count > down_count:
        return "positive"
    elif down_count > up_count:
        return "negative"
    elif up_count == down_count and up_count > 0:
        return "mixed"
    else:
        return "neutral"


def detect_svc_with_keywords(text):
    doc = nlp(text)
    matches = matcher(doc)

    if matches:
        match_id, start, end = matches[0]
        span = doc[start:end]

        # On va chercher les bornes gauche et droite autour de la ponctuation
        left = start
        while left > 0 and doc[left - 1].text not in PUNCT:
            left -= 1

        right = end
        while right < len(doc) and doc[right].text not in PUNCT:
            right += 1

        # On crée un nouveau span basé sur ces limites
        result_span = doc[left:right]
        return result_span.text.strip()

    return text


if __name__ == "__main__":
    import sys
    text = sys.argv[1]
    print(handle_request(text))