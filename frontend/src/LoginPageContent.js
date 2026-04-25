import React, {Component} from "react";
import "./LoginPageContent.css";
import "./util/CustomAliceCarousel.css";
import placePolicyGif from "./assets/login-media/place-policy.gif";
import showPolicyGif from "./assets/login-media/show-policy.gif";
import showVotesGif from "./assets/login-media/show-votes.gif";
import { REPO_ISSUES_URL, REPO_URL } from "./constants";


class LoginPageContent extends Component {

    render() {
        let handleDragStart = (e) => e.preventDefault();
        let items = [
            <img key={"place-policy"} id={"login-page-gif"} src={placePolicyGif} onDragStart={handleDragStart} alt={"A policy tile being placed on the board."}/>,
            <img key={"show-policy"} id={"login-page-gif"} src={showPolicyGif} onDragStart={handleDragStart} alt={"An animated folder revealing a policy tile."}/>,
            <img key={"show-votes"} id={"login-page-gif"} src={showVotesGif} onDragStart={handleDragStart} alt={"An animation showing all the cast votes."}/>
        ];
        return (
            <>
                <div id={"#login-page-description-container"}>
                    <div id={"login-page-description-text-container"}>
                        <h2 id={"login-page-description-text-header"}>What is Secret Hitler Online?</h2>
                        <p id={"login-page-description-text"}>
                            Secret Hitler Online is a browser-based hidden-identity game for up to 20 players.
                            It keeps the secrecy, bluffing, and fast lobby sharing of the tabletop version while making
                            setup and moderation easier online.
                            <br/><br/>
                        </p>
                    </div>
                    <div id={"login-page-gif-container"}>
                        {items}
                    </div>
                    <div id={"login-page-description-text-container"}>
                        <p id={"login-page-description-text"}>
                            <br/>
                            This project is open-source and released under CC BY-NC-SA 4.0.
                            You can read more about the project <a
                                href={REPO_URL}
                                rel="noreferrer"
                                target={"_blank"}>
                                    on GitHub
                            </a>!
                            <br/><br/>
                            Based on the original Secret Hitler board game.
                            <br/><br/>
                            Found a bug or want to leave a comment? Report it on the <a href={REPO_ISSUES_URL}
                                                                                             rel="noreferrer"
                                                                                             target={"_blank"}>Issues page</a>.
                        </p>
                        <br/>
                    </div>

                </div>
            </>
        );
    }

}

/*
<div id={"login-page-carousel-container"}>
                        <AliceCarousel mouseTracking items={items} />
                    </div>
 */

LoginPageContent.propTypes = {
};

export default LoginPageContent;
