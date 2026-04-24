import React, { useEffect, useState } from "react";
import "./DiscussionReactionDock.css";
import {
  DiscussionReaction,
  DiscussionReactionConfig,
  DiscussionReactionType,
} from "../types";

type DiscussionReactionDockProps = {
  activeReaction?: DiscussionReaction;
  config: DiscussionReactionConfig;
  canReact: boolean;
  isModerator: boolean;
  isViewerDead: boolean;
  onReact: (reaction: DiscussionReactionType) => void;
  onSaveConfig: (durationSeconds: number, allowDeadPlayers: boolean) => void;
};

const ReactionIcon = ({
  type,
}: {
  type: DiscussionReactionType;
}): React.JSX.Element => {
  if (type === DiscussionReactionType.LIKE) {
    return (
      <svg
        className="discussion-reaction-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 10v12" />
        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.95 2.57l-1.2 5A2 2 0 0 1 18.64 19H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L13 4a2 2 0 0 1 2-1.12Z" />
      </svg>
    );
  }

  if (type === DiscussionReactionType.DISLIKE) {
    return (
      <svg
        className="discussion-reaction-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17 14V2" />
        <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.95-2.57l1.2-5A2 2 0 0 1 5.36 5H17a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L11 20a2 2 0 0 1-2 1.12Z" />
      </svg>
    );
  }

  return (
    <svg
      className="discussion-reaction-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
};

const SettingsIcon = (): React.JSX.Element => (
  <svg
    className="discussion-reaction-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 .99-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51.99H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const DiscussionReactionDock = ({
  activeReaction,
  config,
  canReact,
  isModerator,
  isViewerDead,
  onReact,
  onSaveConfig,
}: DiscussionReactionDockProps) => {
  const [showSettings, setShowSettings] = useState(false);
  const [durationInput, setDurationInput] = useState(
    config.durationSeconds.toString()
  );
  const [allowDeadPlayers, setAllowDeadPlayers] = useState(
    config.allowDeadPlayers
  );

  useEffect(() => {
    setDurationInput(config.durationSeconds.toString());
    setAllowDeadPlayers(config.allowDeadPlayers);
  }, [config.durationSeconds, config.allowDeadPlayers]);

  const applySettings = () => {
    const nextDurationSeconds = Number(durationInput);
    if (!Number.isFinite(nextDurationSeconds) || nextDurationSeconds < 1) {
      return;
    }
    onSaveConfig(Math.floor(nextDurationSeconds), allowDeadPlayers);
    setShowSettings(false);
  };

  const disabledMessage =
    !canReact && isViewerDead && !config.allowDeadPlayers
      ? "Dead-player reactions are currently disabled by a moderator."
      : "";
  const activeReactionLabel =
    activeReaction?.type === DiscussionReactionType.LIKE
      ? "Like cue live"
      : activeReaction?.type === DiscussionReactionType.DISLIKE
        ? "Dislike cue live"
        : "No active cue";

  return (
    <div id="discussion-reaction-dock-wrap">
      {showSettings && isModerator && (
        <div id="discussion-reaction-settings-panel">
          <div className="discussion-reaction-settings-eyebrow">
            Moderator controls
          </div>
          <div className="discussion-reaction-settings-title">Reaction settings</div>
          <p className="discussion-reaction-settings-copy">
            Tune how long each cue lingers on a player card.
          </p>
          <label className="discussion-reaction-settings-field">
            <span>Fade time (seconds)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={durationInput}
              onChange={(event) => setDurationInput(event.target.value)}
            />
          </label>
          <label className="discussion-reaction-settings-toggle">
            <input
              type="checkbox"
              checked={allowDeadPlayers}
              onChange={(event) => setAllowDeadPlayers(event.target.checked)}
            />
            <span className="discussion-reaction-settings-switch" />
            <span>Allow dead players to react</span>
          </label>
          <div className="discussion-reaction-settings-actions">
            <button
              type="button"
              className="discussion-reaction-mini-button"
              onClick={() => setShowSettings(false)}
            >
              Close
            </button>
            <button
              type="button"
              className="discussion-reaction-mini-button discussion-reaction-mini-button-primary"
              onClick={applySettings}
            >
              Apply
            </button>
          </div>
        </div>
      )}

      <div id="discussion-reaction-dock-frame">
        <div className="discussion-reaction-dock-summary">
          <div id="discussion-reaction-dock-badge">DISCUSSION CUES</div>
          <div
            className="discussion-reaction-active-readout"
            aria-live="polite"
            aria-atomic="true"
          >
            {activeReactionLabel}
          </div>
        </div>
        <div className="discussion-reaction-dock-summary-divider" />
        <div id="discussion-reaction-dock">
          <div className="discussion-reaction-button-cluster">
            <button
              type="button"
              className={`discussion-reaction-button discussion-reaction-button-like ${
                activeReaction?.type === DiscussionReactionType.LIKE
                  ? "discussion-reaction-button-active"
                  : ""
              }`}
              disabled={!canReact}
              onClick={() => onReact(DiscussionReactionType.LIKE)}
              aria-label="Send like reaction"
              title="Like"
            >
              <span className="discussion-reaction-button-shell">
                <ReactionIcon type={DiscussionReactionType.LIKE} />
              </span>
            </button>
            <button
              type="button"
              className={`discussion-reaction-button discussion-reaction-button-dislike ${
                activeReaction?.type === DiscussionReactionType.DISLIKE
                  ? "discussion-reaction-button-active"
                  : ""
              }`}
              disabled={!canReact}
              onClick={() => onReact(DiscussionReactionType.DISLIKE)}
              aria-label="Send dislike reaction"
              title="Dislike"
            >
              <span className="discussion-reaction-button-shell">
                <ReactionIcon type={DiscussionReactionType.DISLIKE} />
              </span>
            </button>
            <button
              type="button"
              className={`discussion-reaction-button discussion-reaction-button-clear ${
                activeReaction ? "discussion-reaction-button-clear-ready" : ""
              }`}
              disabled={!canReact || !activeReaction}
              onClick={() => onReact(DiscussionReactionType.CLEAR)}
              aria-label="Clear reaction"
              title="Clear"
            >
              <span className="discussion-reaction-button-shell">
                <ReactionIcon type={DiscussionReactionType.CLEAR} />
              </span>
            </button>
          </div>
          {isModerator && (
            <>
              <div className="discussion-reaction-button-divider" />
              <button
                type="button"
                className={`discussion-reaction-button discussion-reaction-button-settings ${
                  showSettings ? "discussion-reaction-button-active" : ""
                }`}
                onClick={() => setShowSettings((value) => !value)}
                aria-label="Open reaction settings"
                title="Reaction settings"
              >
                <span className="discussion-reaction-button-shell">
                  <SettingsIcon />
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {disabledMessage !== "" && (
        <div id="discussion-reaction-disabled-note">{disabledMessage}</div>
      )}
    </div>
  );
};

export default DiscussionReactionDock;
