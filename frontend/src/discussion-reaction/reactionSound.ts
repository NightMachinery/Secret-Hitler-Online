import { DiscussionReactionType } from "../types";

const REACTION_SOUND_MUTED_PREFIX = "secretHitler.reactionSoundsMuted.";

const getStorageKey = (playerName: string): string =>
  `${REACTION_SOUND_MUTED_PREFIX}${playerName || "anonymous"}`;

export const getReactionSoundMuted = (playerName: string): boolean => {
  try {
    return localStorage.getItem(getStorageKey(playerName)) === "true";
  } catch (_error) {
    return false;
  }
};

export const setReactionSoundMuted = (
  playerName: string,
  muted: boolean
): void => {
  try {
    localStorage.setItem(getStorageKey(playerName), muted ? "true" : "false");
  } catch (_error) {
    // Ignore storage errors; sound muting is a local convenience.
  }
};

export const playDiscussionReactionSound = (
  reaction: DiscussionReactionType,
  muted: boolean
): void => {
  if (muted || reaction === DiscussionReactionType.CLEAR) {
    return;
  }

  try {
    const AudioContextClass =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    const frequency =
      reaction === DiscussionReactionType.LIKE ? 660 : 220;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.18);
  } catch (_error) {
    // Browsers can deny audio until user interaction; ignore cue failures.
  }
};
