import React from "react";
import { act, render, screen } from "@testing-library/react";
import InvestigationAlert from "./InvestigationAlert";
import { LIBERAL } from "../constants";

describe("InvestigationAlert timing", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test("reveals the result text and enables OK without a long delay", () => {
    render(
      <InvestigationAlert
        party={LIBERAL}
        target={"Bob"}
        hideAlert={jest.fn()}
      />
    );

    const button = screen.getByRole("button", { name: "OKAY" });
    const resultText = screen.getByText(
      "Bob is a member of the LIBERAL party."
    );
    expect(button).toBeDisabled();
    expect(resultText).toHaveClass("investigation-text-hide");

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(resultText).toHaveClass("investigation-text-show");
    expect(button).toBeEnabled();
  });
});
