import React from "react";
import "./HistoryPanel.css";
import {
  PolicyClaim,
  PolicyType,
  PublicHistoryAction,
  PublicHistoryActionType,
  RoundHistoryEntry,
  RoundHistoryResult,
} from "../types";
import LiberalPolicy from "../assets/policy-liberal.png";
import FascistPolicy from "../assets/policy-fascist.png";
import AnarchistPolicy from "../assets/policy-anarchist.png";

type HistoryPanelProps = {
  history: RoundHistoryEntry[];
  playerOrder: string[];
  showVoteBreakdown: boolean;
  showPublicActions: boolean;
  showPolicyClaims: boolean;
};

const getResultLabel = (result: RoundHistoryResult | null): string => {
  switch (result) {
    case RoundHistoryResult.FASCIST:
      return "Fascist";
    case RoundHistoryResult.LIBERAL:
      return "Liberal";
    case RoundHistoryResult.ANARCHIST:
      return "Anarchist";
    case RoundHistoryResult.VOTE_FAILED:
      return "Vote failed";
    default:
      return "In progress";
  }
};

const getResultClass = (result: RoundHistoryResult | null): string => {
  switch (result) {
    case RoundHistoryResult.FASCIST:
      return "history-result-fascist";
    case RoundHistoryResult.LIBERAL:
      return "history-result-liberal";
    case RoundHistoryResult.ANARCHIST:
      return "history-result-fascist";
    case RoundHistoryResult.VOTE_FAILED:
      return "history-result-failed";
    default:
      return "history-result-pending";
  }
};

const getActionLabel = (action: PublicHistoryAction): string => {
  switch (action.type) {
    case PublicHistoryActionType.PEEK_USED:
      return `${action.president} used the Peek power`;
    case PublicHistoryActionType.INVESTIGATED:
      return `${action.president} investigated ${action.target}${getInvestigationResultSuffix(
        action.investigationResult
      )}`;
    case PublicHistoryActionType.EXECUTED:
      return `${action.president} executed ${action.target}${
        action.hitlerExecuted ? " (Hitler)" : ""
      }`;
    case PublicHistoryActionType.SPECIAL_ELECTION:
      return `${action.president} chose ${action.target} as next president`;
    default:
      return "Unknown action";
  }
};

const getInvestigationResultSuffix = (
  result: PolicyType | null | undefined
): string => {
  switch (result) {
    case PolicyType.LIBERAL:
      return " — result: Liberal";
    case PolicyType.ANARCHIST:
      return " — result: Anarchist";
    case PolicyType.FASCIST:
      return " — result: Fascist";
    default:
      return "";
  }
};

const getOrderedVoters = (
  entry: RoundHistoryEntry,
  playerOrder: string[]
): string[] => {
  const fromPlayerOrder = playerOrder.filter((name) =>
    Object.prototype.hasOwnProperty.call(entry.votes, name)
  );

  const extras = Object.keys(entry.votes).filter(
    (name) => !fromPlayerOrder.includes(name)
  );

  return [...fromPlayerOrder, ...extras];
};

const VoteIcon = ({ vote }: { vote: boolean }): React.JSX.Element => {
  return vote ? (
    <svg
      className="history-vote-icon history-vote-icon-yes"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Yes vote"
    >
      <title>Yes</title>
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.95 2.57l-1.2 5A2 2 0 0 1 18.64 19H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L13 4a2 2 0 0 1 2-1.12Z" />
    </svg>
  ) : (
    <svg
      className="history-vote-icon history-vote-icon-no"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="No vote"
    >
      <title>No</title>
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.95-2.57l1.2-5A2 2 0 0 1 5.36 5H17a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L11 20a2 2 0 0 1-2 1.12Z" />
    </svg>
  );
};

const renderVoteSummary = (
  entry: RoundHistoryEntry,
  playerOrder: string[]
): React.JSX.Element => {
  const voters = getOrderedVoters(entry, playerOrder);
  return (
    <div className="history-vote-list">
      {voters.map((name) => {
        const vote = entry.votes[name];
        return (
          <span
            key={name}
            className={`history-vote-item ${
              vote ? "history-vote-item-yes" : "history-vote-item-no"
            }`}
            title={vote ? "Ja" : "Nein"}
            aria-label={`${name}: ${vote ? "Yes" : "No"} vote`}
          >
            <VoteIcon vote={vote} />
            <span className="history-vote-name">{name}</span>
          </span>
        );
      })}
    </div>
  );
};

const getPolicyClaimImage = (policy: PolicyType): string => {
  switch (policy) {
    case PolicyType.LIBERAL:
      return LiberalPolicy;
    case PolicyType.ANARCHIST:
      return AnarchistPolicy;
    case PolicyType.FASCIST:
    default:
      return FascistPolicy;
  }
};

const getPolicyClaimLabel = (policy: PolicyType): string => {
  switch (policy) {
    case PolicyType.LIBERAL:
      return "liberal";
    case PolicyType.ANARCHIST:
      return "anarchist";
    case PolicyType.FASCIST:
    default:
      return "fascist";
  }
};

const renderClaimCards = (
  roleName: "President" | "Chancellor",
  claim: PolicyClaim
): React.JSX.Element => {
  return (
    <span className="history-claim-cards">
      {claim.policies.map((policy, index) => (
        <img
          key={`${roleName}-${index}-${policy}`}
          className="history-claim-card"
          src={getPolicyClaimImage(policy)}
          alt={`${roleName} claimed ${getPolicyClaimLabel(policy)} policy`}
        />
      ))}
    </span>
  );
};

const renderClaimLine = (
  shortLabel: "P" | "C",
  roleName: "President" | "Chancellor",
  claim: PolicyClaim | null | undefined,
  required: boolean | undefined
): React.JSX.Element => {
  let claimContent: React.ReactNode = "—";
  if (claim) {
    claimContent = claim.refused ? "Refused" : renderClaimCards(roleName, claim);
  } else if (required) {
    claimContent = "Pending";
  }

  return (
    <div className="history-claim-line">
      <span className="history-claim-role">{shortLabel}:</span>
      <span className="history-claim-value">{claimContent}</span>
    </div>
  );
};

const renderPolicyClaims = (entry: RoundHistoryEntry): React.JSX.Element => {
  return (
    <div className="history-claim-list">
      {renderClaimLine(
        "P",
        "President",
        entry.presidentPolicyClaim,
        entry.policyClaimsRequired
      )}
      {renderClaimLine(
        "C",
        "Chancellor",
        entry.chancellorPolicyClaim,
        entry.policyClaimsRequired
      )}
    </div>
  );
};

const HistoryPanel = ({
  history,
  playerOrder,
  showVoteBreakdown,
  showPublicActions,
  showPolicyClaims,
}: HistoryPanelProps) => {
  const rows = [...history].reverse();
  const hasVisiblePolicyClaims = rows.some(
    (entry) =>
      Boolean(entry.policyClaimsRequired) ||
      Boolean(entry.presidentPolicyClaim) ||
      Boolean(entry.chancellorPolicyClaim)
  );
  const shouldShowPolicyClaims = showPolicyClaims || hasVisiblePolicyClaims;
  let colCount = 4; // round, president, chancellor, result
  if (showVoteBreakdown) {
    colCount++;
  }
  if (shouldShowPolicyClaims) {
    colCount++;
  }
  if (showPublicActions) {
    colCount++;
  }

  return (
    <div id="history-panel-container">
      <div id="history-panel-title">Vote History</div>
      <div id="history-table-wrap">
        <table id="history-table">
          <thead>
            <tr>
              <th>Round</th>
              <th>President</th>
              <th>Chancellor</th>
              {showVoteBreakdown && <th>Votes</th>}
              <th>Result</th>
              {shouldShowPolicyClaims && <th>Claims</th>}
              {showPublicActions && <th>Public Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount}>No completed votes yet.</td>
              </tr>
            ) : (
              rows.map((entry, index) => (
                <tr key={`${entry.round}-${entry.president}-${entry.chancellor}-${index}`}>
                  <td>{entry.round}</td>
                  <td>{entry.president}</td>
                  <td>{entry.chancellor}</td>
                  {showVoteBreakdown && (
                    <td className="history-votes">
                      {renderVoteSummary(entry, playerOrder)}
                    </td>
                  )}
                  <td>
                    <span className={`history-result-pill ${getResultClass(entry.result)}`}>
                      {getResultLabel(entry.result)}
                    </span>
                  </td>
                  {shouldShowPolicyClaims && (
                    <td className="history-claims">
                      {renderPolicyClaims(entry)}
                    </td>
                  )}
                  {showPublicActions && (
                    <td className="history-actions">
                      {entry.publicActions.length === 0
                        ? "None"
                        : entry.publicActions.map(getActionLabel).join(" | ")}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoryPanel;
