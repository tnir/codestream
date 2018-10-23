import React, { Component } from "react";
import { connect } from "react-redux";
import * as contextActions from "../actions/context";
import * as streamActions from "./actions";
import createClassString from "classnames";
import {
	getChannelStreamsForTeam,
	getPublicChannelStreamsForTeam,
	getArchivedChannelStreamsForTeam
} from "../reducers/streams";
import Icon from "./Icon";
import _ from "underscore";
import Timestamp from "./Timestamp";
import Tooltip from "./Tooltip";
import { isActiveMixin } from "../utils";

export class SimplePublicChannelPanel extends Component {
	constructor(props) {
		super(props);

		this.state = { loading: null };
	}

	isActive = isActiveMixin("public-channels", this.constructor.name);

	shouldComponentUpdate(nextProps) {
		return this.isActive(this.props, nextProps);
	}

	render() {
		const inactive = this.props.activePanel !== "public-channels";
		const shrink = this.props.activePanel === "main" || this.props.activePanel == "create-channel";

		const panelClass = createClassString({
			panel: true,
			"public-channel-panel": true,
			shrink,
			"off-right": inactive && !shrink
		});

		// 	<span onClick={this.showChannels} className="align-left-button">
		// 	<Icon name="chevron-left" className="show-channels-icon" />
		// </span>
		// <span className="panel-title">All Channels</span>
		// <span onClick={this.handleClickCreateChannel} className="align-right-button">
		// 	<Tooltip title="Create a Channel" placement="bottom" delay="0.5">
		// 		<span>
		// 			<Icon name="plus" />
		// 		</span>
		// 	</Tooltip>
		// </span>
		return (
			<div className={panelClass}>
				<div className="filters">
					<span
						onClick={() => this.props.setActivePanel("channels")}
						className="align-right-button"
					>
						<Tooltip title="Cancel" placement="bottom" delay="0.5">
							<span>
								<Icon name="x" className="button" />
							</span>
						</Tooltip>
					</span>
					Channels are where your dev team discusses projects, repos, or code in general. You might
					create one channel per repo, or one per client.
				</div>
				<div className="channel-list postslist vscroll">
					<div className="section">
						<div className="header">Channels you can join</div>
						<ul onClick={this.handleClickJoinStream}>
							{this.renderChannels(this.props.publicStreams)}
						</ul>
					</div>
					<div className="section">
						<div className="header">Channels you are in</div>
						<ul onClick={this.handleClickSelectStream}>
							{this.renderChannels(this.props.channelStreams)}
						</ul>
					</div>
					{!this.props.isSlackTeam && (
						<div className="section">
							<div className="header">Archived Channels</div>
							<ul onClick={this.handleClickUnArchive}>
								{this.renderChannels(this.props.archivedStreams)}
							</ul>
						</div>
					)}
				</div>
			</div>
		);
	}

	renderChannels = streams => {
		if (streams.length === 0) {
			return <div className="no-matches">No channels match this type</div>;
		}
		return [
			streams.map(stream => {
				if (stream.name.match(/^ls:/)) return null;
				const icon =
					stream.id && stream.id === this.state.loading ? (
						<Icon className="spin" name="sync" />
					) : stream.privacy === "private" ? (
						<Icon className="lock" name="lock" />
					) : (
						<span className="icon hash">#</span>
					);
				// const icon =
				// 	stream.privacy === "private" ? (
				// 		<span className="icon icon-lock" />
				// 	) : (
				// 		<span className="icon">#</span>
				// 	);
				return (
					<li key={stream.id} id={stream.id}>
						{icon}
						{stream.name}
						<Timestamp time={stream.mostRecentPostCreatedAt} />
						<div className="explainer">{stream.purpose}</div>
					</li>
				);
			})
		];
	};

	handleClickSelectStream = event => {
		var liDiv = event.target.closest("li");
		if (!liDiv || !liDiv.id) return; // FIXME throw error
		this.props.setActivePanel("main");
		this.props.setCurrentStream(liDiv.id);
	};

	handleClickJoinStream = async event => {
		var liDiv = event.target.closest("li");
		if (!liDiv || !liDiv.id) return; // FIXME throw error
		this.setState({ loading: liDiv.id });
		await this.props.joinStream(liDiv.id);
		this.setState({ loading: null });
		this.props.setCurrentStream(liDiv.id);
	};

	showChannels = event => {
		this.props.setActivePanel("channels");
	};

	handleClickCreateChannel = event => {
		this.props.setActivePanel("create-channel");
		event.stopPropagation();
	};
}

const mapStateToProps = ({ context, streams, users, teams, umis, session }) => {
	const teamMembers = teams[context.currentTeamId].memberIds.map(id => users[id]).filter(Boolean);

	const channelStreams = _.sortBy(
		getChannelStreamsForTeam(streams, context.currentTeamId, session.userId) || [],
		stream => stream.name.toLowerCase()
	);

	const publicStreams = _.sortBy(
		getPublicChannelStreamsForTeam(streams, context.currentTeamId, session.userId) || [],
		stream => stream.name.toLowerCase()
	);

	const archivedStreams = _.sortBy(
		getArchivedChannelStreamsForTeam(streams, context.currentTeamId, session.userId) || [],
		stream => stream.name.toLowerCase()
	);

	return {
		umis,
		session,
		channelStreams,
		publicStreams,
		archivedStreams,
		teammates: teamMembers,
		team: teams[context.currentTeamId]
	};
};

export default connect(
	mapStateToProps,
	{
		...contextActions,
		...streamActions
	}
)(SimplePublicChannelPanel);
