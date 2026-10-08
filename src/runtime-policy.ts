/** Explicit H5 adaptation authorized for round6: keep eligible combat calculation,
 * silence combat while a panel/eco mode obscures the world. UI feedback stays audible.
 * Source equivalence for panel/eco behavior remains pending native observation. */
export interface RuntimePolicyInput {
  transition: boolean; frozen: boolean; settings: boolean; panel: boolean;
  eco: boolean; popup: boolean;
}
export function runtimePolicy(i: RuntimePolicyInput) {
  const simulate = !i.transition && !i.frozen && !i.settings;
  const worldPresentation = !i.eco;
  return {
    simulate,
    input: simulate && !i.panel && !i.popup && !i.eco,
    combatAudio: simulate && !i.panel && !i.popup && !i.eco,
    worldPresentation,
    animateWorld: simulate && worldPresentation,
  };
}
