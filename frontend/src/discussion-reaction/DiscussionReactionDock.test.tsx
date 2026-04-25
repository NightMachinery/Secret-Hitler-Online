import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import DiscussionReactionDock from "./DiscussionReactionDock";
import { DiscussionReactionType } from "../types";

describe("DiscussionReactionDock", () => {
  test("renders reaction controls and clear button state", () => {
    const { container } = render(
      <DiscussionReactionDock
        activeReaction={{
          type: DiscussionReactionType.LIKE,
          expiresAt: Date.now() + 5000,
        }}
        config={{ durationSeconds: 15, allowDeadPlayers: true }}
        canReact={true}
        isModerator={false}
        isViewerDead={false}
        onReact={() => {}}
        onSaveConfig={() => {}}
      />
    );

    expect(screen.getByLabelText("Send like reaction")).toBeInTheDocument();
    expect(screen.getByLabelText("Send dislike reaction")).toBeInTheDocument();
    expect(screen.getByLabelText("Clear reaction")).not.toBeDisabled();
    expect(container.querySelector("#discussion-reaction-dock-wrap")).toHaveClass(
      "discussion-reaction-dock-inline"
    );
  });

  test("shows moderator settings and submits updated config", () => {
    const onSaveConfig = jest.fn();

    render(
      <DiscussionReactionDock
        config={{ durationSeconds: 15, allowDeadPlayers: true }}
        canReact={true}
        isModerator={true}
        isViewerDead={false}
        onReact={() => {}}
        onSaveConfig={onSaveConfig}
      />
    );

    fireEvent.click(screen.getByLabelText("Open reaction settings"));
    fireEvent.change(screen.getByDisplayValue("15"), {
      target: { value: "9" },
    });
    fireEvent.click(screen.getByLabelText(/allow dead players to react/i));
    fireEvent.click(screen.getByText("Apply"));

    expect(onSaveConfig).toHaveBeenCalledWith(9, false);
  });

  test("disables reactions and shows note when dead-player reactions are off", () => {
    render(
      <DiscussionReactionDock
        config={{ durationSeconds: 15, allowDeadPlayers: false }}
        canReact={false}
        isModerator={false}
        isViewerDead={true}
        onReact={() => {}}
        onSaveConfig={() => {}}
      />
    );

    expect(screen.getByLabelText("Send like reaction")).toBeDisabled();
    expect(
      screen.getByText(/dead-player reactions are currently disabled/i)
    ).toBeInTheDocument();
  });
});
