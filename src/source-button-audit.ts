import type {SourceUiNode} from './source-ui';
/** Preselect once per view; per-frame active checks must not scan the full tree. */
export function sourceViewButtonCandidates(nodes:readonly SourceUiNode[],selected:ReadonlyMap<string,unknown>):SourceUiNode[] {
 return nodes.filter(n=>selected.has(n.id)&&n.components.some(c=>c.kind==='Button'&&c.enabled!==false));
}
/** Selected-tree presence and serialized inactivity are not implementation
 * evidence. Inspect final runtime-active buttons; never swallow an omission. */
export function sourceUnboundActiveButtons(nodes:readonly SourceUiNode[],active:ReadonlySet<string>,bound:ReadonlySet<string>):string[] {
 return nodes.filter(n=>active.has(n.id)&&n.components.some(c=>c.kind==='Button'&&c.enabled!==false)&&!bound.has(n.id)).map(n=>n.path);
}
