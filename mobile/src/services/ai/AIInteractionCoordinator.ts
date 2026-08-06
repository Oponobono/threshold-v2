import { AIResponse } from './providers/AIProvider';
import { directiveRegistry } from './directives/DirectiveHandlerRegistry';
import { CreateDeckDirectiveHandler } from './directives/handlers/CreateDeckDirectiveHandler';

directiveRegistry.register(new CreateDeckDirectiveHandler());

class AIInteractionCoordinator {
  /**
   * Handles an AI response by processing any directives it contains.
   * Isolates the UI from the domain logic.
   */
  async handle(response: AIResponse, context: { subjectId?: number | string; userId?: number | string; contextText?: string }): Promise<void> {
    if (!response.directives || response.directives.length === 0) {
      return;
    }

    for (const directive of response.directives) {
      console.log(`[AIInteractionCoordinator] Dispatching directive of type: ${directive.type}`);
      // The context text can be passed via context, though the handler interface 
      // doesn't have it directly. We can cast or add it to the context.
      await directiveRegistry.handle(directive, context);
    }
  }
}

export const aiInteractionCoordinator = new AIInteractionCoordinator();
