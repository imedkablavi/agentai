from src.core.contracts import Intent

class IntentAnalysisLayer:
    def analyze(self, text: str) -> Intent:
        # TODO: Implement LLM integration
        # For now, return a dummy intent
        return Intent(
            intent_name="unknown",
            confidence=0.0,
            language="en",
            raw_text=text
        )
