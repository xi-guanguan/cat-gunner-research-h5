/** Exact same-build allowlist, isolated before ordinary save bootstrap. */
export const SOURCE_RAID_LIVE_QA_ROUTES=['raid-live-mission-empty','raid-live-mission-clear','raid-live-mission-owned','raid-live-helper-unowned','raid-live-helper-owned','raid-live-helper-expired','raid-live-helper-holes', 'raid-live','raid-live-holes','raid-live-ad','raid-live-purchase','raid-live-star-pig-empty','raid-live-star-pig-full','raid-live-star-pig-lv2','raid-live-star-pig-lv3','raid-live-star-pig-soldout'] as const;
export function isSourceRaidLiveQARoute(route:string|null):route is typeof SOURCE_RAID_LIVE_QA_ROUTES[number]{
 return route!==null&&(SOURCE_RAID_LIVE_QA_ROUTES as readonly string[]).includes(route);
}
