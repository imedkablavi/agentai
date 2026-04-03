from src.core.contracts import Intent, Skill
from typing import List, Optional

class SkillRouter:
    def __init__(self):
        self.skills: List[Skill] = []

    def register_skill(self, skill: Skill):
        self.skills.append(skill)

    def route(self, intent: Intent) -> Optional[Skill]:
        for skill in self.skills:
            if skill.can_handle(intent):
                return skill
        return None
