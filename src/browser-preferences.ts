import sourceAudioContract from "./data/source-audio.json";

/** Browser adapter for source Setting BGM/SFX/Vibration mute buttons.
 * Source native booleans mean muted; browser preference booleans mean enabled.
 * Evidence: artifacts/evidence/round2-20260930/ui-source-contract.json settings.
 */
export interface BrowserPreferences {
  music: boolean;
  sound: boolean;
  vibration: boolean;
}
export const BROWSER_PREFERENCES_STORAGE_KEY = 'catgunner.browser.preferences.v1';
// H5 defaults; serialized native initial preferences have not been established.
export const DEFAULT_BROWSER_PREFERENCES: Readonly<BrowserPreferences> = Object.freeze({
  music: true, sound: true, vibration: true
});

function normalizePreferences(value: unknown): BrowserPreferences {
  const candidate = value && typeof value === 'object' ? value as Partial<BrowserPreferences> : {};
  return {
    music: typeof candidate.music === 'boolean' ? candidate.music : DEFAULT_BROWSER_PREFERENCES.music,
    sound: typeof candidate.sound === 'boolean' ? candidate.sound : DEFAULT_BROWSER_PREFERENCES.sound,
    vibration: typeof candidate.vibration === 'boolean' ? candidate.vibration : DEFAULT_BROWSER_PREFERENCES.vibration
  };
}
export interface BrowserPreferenceStorage {getItem(key:string):string|null;setItem(key:string,value:string):void;}
export function loadBrowserPreferences(storage:BrowserPreferenceStorage|undefined=globalThis.localStorage): BrowserPreferences {
  try {
    const stored = storage?.getItem(BROWSER_PREFERENCES_STORAGE_KEY);
    return normalizePreferences(stored ? JSON.parse(stored) : undefined);
  } catch { return { ...DEFAULT_BROWSER_PREFERENCES }; }
}
/** False means persistence is unavailable; the current session preference still works. */
export function saveBrowserPreferences(preferences: BrowserPreferences,storage:BrowserPreferenceStorage|undefined=globalThis.localStorage): boolean {
  try {
    if (!storage) return false;
    storage.setItem(BROWSER_PREFERENCES_STORAGE_KEY, JSON.stringify(normalizePreferences(preferences)));
    return true;
  } catch { return false; }
}

export interface BrowserSourceAudioClip {
  /** URL of an exported original AudioClip, never a generated substitute. */
  url: string;
  sourcePathID: number;
  volume?: number;
  pitch?: number;
  sfxType?: number;
}
export interface BrowserSourceAudio {
  music?: BrowserSourceAudioClip;
  shot?: BrowserSourceAudioClip;
  ui?: BrowserSourceAudioClip;
  reward?: BrowserSourceAudioClip;
  upgrade?: BrowserSourceAudioClip;
  fusion?: BrowserSourceAudioClip;
  win?: BrowserSourceAudioClip;
  fail?: BrowserSourceAudioClip;
  enter?: BrowserSourceAudioClip;
  contentsMusic?: BrowserSourceAudioClip;
}
/** Original decoded clips and caller integer arguments, verified in round4 audio evidence. */
function sourceSfx(name: keyof typeof sourceAudioContract.recommendedConsumers): BrowserSourceAudioClip {
  const binding = sourceAudioContract.recommendedConsumers[name];
  const entry = sourceAudioContract.sfxEntries.find(value => value.sfxType === binding.sfxType)!;
  return { url: entry.url, sourcePathID: binding.clipPathID, volume: binding.volume,
    pitch: binding.pitch, sfxType: binding.sfxType };
}
export const BROWSER_SOURCE_AUDIO: Readonly<BrowserSourceAudio> = Object.freeze({
  music: { ...sourceAudioContract.bgm.main, sourcePathID: sourceAudioContract.bgm.main.clipPathID },
  contentsMusic: { ...sourceAudioContract.bgm.contents, sourcePathID: sourceAudioContract.bgm.contents.clipPathID },
  shot: sourceSfx('shot'), ui: sourceSfx('uiButton'), reward: sourceSfx('reward'),
  upgrade: sourceSfx('upgrade'), fusion: sourceSfx('fusion'), win: sourceSfx('win'),
  fail: sourceSfx('fail'), enter: sourceSfx('enter')
});

export function createBrowserFeedback(
  preferences: BrowserPreferences,
  sourceAudio: Readonly<BrowserSourceAudio> = BROWSER_SOURCE_AUDIO,
  preferenceStorage:BrowserPreferenceStorage|undefined=globalThis.localStorage
) {
  let current = normalizePreferences(preferences);
  let unlocked = false;
  let disposed = false;
  const audioSupported = typeof globalThis.Audio === 'function';
  const vibrationSupported = typeof globalThis.navigator?.vibrate === 'function';
  const channels = ['music', 'contentsMusic', 'shot', 'ui', 'reward', 'upgrade', 'fusion', 'win', 'fail', 'enter'] as const;
  const isMusic = (channel: Channel) => channel === 'music' || channel === 'contentsMusic';
  let activeMusic: Channel = 'music';
  let frame = 0;
  let framePending = false;
  const lastPlayed = new Map<number | Channel, { frame: number; time: number }>();
  type Channel = typeof channels[number];
  const players = new Map<Channel, HTMLAudioElement>();
  const diagnostics = {
    available: {
      music: audioSupported && !!sourceAudio.music,
      sound: audioSupported && channels.some(channel => !isMusic(channel) && !!sourceAudio[channel]),
      shot: audioSupported && !!sourceAudio.shot,
      ui: audioSupported && !!sourceAudio.ui,
      reward: audioSupported && !!sourceAudio.reward,
      vibration: vibrationSupported
    },
    audioStatus: !audioSupported ? 'BROWSER_AUDIO_UNAVAILABLE' :
      channels.some(channel => !!sourceAudio[channel]) ? 'ORIGINAL_CLIPS_PROVIDED' : 'ORIGINAL_CLIPS_NOT_EXPORTED',
    vibrationStatus: vibrationSupported ? 'H5_DEVICE_ADAPTER_SOURCE_PATTERN_UNRESOLVED' : 'BROWSER_VIBRATION_UNAVAILABLE',
    unlocked: false,
    lastAudioError: null as string | null,
    lastVibrationAccepted: null as boolean | null,
    persisted: null as boolean | null
  };
  if (audioSupported) {
    for (const channel of channels) {
      const clip = sourceAudio[channel];
      if (!clip?.url) continue;
      const player = new Audio(clip.url);
      player.preload = 'auto';
      player.loop = isMusic(channel);
      player.playbackRate = clip.pitch ?? 1;
      player.preservesPitch = false;
      player.volume = Math.max(0, Math.min(1, clip.volume ?? 1));
      players.set(channel, player);
    }
  }
  let combatEnabled = true;
  function setCombatEnabled(enabled:boolean):void {
    if(combatEnabled===enabled)return;combatEnabled=enabled;
    if(!enabled){const shot=players.get("shot");if(shot){shot.pause();shot.currentTime=0;}}
  }
  function playAudio(channel: Channel): void {
    if (disposed || !unlocked || !(isMusic(channel) ? current.music : current.sound)) return;
    const player = players.get(channel);
    if (!player) return;
    if (!isMusic(channel)) {
      const now = globalThis.performance?.now() ?? Date.now();
      const key = sourceAudio[channel]?.sfxType ?? channel;
      const last = lastPlayed.get(key);
      const policy = sourceAudioContract.duplicatePolicy;
      if (last && ((policy.sameFrame && last.frame === frame) ||
        (policy.cooldownEnabled && now - last.time < policy.cooldownSeconds * 1000))) return;
      lastPlayed.set(key, { frame, time: now });
      // A single scheduled boundary keeps all events in this browser frame under one token.
      if (!framePending) {
        framePending = true;
        const advance = () => { frame++; framePending = false; };
        if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(advance);
        else globalThis.setTimeout(advance, 0);
      }
      player.currentTime = 0;
    }
    try {
      void player.play().catch(error => {
        diagnostics.lastAudioError = error instanceof Error ? error.message : String(error);
      });
    } catch (error) {
      diagnostics.lastAudioError = error instanceof Error ? error.message : String(error);
    }
  }
  function vibrate(pattern: number | number[]): void {
    if (disposed || !unlocked || !current.vibration || !vibrationSupported) return;
    try { diagnostics.lastVibrationAccepted = globalThis.navigator.vibrate(pattern); }
    catch { diagnostics.lastVibrationAccepted = false; }
  }
  function setPreferences(next: Partial<BrowserPreferences>): void {
    if (disposed) return;
    current = normalizePreferences({ ...current, ...next });
    diagnostics.persisted = saveBrowserPreferences(current,preferenceStorage);
    if (!current.music) for (const [channel, player] of players) { if (isMusic(channel)) player.pause(); }
    else playAudio(activeMusic);
    if (!current.sound) for (const [channel, player] of players) if (!isMusic(channel)) player.pause();
    if (!current.vibration && vibrationSupported) {
      try { globalThis.navigator.vibrate(0); } catch { /* Unsupported device. */ }
    }
  }
  /** Call from a trusted pointer/key gesture. Where supported, enforce user activation. */
  function unlock(): boolean {
    if (disposed) return false;
    const activation = globalThis.navigator?.userActivation;
    if (activation && !activation.isActive && !unlocked) return false;
    unlocked = true;
    diagnostics.unlocked = true;
    playAudio(activeMusic);
    return true;
  }
  function setMusicMode(mode: 'main' | 'contents'): void {
    if (disposed) return;
    const next: Channel = mode === 'contents' ? 'contentsMusic' : 'music';
    if (next === activeMusic) return;
    players.get(activeMusic)?.pause();
    activeMusic = next;
    const player = players.get(next);
    if (player) player.currentTime = 0;
    playAudio(next);
  }
  function dispose(): void {
    if (disposed) return;
    if (vibrationSupported && unlocked) {
      try { globalThis.navigator.vibrate(0); } catch { /* Unsupported device. */ }
    }
    disposed = true;
    for (const player of players.values()) {
      player.pause();
      player.removeAttribute('src');
      player.load();
    }
    players.clear();
  }
  return {
    diagnostics,
    /** Capability flags are independent of the user's on/off preference. */
    available: diagnostics.available,
    getPreferences: () => ({ ...current }),
    setPreferences,
    unlock,
    setMusicMode,
    setCombatEnabled,
    playUpgrade: () => playAudio('upgrade'),
    playFusion: () => playAudio('fusion'),
    playWin: () => playAudio('win'),
    playFail: () => playAudio('fail'),
    playEnter: () => playAudio('enter'),
    // These short haptic patterns are explicit H5 adapters, not recovered native timing.
    playShot: () => { if(combatEnabled){playAudio('shot'); vibrate(10);} },
    playUI: () => { playAudio('ui'); vibrate(8); },
    playReward: () => { playAudio('reward'); vibrate([18, 35, 18]); },
    dispose
  };
}
