/** Platform boundary for settings. The supplied adapter performs local development tests only. */
import type { LocalPlatformState } from "./local-platform";

export type R5PlatformAction = "google-login" | "cloud-save" | "cloud-load" | "redeem" | "support" | "restore-purchases";
export type R5PlatformStatus = "success" | "failure" | "cancelled" | "unavailable" | "confirmation" | "duplicate";
export interface R5CloudSnapshot { encodedSession: string; maxStage: number; savedAt: string }
export interface R5PlatformRequest {
  action: R5PlatformAction;
  requestId: string;
  confirmed?: boolean;
  snapshot?: { encodedSession: string; maxStage: number };
  code?: string;
  supportBody?: string;
  signal?: AbortSignal;
}
export interface R5DevelopmentReceipt {
  schema: 1;
  id: string;
  requestId: string;
  action: R5PlatformAction;
  status: Exclude<R5PlatformStatus, "confirmation" | "duplicate" | "unavailable">;
  scope: "local-development";
  provider: "r5-local-development";
  platformVerified: false;
  at: string;
}
export interface R5VerifiedPlatformReceipt {
  schema: 1;
  id: string;
  requestId: string;
  action: R5PlatformAction;
  scope: "platform";
  provider: string;
  platformVerified: true;
  reference: string;
  at: string;
}
export interface R5PlatformResult {
  action: R5PlatformAction;
  requestId: string;
  status: R5PlatformStatus;
  scope: "unavailable" | "local-development" | "platform";
  message: string;
  receipt: R5DevelopmentReceipt | R5VerifiedPlatformReceipt | null;
  /** A local identity is never a Google identity. */
  identity?: { id: string; provider: "local-development" | "google" | "apple" };
  preview?: { maxStage: number; savedAt: string };
  /** Caller must validate this with its normal save decoder before replacing the session. */
  snapshot?: R5CloudSnapshot;
  /** Local code acceptance is a UI test; this adapter never grants wallet rewards. */
  redeemedCode?: string;
  supportDraft?: string;
  restoredTestPurchases?: { id: string; amount: number; at: string }[];
}
export interface R5PlatformProvider {
  readonly id: string;
  readonly scope: R5PlatformResult["scope"];
  execute(request: R5PlatformRequest): Promise<R5PlatformResult>;
  isSignedIn(): boolean;
}
export interface R5PlatformStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface DevelopmentState {
  schema: 1;
  scope: "local-development";
  signedIn: boolean;
  sequence: number;
  cloud: R5CloudSnapshot | null;
  redeemed: string[];
  receipts: R5DevelopmentReceipt[];
}
export const R5_DEVELOPMENT_STORAGE_KEY = "catgunner-r5-platform-development-v1";
const actions: R5PlatformAction[] = ["google-login", "cloud-save", "cloud-load", "redeem", "support", "restore-purchases"];
const terminalStatuses = ["success", "failure", "cancelled"];
const emptyState = (): DevelopmentState => ({schema:1,scope:"local-development",signedIn:false,sequence:0,cloud:null,redeemed:[],receipts:[]});
const validSnapshot = (x: unknown): x is R5CloudSnapshot => {
  if (!x || typeof x !== "object") return false;
  const s = x as R5CloudSnapshot;
  return typeof s.encodedSession === "string" && s.encodedSession.length > 0 && Number.isSafeInteger(s.maxStage) && s.maxStage >= 1
    && typeof s.savedAt === "string" && Number.isFinite(Date.parse(s.savedAt));
};
function decodeState(text: string | null): DevelopmentState {
  if (!text) return emptyState();
  try {
    const x = JSON.parse(text) as DevelopmentState;
    if (x.schema !== 1 || x.scope !== "local-development" || typeof x.signedIn !== "boolean" || !Number.isSafeInteger(x.sequence) || x.sequence < 0
      || (x.cloud !== null && !validSnapshot(x.cloud)) || !Array.isArray(x.redeemed) || !x.redeemed.every(c => typeof c === "string")
      || !Array.isArray(x.receipts) || !x.receipts.every(r => r && r.schema === 1 && r.scope === "local-development" && r.provider === "r5-local-development"
        && r.platformVerified === false && typeof r.id === "string" && typeof r.requestId === "string" && actions.includes(r.action)
        && terminalStatuses.includes(r.status) && typeof r.at === "string" && Number.isFinite(Date.parse(r.at)))) return emptyState();
    return x;
  } catch { return emptyState(); }
}
const unavailableMessages: Record<R5PlatformAction, string> = {
  "google-login":"Google 登录服务未接入，当前未登录",
  "cloud-save":"云存档服务未接入，本地存档仍由游戏保存",
  "cloud-load":"云存档服务未接入，无法读取云端存档",
  redeem:"兑换码服务未接入，未发放奖励",
  support:"客服服务未接入，未发送邮件或消息",
  "restore-purchases":"商店恢复购买服务未接入，未恢复任何购买",
};
const result = (r: R5PlatformRequest, status: R5PlatformStatus, scope: R5PlatformResult["scope"], message: string,
  extra: Partial<R5PlatformResult> = {}): R5PlatformResult => ({action:r.action,requestId:r.requestId,status,scope,message,receipt:null,...extra});
export function createUnavailableR5PlatformProvider(): R5PlatformProvider {
  return {id:"unavailable",scope:"unavailable",isSignedIn:()=>false,async execute(r) {
    return result(r, r.signal?.aborted ? "cancelled" : "unavailable", "unavailable", r.signal?.aborted ? "已取消" : unavailableMessages[r.action]);
  }};
}
export interface R5DevelopmentProviderOptions {
  /** Reuse the existing developer switch. It is checked for every request, including after awaits. */
  getLocalState(): LocalPlatformState;
  storage: R5PlatformStorage;
  now?: () => Date;
  /** Explicit local code fixtures, never copied from or accepted by a live server. */
  testCodes?: readonly string[];
  /** Deterministic local test outcome; can be asynchronous to exercise loading and cancellation. */
  beforeExecute?: (request: R5PlatformRequest) => Promise<"success" | "failure" | "cancelled">;
}
export function createLocalDevelopmentR5PlatformProvider(options: R5DevelopmentProviderOptions): R5PlatformProvider {
  let state: DevelopmentState;
  let storageError = false;
  try { state = decodeState(options.storage.getItem(R5_DEVELOPMENT_STORAGE_KEY)); }
  catch { state = emptyState(); storageError = true; }
  const now = options.now ?? (() => new Date());
  const codes = new Set(options.testCodes ?? ["R5-LOCAL-UI-TEST"]);
  // Serialize requests so duplicate ids and code acceptance remain atomic within one provider instance.
  let queue: Promise<unknown> = Promise.resolve();
  const enabled = () => options.getLocalState().developerEnabled;
  async function run(r: R5PlatformRequest): Promise<R5PlatformResult> {
    if (!enabled()) return result(r,"unavailable","unavailable",unavailableMessages[r.action]);
    if (!r.requestId.trim()) return result(r,"failure","local-development","本地测试：请求编号不能为空");
    if (storageError) return result(r,"failure","local-development","本地测试：回执存储不可用");
    if (!actions.includes(r.action)) return result(r,"failure","local-development","本地测试：未知平台操作");
    const previous = state.receipts.find(x => x.requestId === r.requestId && x.action === r.action);
    if (previous) return result(r,"duplicate","local-development","本地测试：该请求已完成，未重复执行",{receipt:{...previous}});
    function finish(status: R5DevelopmentReceipt["status"], message: string, patch: Partial<DevelopmentState> = {}, extra: Partial<R5PlatformResult> = {}) {
      const receipt: R5DevelopmentReceipt = {schema:1,id:`r5-local:${state.sequence + 1}`,requestId:r.requestId,action:r.action,status,
        scope:"local-development",provider:"r5-local-development",platformVerified:false,at:now().toISOString()};
      const next: DevelopmentState = {...state,...patch,sequence:state.sequence+1,receipts:[...state.receipts,receipt]};
      try { options.storage.setItem(R5_DEVELOPMENT_STORAGE_KEY,JSON.stringify(next)); }
      catch { return result(r,"failure","local-development","本地测试：回执写入失败，未应用操作"); }
      state = next;
      return result(r,status,"local-development",message,{...extra,receipt:{...receipt}});
    }
    if (r.signal?.aborted) return finish("cancelled","本地测试：已取消");
    let outcome: "success" | "failure" | "cancelled";
    try { outcome = options.beforeExecute ? await options.beforeExecute(r) : "success"; }
    catch { outcome = "failure"; }
    if (!enabled()) return result(r,"unavailable","unavailable",unavailableMessages[r.action]);
    if (r.signal?.aborted || outcome === "cancelled") return finish("cancelled","本地测试：已取消");
    if (outcome !== "success") return finish("failure","本地测试：操作失败");
    if (r.action === "google-login") return finish("success","本地测试身份已启用（未登录 Google）",{signedIn:true},
      {identity:{id:"local-development-user",provider:"local-development"}});
    if ((r.action === "cloud-save" || r.action === "cloud-load") && !state.signedIn)
      return finish("failure","本地测试：请先启用本地测试身份");
    if (r.action === "cloud-save") {
      const snapshot = r.snapshot && {...r.snapshot,savedAt:now().toISOString()};
      if (!validSnapshot(snapshot)) return finish("failure","本地测试：存档或关卡信息无效");
      if (!r.confirmed && state.cloud && state.cloud.maxStage > snapshot.maxStage) return result(r,"confirmation","local-development","本地测试：确认用较低进度替换本机测试存档槽",
        {preview:state.cloud ? {maxStage:state.cloud.maxStage,savedAt:state.cloud.savedAt} : {maxStage:snapshot.maxStage,savedAt:snapshot.savedAt}});
      return finish("success","本地测试存档槽已保存（未上传云端）",{cloud:{...snapshot}},{preview:{maxStage:snapshot.maxStage,savedAt:snapshot.savedAt}});
    }
    if (r.action === "cloud-load") {
      if (!state.cloud) return finish("failure","本地测试：测试存档槽为空");
      const preview = {maxStage:state.cloud.maxStage,savedAt:state.cloud.savedAt};
      if (!r.confirmed) return result(r,"confirmation","local-development","本地测试：确认读取本机测试存档槽",{preview});
      return finish("success","本地测试存档已读取（未读取云端）",{}, {preview,snapshot:{...state.cloud}});
    }
    if (r.action === "redeem") {
      const code = r.code?.trim() ?? "";
      if (!codes.has(code)) return finish("failure","本地测试：测试兑换码无效");
      if (state.redeemed.includes(code)) return finish("failure","本地测试：测试兑换码已使用");
      return finish("success","本地测试兑换码已接受，仅验证界面，不发放奖励",{redeemed:[...state.redeemed,code]},{redeemedCode:code});
    }
    if (r.action === "support") return finish("success","本地测试客服草稿已生成（未发送）",{}, {supportDraft:r.supportBody ?? ""});
    const purchases = options.getLocalState().audit.filter(x => x && x.kind === "purchase" && typeof x.id === "string"
      && Number.isSafeInteger(x.amount) && x.amount >= 0 && typeof x.at === "string").map(({id,amount,at}) => ({id,amount,at}));
    return finish("success",`本地测试：找到 ${purchases.length} 条测试购买记录，未恢复商店权益`,{}, {restoredTestPurchases:purchases});
  }
  return {id:"r5-local-development",scope:"local-development",isSignedIn:()=>enabled() && state.signedIn,execute(r) {
    // Capture mutable request payload before queueing; cancellation signal remains live.
    const captured = {...r,snapshot:r.snapshot ? {...r.snapshot} : undefined};
    const next = queue.then(() => run(captured));
    queue = next.catch(() => undefined);
    return next;
  }};
}
