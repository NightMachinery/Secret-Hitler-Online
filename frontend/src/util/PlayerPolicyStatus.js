import React, {Component} from "react";
import PropTypes from "prop-types";
import IconFascist from "../assets/player-icon-fascist.png";
import IconHitler from "../assets/player-icon-hitler.png";
import IconLiberal from "../assets/player-icon-liberal.png";

import './PlayerPolicyStatus.css';

const NUM_HITLER_PLAYERS = 1;
const MAX_FASCIST_POLICIES = 11;
const MAX_LIBERAL_POLICIES = 6;

class PlayerPolicyStatus extends  Component {

    render() {
        let fascistPlayers, liberalPlayers;
        let props = this.props;
        const totalFascists = Math.floor((props.playerCount - 1) / 2);
        fascistPlayers = totalFascists - NUM_HITLER_PLAYERS;
        liberalPlayers = props.playerCount - totalFascists;

        return (
            <div id={"pps-container"} className={this.props.className}>
                <div className={"pps-section"}>
                    <p className={"pps-text"}>
                        Players
                    </p>
                    <div className={"pps-icon-container"}>
                        <div className={"pps-stat-pill"}>
                            <img className="pps-icon" src={IconLiberal} alt={"Liberal"}/>
                            <p className={"pps-icon-number highlight-blue"}>{liberalPlayers}</p>
                        </div>
                        <div className={"pps-stat-pill"}>
                            <img className="pps-icon" src={IconFascist} alt={"Fascist"}/>
                            <p className={"pps-icon-number highlight"}>{fascistPlayers}</p>
                        </div>
                        <div className={"pps-stat-pill"}>
                            <img className="pps-icon" src={IconHitler} alt={"Hitler"}/>
                            <p className={"pps-icon-number highlight"}>{NUM_HITLER_PLAYERS}</p>
                        </div>
                    </div>
                </div>

                <div className={"pps-section"}>
                    <p className={"pps-text"}>
                        Unenacted Policies
                    </p>
                    <div className={"pps-icon-container"}>
                        <div className={"pps-stat-pill"}>
                            <img className="pps-icon" src={IconLiberal} alt={"Liberal"}/>
                            <p className={"pps-icon-number highlight-blue"}>{MAX_LIBERAL_POLICIES - props.numLiberalPolicies}</p>
                        </div>
                        <div className={"pps-stat-pill"}>
                            <img className="pps-icon" src={IconFascist} alt={"Fascist"}/>
                            <p className={"pps-icon-number highlight"}>{MAX_FASCIST_POLICIES - props.numFascistPolicies}</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

PlayerPolicyStatus.propTypes = {
    className: PropTypes.string,
    numFascistPolicies: PropTypes.number.isRequired,
    numLiberalPolicies: PropTypes.number.isRequired,
    playerCount: PropTypes.number.isRequired,
};

PlayerPolicyStatus.defaultProps = {
    className: "",
};

export default PlayerPolicyStatus;
