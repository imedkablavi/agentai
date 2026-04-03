from src.core.contracts import Skill, Intent
from typing import Dict, Any

class SkillExecutionLayer:
    def execute(self, skill: Skill, intent: Intent) -> Dict[str, Any]:
        # TODO: Add safety checks here
        return skill.execute(intent)
