import React, {Component} from "react";
import PropTypes from "prop-types";
import IconFascist from "../assets/player-icon-fascist.png";
import IconHitler from "../assets/player-icon-hitler.png";
import IconLiberal from "../assets/player-icon-liberal.png";
import IconAnarchist from "../assets/role-anarchist.png";

import './PlayerPolicyStatus.css';

const NUM_HITLER_PLAYERS = 1;
const MAX_FASCIST_POLICIES = 11;
const MAX_LIBERAL_POLICIES = 6;

class PlayerPolicyStatus extends  Component {

    render() {
        let fascistPlayers, liberalPlayers;
        let props = this.props;
        const setupConfig = props.setupConfig || {};
        const configuredAnarchists = setupConfig.anarchistRoles || 0;
        const configuredAnarchyCards = setupConfig.anarchistPolicies || 0;
        const anarchyEnacted = props.anarchistPoliciesResolved || 0;
        const showAnarchy = configuredAnarchists > 0 || configuredAnarchyCards > 0 || anarchyEnacted > 0;
        if (props.setupConfig) {
            fascistPlayers = setupConfig.fascistRoles || 0;
            liberalPlayers = setupConfig.liberalRoles || 0;
        } else {
            const totalFascists = Math.floor((props.playerCount - 1) / 2);
            fascistPlayers = totalFascists - NUM_HITLER_PLAYERS;
            liberalPlayers = props.playerCount - totalFascists;
        }

        return (
            <div id={"pps-container"}>
                <p id={"pps-text"}>
                    Players:
                </p>
                <div id={"pps-icon-container"}>
                    <img id="pps-icon" src={IconLiberal} alt={"Liberal"}/>
                    <p id={"pps-icon-number"} className={"highlight-blue"}>{liberalPlayers}</p>
                    <img id="pps-icon" src={IconFascist} alt={"Fascist"}/>
                    <p id={"pps-icon-number"} className={"highlight"}>{fascistPlayers}</p>
                    <img id="pps-icon" src={IconHitler} alt={"Hitler"}/>
                    <p id={"pps-icon-number"}  className={"highlight"}>{NUM_HITLER_PLAYERS}</p>
                </div>
                {showAnarchy && (
                    <>
                        <p id={"pps-text"}>Anarchists:</p>
                        <div id={"pps-icon-container"}>
                            <img id="pps-icon" className={"highlight-anarchy"} src={IconAnarchist} alt={"Anarchist"}/>
                            <p id={"pps-icon-number"} className={"highlight-anarchy"}>{configuredAnarchists}</p>
                        </div>
                    </>
                )}

                <p id={"pps-text"}>
                    Unenacted Policies:
                </p>
                <div id={"pps-icon-container"}>
                    <img id="pps-icon" className={"highlight-blue"} src={IconLiberal} alt={"Liberal"}/>
                    <p id={"pps-icon-number"} className={"highlight-blue"}>{MAX_LIBERAL_POLICIES - props.numLiberalPolicies}</p>
                    <img id="pps-icon" className={"highlight"} src={IconFascist} alt={"Fascist"}/>
                    <p id={"pps-icon-number"} className={"highlight"}>{MAX_FASCIST_POLICIES - props.numFascistPolicies}</p>
                </div>
                {showAnarchy && (
                    <>
                        <p id={"pps-text"}>Anarchy Cards:</p>
                        <div id={"pps-icon-container"}>
                            <img id="pps-icon" className={"highlight-anarchy"} src={IconAnarchist} alt={"Anarchist"}/>
                            <p id={"pps-icon-number"} className={"highlight-anarchy"}>{configuredAnarchyCards}</p>
                        </div>
                        <p id={"pps-text"} className={"pps-anarchy-enacted"}>
                            Anarchy Enacted: {anarchyEnacted}
                        </p>
                    </>
                )}
            </div>
        )
    }
}

PlayerPolicyStatus.propTypes = {
    numFascistPolicies: PropTypes.number.isRequired,
    numLiberalPolicies: PropTypes.number.isRequired,
    playerCount: PropTypes.number.isRequired,
    setupConfig: PropTypes.object,
    anarchistPoliciesResolved: PropTypes.number,
};

export default PlayerPolicyStatus;
