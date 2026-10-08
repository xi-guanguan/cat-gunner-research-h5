/** Only these explicit fixtures use the live Hunt bootstrap. Never infer from a
 * prefix: invalid QA remains isolated by the ordinary QA router. */
export const SOURCE_HUNT_LIVE_QA_ROUTES = ['hunt-live','hunt-live-victory','hunt-live-defeat','hunt-live-holes'] as const;
export function isSourceHuntLiveQARoute(route:string|null):route is typeof SOURCE_HUNT_LIVE_QA_ROUTES[number] {
 return route!==null&&(SOURCE_HUNT_LIVE_QA_ROUTES as readonly string[]).includes(route);
}
