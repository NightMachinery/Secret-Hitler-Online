import {
  getReactionSoundMuted,
  playDiscussionReactionSound,
  setReactionSoundMuted,
} from "./reactionSound";
import { DiscussionReactionType } from "../types";

describe("reactionSound", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("persists mute preference per player", () => {
    setReactionSoundMuted("Alice", true);

    expect(getReactionSoundMuted("Alice")).toBe(true);
    expect(getReactionSoundMuted("Bob")).toBe(false);
  });

  test("does not create audio context when muted", () => {
    const AudioContextMock = jest.fn();
    (window as any).AudioContext = AudioContextMock;

    playDiscussionReactionSound(DiscussionReactionType.LIKE, true);

    expect(AudioContextMock).not.toHaveBeenCalled();
  });
});
