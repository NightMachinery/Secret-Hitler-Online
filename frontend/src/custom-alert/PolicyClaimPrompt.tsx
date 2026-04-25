import React, { Component } from "react";
import ButtonPrompt from "./ButtonPrompt";
import { SERVER_TIMEOUT } from "../constants";
import PolicyDisplay from "../util/PolicyDisplay";
import { PolicyType, SendWSCommand, WSCommandType } from "../types";

import "../util/PolicyDisplay.css";

type PolicyClaimPromptProps = {
  roleLabel: "President" | "Chancellor" | string;
  cardCount: number;
  allowedPolicyTypes: PolicyType[];
  sendWSCommand: SendWSCommand;
};

type PolicyClaimPromptState = {
  policies: PolicyType[];
  waitingForServer: boolean;
};

class PolicyClaimPrompt extends Component<
  PolicyClaimPromptProps,
  PolicyClaimPromptState
> {
  constructor(props: PolicyClaimPromptProps) {
    super(props);
    const initialPolicy = this.getInitialPolicy(props.allowedPolicyTypes);
    this.state = {
      policies: Array.from({ length: props.cardCount }, () => initialPolicy),
      waitingForServer: false,
    };
    this.onSubmitClaim = this.onSubmitClaim.bind(this);
    this.onRefuse = this.onRefuse.bind(this);
  }

  getInitialPolicy(allowedPolicyTypes: PolicyType[]): PolicyType {
    if (allowedPolicyTypes.includes(PolicyType.FASCIST)) {
      return PolicyType.FASCIST;
    }
    return allowedPolicyTypes[0] || PolicyType.FASCIST;
  }

  getAllowedPolicyTypes(): PolicyType[] {
    return this.props.allowedPolicyTypes.length > 0
      ? this.props.allowedPolicyTypes
      : [PolicyType.FASCIST, PolicyType.LIBERAL];
  }

  cyclePolicy(index: number) {
    const allowedPolicyTypes = this.getAllowedPolicyTypes();
    this.setState((state) => {
      const policies = [...state.policies];
      const currentIndex = allowedPolicyTypes.indexOf(policies[index]);
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % allowedPolicyTypes.length;
      policies[index] = allowedPolicyTypes[nextIndex];
      return { policies };
    });
  }

  waitForServerResponse() {
    this.setState({ waitingForServer: true });
    setTimeout(() => {
      this.setState({ waitingForServer: false });
    }, SERVER_TIMEOUT);
  }

  onSubmitClaim() {
    this.waitForServerResponse();
    this.props.sendWSCommand({
      command: WSCommandType.REGISTER_POLICY_CLAIM,
      refused: false,
      cards: this.state.policies,
    });
  }

  onRefuse() {
    this.waitForServerResponse();
    this.props.sendWSCommand({
      command: WSCommandType.REGISTER_POLICY_CLAIM,
      refused: true,
    });
  }

  render() {
    return (
      <ButtonPrompt
        label={"POLICY CLAIM"}
        renderHeader={() => (
          <>
            <p className={"left-align"}>
              {this.props.roleLabel}, report which policy cards you had, or
              refuse to tell the table.
            </p>
            <p className={"left-align highlight"}>
              Tap a card to rotate it between possible policy types.
            </p>
          </>
        )}
        renderButton={() => (
          <div id={"legislative-button-container"}>
            <button
              onClick={this.onRefuse}
              disabled={this.state.waitingForServer}
            >
              REFUSE TO TELL
            </button>
            <button
              onClick={this.onSubmitClaim}
              disabled={this.state.waitingForServer}
            >
              SUBMIT CLAIM
            </button>
          </div>
        )}
      >
        <PolicyDisplay
          policies={this.state.policies}
          onClick={(index: number) => this.cyclePolicy(index)}
          allowSelection={true}
        />
      </ButtonPrompt>
    );
  }
}

export default PolicyClaimPrompt;
