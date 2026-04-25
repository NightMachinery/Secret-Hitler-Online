import React, {Component} from 'react';
import LiberalBoard from "../assets/board-liberal.png";
import ElectionTracker from "../assets/board-tracker.png";
import PolicyLiberal from "../assets/board-policy-liberal.png";
import FascistBoard_5_6 from "../assets/board-fascist-5-6.png";
import FascistBoard_7_8 from "../assets/board-fascist-7-8.png";
import FascistBoard_9_10 from "../assets/board-fascist-9-10.png";
import PolicyFascist from "../assets/board-policy-fascist.png";
import AnarchistPolicy from "../assets/policy-anarchist.svg";
import { getDefaultPowerSchedule } from "../setup/GameSetupConfig";

import "./Board.css";

class Board extends Component {


    /**
     * Returns the correct board image based on the number of players in the game.
     * @requires this.props.numPlayers must in range [5, 20], inclusive.
     * @return {image} The Fascist board corresponding to the number of players.
     *         5-6: FascistBoard_5_6
     *         7-8: FascistBoard_7_8
     *         9+: FascistBoard_9_10
     */
    getFascistBoard() {
        if(this.props.numPlayers <= 6) {
            return FascistBoard_5_6;
        } else if (this.props.numPlayers <= 8) {
            return FascistBoard_7_8;
        } else {
            return FascistBoard_9_10;
        }
    }

    isStandardBoard() {
        const config = this.props.setupConfig;
        const defaultPowerSchedule = getDefaultPowerSchedule(this.props.numPlayers);
        const configuredPowerSchedule = config && config.fascistPowerSchedule;
        const hasStandardPowerSchedule = !configuredPowerSchedule || (
            configuredPowerSchedule.length === defaultPowerSchedule.length &&
            configuredPowerSchedule.every((power, index) => power === defaultPowerSchedule[index])
        );
        return !config || (
            config.liberalPoliciesToWin === 5 &&
            config.fascistPoliciesToWin === 6 &&
            (config.anarchistPolicies || 0) === 0 &&
            (config.anarchistRoles || 0) === 0 &&
            hasStandardPowerSchedule
        );
    }

    renderDynamicElectionTracker() {
        return (
            <div
                className="dynamic-election-tracker"
                aria-label={"Election tracker at position " + this.props.electionTracker + " out of 3."}
            >
                <span>Election tracker</span>
                <div className="dynamic-election-track">
                    {[0, 1, 2].map((position) => (
                        <div className="dynamic-election-slot" key={position}>
                            {this.props.electionTracker === position && (
                                <img
                                    id="election-tracker"
                                    src={ElectionTracker}
                                    alt={"Election tracker at position " + this.props.electionTracker + " out of 3."}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    renderDynamicPowerMarkers(totalCount) {
        const schedule = (this.props.setupConfig && this.props.setupConfig.fascistPowerSchedule) || [];
        return (
            <div
                className="dynamic-power-markers"
                style={{gridTemplateColumns: "repeat(" + totalCount + ", minmax(0, 1fr))"}}
                aria-label="Fascist power schedule"
            >
                {Array.from({length: totalCount}).map((_, index) => {
                    const power = schedule[index] || "NONE";
                    return (
                        <span
                            className={"dynamic-power-marker" + (power === "NONE" ? " empty" : "")}
                            key={index}
                        >
                            {power === "NONE" ? "" : power}
                        </span>
                    );
                })}
            </div>
        );
    }

    /**
     * Places a series of repeating images.
     * @param count {number} the count of currently visible images.
     * @param totalCount {number} the total number of images to place.
     * @param src {Image} the image source to use for the tiles.
     * @param id {String} the HTML id to apply.
     * @param offset {String} the offset from the left of the first tile (given as a %)
     * @param spacing {String} the horizontal offset between each image (given as %)
     * @returns {<img>[]} an array of {@literal <img>} tags of length {@code totalCount}. Each image has the given
     *          {@code id} identity, {@code src} as an image source. There will be {@code spacing} between each image, and
     *          all images will be offset by {@code offset}.
     *          The first {@code count} images from the left will be given the class-name "show", the remaining will be given
     *          the class-name "hide".
     */
    placeRepeating(count, totalCount, src, id, offset, spacing) {
        let images = [];
        let index = 0;
        for(index; index < totalCount; index++) {
            let className = "hide";
            if (index < count) {
                className = "show";
            }
            images[index] = (
                <img src={src}
                     id={id}
                     style={{position: "absolute", left:"calc(" + offset + " + " + index.toString() + "*" + spacing +")"}}
                     alt={""}
                     className={className}
                     key={index}
                />
            );
        }
        return images;
    }

    render() {
        if (!this.isStandardBoard()) {
            const config = this.props.setupConfig || {};
            const liberalTotal = config.liberalPoliciesToWin || 5;
            const fascistTotal = config.fascistPoliciesToWin || 6;
            return (
                <div id="board-container" className="dynamic-board-container">
                    {this.renderDynamicElectionTracker()}
                    <div className="dynamic-board-row liberal-row" aria-label={this.props.numLiberalPolicies + " liberal policies have been passed."}>
                        <div className="dynamic-board-label">LIBERAL</div>
                        {this.placeRepeating(this.props.numLiberalPolicies, liberalTotal, PolicyLiberal, "policy", "18.2%", "13.54%")}
                    </div>
                    <div className="dynamic-board-row fascist-row" aria-label={this.props.numFascistPolicies + " fascist policies have been passed."}>
                        <div className="dynamic-board-label">FASCIST</div>
                        {this.placeRepeating(this.props.numFascistPolicies, fascistTotal, PolicyFascist, "policy", "11%", "13.6%")}
                        {this.renderDynamicPowerMarkers(fascistTotal)}
                    </div>
                    <div className="dynamic-anarchist-summary">
                        <img src={AnarchistPolicy} alt="" />
                        <span>Anarchist policies resolved: {this.props.numAnarchistPoliciesResolved || 0}</span>
                    </div>
                </div>
            );
        }
        return (
            <div id="board-container" style={{display:"flex", flexDirection:"column"}}>
                <div id="board-group" style ={{margin:"4px 10px", position:"relative"}}>
                    <img id="board"
                         src={LiberalBoard}
                         alt={this.props.numLiberalPolicies + " liberal policies have been passed."}
                    />
                    <img id="election-tracker"
                         src={ElectionTracker}
                         style={{position:"absolute",
                                 top:"74%", left:"calc(34.2% + " + this.props.electionTracker+"*9.16%)",
                                 width:"3.2%"}}
                         alt={"Election tracker at position " + this.props.electionTracker + " out of 3."}
                    />
                    {this.placeRepeating(this.props.numLiberalPolicies, 5, PolicyLiberal, "policy", "18.2%", "13.54%")}
                </div>

                <div id="board-group" style={{margin:"4px 10px", position:"relative"}}>
                    <img
                      id="board"
                      src={this.getFascistBoard()}
                      alt={this.props.numFascistPolicies + " fascist policies have been passed."}
                    />
                    {this.placeRepeating(this.props.numFascistPolicies, 6, PolicyFascist, "policy", "11%", "13.6%")}
                </div>
            </div>
        );
    }

}

Board.defaultProps = {
    numFascistPolicies: 5,
    numLiberalPolicies: 6,
    electionTracker: 0,
    numPlayers: 5,
    numAnarchistPoliciesResolved: 0,
    setupConfig: null
};

export default Board;
