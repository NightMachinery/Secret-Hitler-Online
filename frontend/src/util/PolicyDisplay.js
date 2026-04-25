import React, { Component } from "react";
import PropTypes from "prop-types";
import "./PolicyDisplay.css";
import { ANARCHIST, LIBERAL } from "../constants";
import LiberalPolicy from "../assets/policy-liberal.png";
import FascistPolicy from "../assets/policy-fascist.png";
import AnarchistPolicy from "../assets/policy-anarchist.svg";

class PolicyDisplay extends Component {
	render() {
		return (
			<div id={"legislative-policy-container"}>
				{this.props.policies.map((value, index) => {
					let policyName =
						value === LIBERAL ? "liberal" : value === ANARCHIST ? "anarchist" : "fascist";
					let policyImage =
						value === LIBERAL ? LiberalPolicy : value === ANARCHIST ? AnarchistPolicy : FascistPolicy;
					return (
						<img
							id={"legislative-policy"}
							key={index}
							className={
								this.props.allowSelection
									? "selectable " +
									  (index === this.props.selection ? " selected" : "")
									: ""
							}
							onClick={() => this.props.onClick(index)}
							disabled={!this.props.allowSelection}
							src={policyImage}
							alt={
								"A " +
								policyName +
								" policy." +
								(this.props.allowSelection ? " Click to select." : "")
							}
						/>
					);
				})}
			</div>
		);
	}
}

PolicyDisplay.propTypes = {
	policies: PropTypes.array.isRequired,
	onClick: PropTypes.func, // If undefined, the policies cannot be selected.
	selection: PropTypes.number,
	allowSelection: PropTypes.bool,
};

export default PolicyDisplay;
