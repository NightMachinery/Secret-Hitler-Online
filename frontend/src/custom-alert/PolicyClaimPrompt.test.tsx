import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import PolicyClaimPrompt from "./PolicyClaimPrompt";
import { PolicyType, WSCommandType } from "../types";

describe("PolicyClaimPrompt", () => {
  test("starts as Fascist cards and cycles through setup policy types before submit", () => {
    const sendWSCommand = jest.fn();

    render(
      <PolicyClaimPrompt
        roleLabel="President"
        cardCount={3}
        allowedPolicyTypes={[
          PolicyType.FASCIST,
          PolicyType.LIBERAL,
          PolicyType.ANARCHIST,
        ]}
        sendWSCommand={sendWSCommand}
      />
    );

    expect(screen.getAllByAltText(/A fascist policy/i)).toHaveLength(3);

    fireEvent.click(screen.getAllByAltText(/A fascist policy/i)[0]);
    fireEvent.click(screen.getByRole("button", { name: "SUBMIT CLAIM" }));

    expect(sendWSCommand).toHaveBeenCalledWith({
      command: WSCommandType.REGISTER_POLICY_CLAIM,
      refused: false,
      cards: [PolicyType.LIBERAL, PolicyType.FASCIST, PolicyType.FASCIST],
    });
  });

  test("allows refusing to tell", () => {
    const sendWSCommand = jest.fn();

    render(
      <PolicyClaimPrompt
        roleLabel="Chancellor"
        cardCount={2}
        allowedPolicyTypes={[PolicyType.FASCIST, PolicyType.LIBERAL]}
        sendWSCommand={sendWSCommand}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "REFUSE TO TELL" }));

    expect(sendWSCommand).toHaveBeenCalledWith({
      command: WSCommandType.REGISTER_POLICY_CLAIM,
      refused: true,
    });
  });
});
