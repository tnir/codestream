import React, { Component } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import _ from "underscore";
import {
	changeStreamMuteState,
	closeDirectMessage,
	createStream,
	muteAllConversations,
	setCurrentStream,
	setUserPreference
} from "./actions";
import {
	getChannelStreamsForTeam,
	getDirectMessageStreamsForTeam,
	getServiceStreamsForTeam,
	getDMName
} from "../reducers/streams";
import { isActiveMixin, mapFilter, toMapBy } from "../utils";
import Icon from "./Icon";
import Tooltip from "./Tooltip";
import Debug from "./Debug";
import Menu from "./Menu";
import ChannelMenu from "./ChannelMenu";

export class SimpleChannelPanel extends Component {
	constructor(props) {
		super(props);

		this.state = {
			expanded: {
				knowledgeBase: true,
				teamChannels: true,
				directMessages: true,
				liveShareSessions: true,
				unreads: true
			}
		};
		this._channelPanel = React.createRef();
	}

	isActive = isActiveMixin("channels", this.constructor.name);

	shouldComponentUpdate(nextProps) {
		return this.isActive(this.props, nextProps);
	}

	render() {
		const teamName = this.props.team ? this.props.team.name : "";

		const channelPanelClass = createClassString({
			panel: true,
			"channel-panel": true,
			shrink: this.props.activePanel !== "channels",
			muted: this.props.muteAll
		});

		let menuItems = [
			{ label: "All Conversations", action: "set-channels-all" },
			{ label: "Unreads & Starred Conversations", action: "set-channels-unreads-starred" },
			{ label: "Unread Conversations", action: "set-channels-unreads" },
			{ label: "Selected Conversations", action: "set-channels-selected" }
		];

		return (
			<div className={channelPanelClass} ref={this._channelPanel}>
				<div className="filters">
					<Tooltip title="Mute All" placement="left">
						<label
							htmlFor="toggle"
							className={createClassString("switch", {
								checked: !this.props.muteAll
							})}
							onClick={this.toggleMuteAll}
						/>
					</Tooltip>
					Show{" "}
					<span className="filter" onClick={this.toggleMenu}>
						all conversations
						<Icon name="triangle-down" className="triangle-down" />
						{this.state.menuOpen && (
							<Menu
								items={menuItems}
								target={this.state.menuTarget}
								action={this.handleSelectMenu}
								align="left"
							/>
						)}
					</span>
				</div>
				<div className="shadow-overlay">
					<div className="shadow-container">
						<div className="shadow shadow-top" />
						<div className="shadow shadow-bottom" />
					</div>
					<div className="channel-list vscroll">
						{this.renderKnowledgeBase()}
						{this.renderUnreadChannels()}
						{this.renderTeamChannels()}
						{this.renderDirectMessages()}
						{this.renderServiceChannels()}
						<div className="shadow-cover-bottom" />
					</div>
				</div>
			</div>
		);
	}

	toggleMuteAll = () => {
		this.props.muteAllConversations(!this.props.muteAll);
	};

	toggleMenu = event => {
		this.setState({ menuOpen: !this.state.menuOpen, menuTarget: event.target });
	};

	handleSelectMenu = action => {
		this.setState({ menuOpen: false });
	};

	toggleSection = (e, section) => {
		e.stopPropagation();
		this.setState({
			expanded: { ...this.state.expanded, [section]: !this.state.expanded[section] }
		});
	};

	renderUnreadChannels = () => {
		return;
		// return (
		// 	<div className="section">
		// 		<div className="header">
		// 			<Tooltip title="All Channels With Unread Messages" placement="left" delay="0.5">
		// 				<span className="clickable">UNREADS</span>
		// 			</Tooltip>
		// 		</div>
		// 		<ul onClick={this.handleClickSelectStream}>
		// 			{this.renderStreams(this.props.channelStreams)}
		// 		</ul>
		// 	</div>
		// );
	};

	renderKnowledgeBase = () => {
		return null;
		return (
			<div
				className={createClassString("section", "has-children", {
					expanded: this.state.expanded["knowledgeBase"]
				})}
			>
				<div className="header top" onClick={e => this.toggleSection(e, "knowledgeBase")}>
					<Icon name="triangle-right" className="triangle-right" />
					<span className="clickable">Knowledge Base</span>
					<div className="align-right">
						<Tooltip title="Add to Knowledge Base" placement="bottom">
							<Icon name="plus" onClick={this.handleClickCreateKnowledge} />
						</Tooltip>
					</div>
				</div>
				{this.renderKnowledgeItems()}
			</div>
		);
	};

	renderKnowledgeItems = () => {
		return (
			<ul onClick={this.handleClickSelectKnowledge}>
				<li key="comment" id="comment">
					<Icon name="comment" className="comment" />
					Code Comments
				</li>
				<li key="question" id="question">
					<Icon name="question" className="question" />
					Questions &amp; Answers
				</li>
				<li key="issue" id="issue">
					<Icon name="issue" className="issue" />
					Issues
				</li>
				<li key="trap" id="trap">
					<Icon name="trap" className="trap" />
					Code Traps
				</li>
				<li key="bookmark" id="bookmark">
					<Icon name="bookmark" className="bookmark" />
					Bookmarks
				</li>
			</ul>
		);
		// 	<li key="pin" id="pin">
		// 	<Icon name="pin" className="pin" />
		// 	Pinned Posts
		// </li>
		// <li key="snippet" id="snippet">
		// 	<Icon name="code" className="snippet" />
		// 	Snippets
		// </li>
	};

	renderUnreadChannels = () => {
		return;
		// return (
		// 	<div className="section">
		// 		<div className="header">
		// 			<Tooltip title="All Channels With Unread Messages" placement="left" delay=".5">
		// 				<span className="clickable">UNREADS</span>
		// 			</Tooltip>
		// 		</div>
		// 		<ul onClick={this.handleClickSelectStream}>
		// 			{this.renderStreams(this.props.channelStreams)}
		// 		</ul>
		// 	</div>
		// );
	};

	renderTeamChannels = () => {
		return (
			<div
				className={createClassString("section", "has-children", {
					expanded: this.state.expanded["teamChannels"]
				})}
			>
				<div className="header top" onClick={e => this.toggleSection(e, "teamChannels")}>
					<Icon name="triangle-right" className="triangle-right" />
					<span className="clickable">Channels</span>
					<div className="align-right">
						<Tooltip title="Browse Public Channels" placement="bottomRight">
							<span>
								<Icon name="list-unordered" onClick={this.handleClickShowPublicChannels} />
							</span>
						</Tooltip>
						<Tooltip title="Create a Channel" placement="bottomRight">
							<span>
								<Icon name="plus" onClick={this.handleClickCreateChannel} />
							</span>
						</Tooltip>
					</div>
				</div>
				<ul onClick={this.handleClickSelectStream}>
					{this.renderStreams(this.props.channelStreams)}
				</ul>
			</div>
		);
	};

	renderServiceChannels = () => {
		if (this.props.serviceStreams.length === 0) return null;

		return (
			<div
				className={createClassString("section", "has-children", {
					expanded: this.state.expanded["liveShareSessions"]
				})}
			>
				<div className="header" onClick={e => this.toggleSection(e, "liveShareSessions")}>
					<Icon name="triangle-right" className="triangle-right" />
					<span className="clickable">Live Share Sessions</span>
				</div>
				<ul onClick={this.handleClickSelectStream}>
					{this.renderStreams(this.props.serviceStreams)}
				</ul>
			</div>
		);
	};

	renderStreams = streams => {
		return streams.map(stream => {
			if (stream.isArchived) return null;

			// FIXME remove this line once we're sure there are no PROD streams of this type
			// no new ones are being created
			if (stream.name.match(/^ls:/)) return null;

			const icon = this.props.mutedStreams[stream.id] ? (
				<Icon className="mute" name="mute" />
			) : stream.privacy === "private" ? (
				<Icon className="lock" name="lock" />
			) : stream.serviceType === "vsls" ? (
				<Icon className="broadcast" name="broadcast" />
			) : (
				<span className="icon hash">#</span>
			);
			let count = this.props.umis.unreads[stream.id] || 0;
			if (this.props.mutedStreams[stream.id]) count = 0;
			let mentions = this.props.umis.mentions[stream.id] || 0;
			let menuActive = this.state.openMenu === stream.id;
			return (
				<li
					className={createClassString({
						active: menuActive ? true : false,
						muted: this.props.mutedStreams[stream.id],
						unread: count > 0
					})}
					key={stream.id}
					id={stream.id}
				>
					{icon}
					<Debug text={stream.id}>{stream.name}</Debug>
					{mentions > 0 ? <span className="umi">{mentions}</span> : null}
					<span>
						<Tooltip title="Channel Settings">
							<Icon name="gear" className="align-right" onClick={this.handleClickStreamSettings} />
						</Tooltip>
						{menuActive && (
							<ChannelMenu
								stream={stream}
								target={this.state.menuTarget}
								umiCount={count}
								isMuted={this.props.mutedStreams[stream.id]}
								setActivePanel={this.props.setActivePanel}
								runSlashCommand={this.props.runSlashCommand}
								closeMenu={this.closeMenu}
							/>
						)}
					</span>
				</li>
			);
		});
	};

	renderDirectMessages = () => {
		const now = new Date().getTime();
		const futureTimestamp = 32503698000000; // Jan 1, 3000

		let canUseTimestamp = true;
		let dms = mapFilter(this.props.directMessageStreams, stream => {
			let count = this.props.umis.unreads[stream.id] || 0;
			// let mentions = this.props.umis.mentions[stream.id] || 0;
			if (this.props.mutedStreams[stream.id]) {
				// if you have muted a stream, check to see if there is a UMI.
				// if so, unmute the stream. if not, don't display it.
				if (count) this.props.changeStreamMuteState(stream.id, false);
				else return null;
			}

			let icon;
			if (stream.name === "slackbot") {
				icon = <Icon className="heart active" name="heart" />;
			} else if (stream.memberIds == null || stream.memberIds.length > 2) {
				icon = <Icon className="organization" name="organization" />;
			} else {
				const presence = this.props.streamPresence[stream.id];
				if (presence) {
					const className = `person ${presence}`;
					icon = <Icon className={className} name="person" />;
				} else {
					icon = <Icon className="person" name="person" />;
				}
			}

			const isMeStream = stream.id === this.props.meStreamId;

			let sortName;
			let sortPriority;
			let sortTimestamp;
			if (this.props.isSlackTeam) {
				sortTimestamp = stream.mostRecentPostCreatedAt;
				if (sortTimestamp == null) {
					canUseTimestamp = false;
				}
				sortPriority = stream.priority;

				if (stream.name === "slackbot") {
					sortTimestamp = futureTimestamp + 1;
					sortPriority = 100;
					sortName = ".";
				} else if (isMeStream) {
					sortTimestamp = futureTimestamp;
					sortPriority = 99;
					sortName = "..";
				} else {
					sortName = stream.name ? stream.name.toLowerCase() : "";
				}

				if (count) {
					sortPriority += 1;
					if (sortTimestamp != null) {
						sortTimestamp = now + (now - sortTimestamp);
					}
				}
			} else {
				sortTimestamp = isMeStream
					? futureTimestamp
					: stream.mostRecentPostCreatedAt || stream.modifiedAt || 1;
				sortPriority = 0;

				if (isMeStream) {
					sortName = "..";
				} else {
					sortName = stream.name ? stream.name.toLowerCase() : "";
				}

				if (count) {
					if (sortTimestamp != null) {
						sortTimestamp = now + (now - sortTimestamp);
					}
				}
			}

			return {
				sortName,
				sortPriority,
				sortTimestamp,
				element: (
					<li
						className={createClassString({
							direct: true,
							unread: count > 0
						})}
						key={stream.id}
						id={stream.id}
					>
						<Debug text={stream.id}>
							{icon}
							{stream.name} {isMeStream && <span className="you"> (you)</span>}
							{count > 0 ? <span className="umi">{count}</span> : null}
							<Tooltip title="Close Conversation">
								<Icon
									name="x"
									onClick={this.handleClickCloseDirectMessage}
									className="align-right"
								/>
							</Tooltip>
						</Debug>
					</li>
				)
			};
		});

		// Sort the streams by our best priority guess, then truncate and sort alphabetically
		if (canUseTimestamp) {
			dms.sort((a, b) => b.sortTimestamp - a.sortTimestamp);
		} else {
			dms.sort((a, b) => a.sortPriority - b.sortPriority);
		}
		dms = dms.slice(0, 20);
		dms.sort((a, b) => a.sortName.localeCompare(b.sortName));

		return (
			<div
				className={createClassString("section", "has-children", {
					expanded: this.state.expanded["directMessages"]
				})}
			>
				<div className="header" onClick={e => this.toggleSection(e, "directMessages")}>
					<Icon name="triangle-right" className="triangle-right" />
					<span className="clickable">Direct Messages</span>
					<div className="align-right">
						<Tooltip title="Open a direct message" placement="bottom" delay="0.5">
							<span>
								<Icon name="plus" onClick={this.handleClickCreateDirectMessage} />
							</span>
						</Tooltip>
					</div>
				</div>
				<ul onClick={this.handleClickSelectStream}>
					{dms.map(stream => stream.element)}
					<li className="invite" onClick={() => this.props.setActivePanel("invite")}>
						<span>
							<Icon name="plus-small" />
							{this.props.isSlackTeam ? "Invite People to CodeStream" : "Invite People"}
						</span>
					</li>
				</ul>
			</div>
		);
	};

	handleClickCreateKnowledge = e => {
		e.stopPropagation();
		this.props.setMultiCompose(true);
		// this.props.setActivePanel("main");
		// setTimeout(() => {
		// 	this.props.runSlashCommand("multi-compose");
		// }, 500);
		return;
	};

	handleClickSelectStream = event => {
		event.preventDefault();
		var liDiv = event.target.closest("li");
		if (!liDiv) return; // FIXME throw error
		if (liDiv.id) {
			this.props.setActivePanel("main");
			this.props.setCurrentStream(liDiv.id);
		} else if (liDiv.getAttribute("teammate")) {
			this.props.createStream({ type: "direct", memberIds: [liDiv.getAttribute("teammate")] });
		} else {
			console.log("Unknown LI in handleClickSelectStream: ", event);
		}
	};

	handleClickSelectKnowledge = event => {
		event.preventDefault();
		var liDiv = event.target.closest("li");
		if (!liDiv) return; // FIXME throw error
		if (liDiv.id) {
			this.props.setActivePanel("knowledge");
			this.props.setKnowledgeType(liDiv.id);
		} else {
			console.log("Unknown LI in handleClickSelectKnowledge: ", event);
		}
	};

	handleClickCreateChannel = e => {
		e.stopPropagation();
		this.props.setActivePanel("create-channel");
	};

	handleClickShowPublicChannels = e => {
		e.stopPropagation();
		this.props.setActivePanel("public-channels");
	};

	handleClickCreateDirectMessage = e => {
		e.stopPropagation();
		this.props.setActivePanel("create-dm");
	};

	handleClickStreamSettings = event => {
		var liDiv = event.target.closest("li");
		if (!liDiv || !liDiv.id) return; // FIXME throw error
		this.setState({ openMenu: liDiv.id, menuTarget: event.target });
		event.stopPropagation();
		return true;
	};

	handleClickCloseDirectMessage = event => {
		event.stopPropagation();
		var liDiv = event.target.closest("li");
		if (!liDiv) return; // FIXME throw error
		const id = liDiv.id || liDiv.getAttribute("teammate");
		this.props.closeDirectMessage(id);
	};

	findStream = streamId => {
		return (
			this.props.channelStreams.find(stream => stream.id === streamId) ||
			this.props.directMessageStreams.find(stream => stream.id === streamId)
		);
	};

	closeMenu = () => {
		this.setState({ openMenu: null });
	};
}

const mapStateToProps = ({
	configs,
	context,
	preferences,
	streams,
	users,
	teams,
	umis,
	session
}) => {
	const team = teams[context.currentTeamId];

	const teamMembers = team.memberIds.map(id => users[id]).filter(Boolean);
	// .filter(user => user && user.isRegistered);

	const channelStreams = _.sortBy(
		getChannelStreamsForTeam(streams, context.currentTeamId, session.userId) || [],
		stream => (stream.name || "").toLowerCase()
	);

	let meStreamId;
	let streamPresence = Object.create(null);
	const directMessageStreams = mapFilter(
		getDirectMessageStreamsForTeam(streams, context.currentTeamId) || [],
		stream => {
			if (
				stream.isClosed ||
				(stream.memberIds != null &&
					stream.memberIds.some(id => users[id] != null && users[id].deactivated))
			) {
				return;
			}

			if (stream.memberIds != null && stream.memberIds.length <= 2) {
				// this is my stream with myself, if it exists
				if (stream.memberIds.length === 1 && stream.memberIds[0] === session.userId) {
					meStreamId = stream.id;
					streamPresence[stream.id] = users[session.userId].presence;
				} else {
					const id = stream.memberIds[stream.memberIds[0] === session.userId ? 1 : 0];
					streamPresence[stream.id] = users[id].presence;
				}
			}

			return {
				...stream,
				name: getDMName(stream, toMapBy("id", teamMembers), session.userId)
			};
		}
	);

	const serviceStreams = _.sortBy(
		getServiceStreamsForTeam(streams, context.currentTeamId, session.userId, users) || [],
		stream => -stream.createdAt
	);

	return {
		umis,
		users,
		channelStreams,
		directMessageStreams,
		serviceStreams,
		muteAll: configs.muteAll,
		mutedStreams: preferences.mutedStreams || {},
		meStreamId,
		streamPresence,
		team: team
	};
};

export default connect(
	mapStateToProps,
	{
		changeStreamMuteState,
		closeDirectMessage,
		createStream,
		setUserPreference,
		setCurrentStream,
		muteAllConversations
	}
)(SimpleChannelPanel);
