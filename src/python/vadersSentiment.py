from deep_translator import GoogleTranslator
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import json

analyzer = SentimentIntensityAnalyzer()

def translate_to_english(text):
    return GoogleTranslator(source='auto', target='en').translate(text)

def analyze_sentiment(text):
    text_en = translate_to_english(text)
    return analyzer.polarity_scores(text_en)

def handle_request(text):
    sentiment = analyze_sentiment(text)
    return json.dumps(sentiment)

if __name__ == "__main__":
    import sys
    text = sys.argv[1]
    print(handle_request(text))
