import React, {Component} from 'react';
import './CustomAlert.css'

class CustomAlert extends Component {

    constructor(props) {
        super(props);
        this.state = {
            lastValueShow: false,
            backgroundClass: "",
            alertBoxClass: ""
        };
    }

    getClass() {
        if(this.props.show) {
            return "appear-custom-alert";
        } else {
            return "disappear-custom-alert";
        }
    }

    render() {
        const allowMinimize = Boolean(this.props.allowMinimize);
        const isMinimized = Boolean(this.props.show && allowMinimize && this.props.isMinimized);
        const shouldRenderExpandedAlert = !isMinimized;

        return (
            <>
                {shouldRenderExpandedAlert && (
                    <div id="alert" className={this.getClass()}>
                        <div id="alert-background" className={this.getClass()}/>
                        <div id="alert-box" className={this.getClass()}>
                            {allowMinimize && this.props.show && (
                                <div className={"alert-window-controls"}>
                                    <button
                                        type={"button"}
                                        className={"alert-window-control"}
                                        onClick={this.props.onMinimize}
                                        aria-label={"Minimize popup"}
                                        title={"Minimize popup"}
                                    >
                                        _
                                    </button>
                                </div>
                            )}
                            <div id="alert-box-content">
                                {this.props.children}
                            </div>
                        </div>
                    </div>
                )}

                {isMinimized && (
                    <div id="alert-restore-container" className="alert-restore-container-history-safe">
                        <button
                            type={"button"}
                            id={"alert-restore-button"}
                            onClick={this.props.onRestore}
                        >
                            RETURN TO POPUP
                        </button>
                    </div>
                )}
            </>
        );
    }
}

export default CustomAlert;
