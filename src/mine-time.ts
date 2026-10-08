/** H5 local-clock adapter. This is explicitly not Time_manager trusted-server parity. */
export interface MineTimeAdapter {
  today(): string;
  canRolloverDaily(category: 3, storedDate: string, today: string): boolean | null;
  evidence: string;
}
export function createLocalMineTime(now: () => Date = () => new Date()): MineTimeAdapter {
  return {
    today() {
      const date = now();
      return `h5-local:${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    },
    canRolloverDaily(_category, storedDate, today) {
      // A backwards device clock must not grant another set of tickets.
      return storedDate === "" || today > storedDate;
    },
    evidence: "H5 local calendar + monotonic stored-date guard; native trusted date/category3 ledger UNVERIFIED",
  };
}
export const localMineTime = createLocalMineTime();
