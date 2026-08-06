import { AIDirective } from '../providers/AIProvider';

/**
 * Interface that all directive handlers must implement.
 */
export interface DirectiveHandler {
  /**
   * Returns true if this handler can process the given directive.
   */
  canHandle(directive: AIDirective): boolean;

  /**
   * Executes the side effects associated with the directive.
   * Receives context containing subjectId and userId if available.
   */
  handle(directive: AIDirective, context: { subjectId?: number | string; userId?: number | string; contextText?: string }): Promise<void>;
}

class DirectiveHandlerRegistry {
  private handlers: DirectiveHandler[] = [];

  /**
   * Registers a new handler.
   */
  register(handler: DirectiveHandler) {
    this.handlers.push(handler);
  }

  /**
   * Attempts to handle a directive using the first capable registered handler.
   */
  async handle(directive: AIDirective, context: { subjectId?: number | string; userId?: number | string; contextText?: string }): Promise<void> {
    for (const handler of this.handlers) {
      if (handler.canHandle(directive)) {
        try {
          await handler.handle(directive, context);
        } catch (error) {
          console.error(`[DirectiveHandlerRegistry] Error handling directive of type ${directive.type}:`, error);
        }
        return; // Handled by first matching handler
      }
    }
    console.warn(`[DirectiveHandlerRegistry] No handler registered for directive type: ${directive.type}`);
  }
}

export const directiveRegistry = new DirectiveHandlerRegistry();
