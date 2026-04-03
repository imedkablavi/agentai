from typing import Dict, Any

class ResponseLayer:
    def respond(self, result: Dict[str, Any]):
        # TODO: Implement TTS
        print(f"Response: {result.get('message', 'No response')}")
