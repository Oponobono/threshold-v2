export type ResolutionReason =
  | 'requested'
  | 'model_unavailable'
  | 'capability_mismatch'
  | 'runtime_incompatible';

export interface ResolvedModelState {
  /** 
   * The model ID requested explicitly by the user, or null if the mode is 'auto'. 
   */
  requestedModelId: string | null;
  /** 
   * The final model ID chosen for execution. 
   */
  resolvedModelId: string;
  /** 
   * True if the resolvedModelId differs from the explicitly requested one, 
   * or if an 'auto' decision had to fall back through lower tiers. 
   */
  wasFallback: boolean;
  /** 
   * The semantic reason for the final decision. 
   */
  reason: ResolutionReason;
}
