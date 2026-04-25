import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ChancellorLegislativePrompt from "./ChancellorLegislativePrompt";
import { PolicyType, WSCommandType } from "../types";

describe("ChancellorLegislativePrompt", () => {
  test("allows veto at the configured final Fascist policy slot", () => {
    const sendWSCommand = jest.fn();
    const showError = jest.fn();

    render(
      <ChancellorLegislativePrompt
        policyOptions={[PolicyType.FASCIST, PolicyType.LIBERAL]}
        sendWSCommand={sendWSCommand}
        fascistPolicies={6}
        fascistPoliciesToWin={7}
        showError={showError}
        enableVeto={true}
      />
    );

    expect(screen.getByText(/veto power unlocked/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "VETO" }));

    expect(sendWSCommand).toHaveBeenCalledWith({
      command: WSCommandType.REGISTER_CHANCELLOR_VETO,
    });
    expect(showError).not.toHaveBeenCalled();
  });
});
