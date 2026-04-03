import sys
from src.core.config import Config
from src.layers.input_layer import InputLayer
from src.layers.intent_layer import IntentAnalysisLayer
from src.layers.skill_router import SkillRouter
from src.layers.execution_layer import SkillExecutionLayer
from src.layers.response_layer import ResponseLayer

def main():
    print("AI Assistant Starting...")
    
    # Initialize Layers
    config = Config()
    input_layer = InputLayer()
    intent_layer = IntentAnalysisLayer()
    router = SkillRouter()
    executor = SkillExecutionLayer()
    response_layer = ResponseLayer()
    
    # Register Skills (TODO)
    # router.register_skill(WindowsSkill())
    # router.register_skill(BrowserSkill())

    print("System Ready.")

    while True:
        try:
            # 1. Input
            user_input = input_layer.listen()
            if not user_input:
                continue
                
            # 2. Intent Analysis
            intent = intent_layer.analyze(user_input)
            
            # 3. Routing
            skill = router.route(intent)
            if not skill:
                print("No matching skill found.")
                continue
                
            # 4. Execution
            result = executor.execute(skill, intent)
            
            # 5. Response
            response_layer.respond(result)
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    main()
