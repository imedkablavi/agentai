from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from abc import ABC, abstractmethod

class Intent(BaseModel):
    intent_name: str
    confidence: float
    language: str  # ar | tr | en
    entities: Dict[str, Any] = {
        "application": None,
        "query": None,
        "url": None,
        "file": None
    }
    raw_text: str

class Skill(ABC):
    name: str
    description: str
    supported_intents: List[str]

    def __init__(self):
        pass

    @abstractmethod
    def can_handle(self, intent: Intent) -> bool:
        pass

    @abstractmethod
    def execute(self, intent: Intent) -> Dict[str, Any]:
        """
        Returns:
        {
          "status": "success | error",
          "message": "user-friendly text",
          "data": {}
        }
        """
        pass
