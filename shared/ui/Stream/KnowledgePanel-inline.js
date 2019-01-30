import React, { Component } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import _ from "underscore";
import * as actions from "./actions";
import * as codemarkSelectors from "../store/codemarks/reducer";
import * as userSelectors from "../store/users/reducer";
import Icon from "./Icon";
import ScrollBox from "./ScrollBox";
import Codemark from "./Codemark";

export class SimpleKnowledgePanel extends Component {
	disposables = [];

	constructor(props) {
		super(props);

		this.state = {
			openPost: null,
			expanded: {
				inThisFile: true,
				recent: true,
				mine: true,
				open: true,
				closed: true,
				unanswered: true
			}
		};

		this.typeLabels = {
			comment: "Code Comments",
			question: "Frequently Asked Questions",
			issue: "Issues",
			trap: "Traps",
			snippet: "Snippets",
			bookmark: "Bookmarks"
		};
		this.typeLabelsLower = {
			all: "all codemarks",
			comment: "code comments",
			question: "faqs",
			issue: "issues",
			trap: "traps",
			snippet: "snippets",
			bookmark: "bookmarks"
		};
		this.fileFiltersLabelsLower = {
			current: "in current file only",
			unseparated: "from all files, unseparated",
			repo: "in the current repo only",
			all: "from all files"
		};
		this.sectionLabel = {
			inThisFile: "In This File",
			mine: "My Open Issues",
			open: "Open",
			recent: "Recent",
			closed: "Closed",
			unanswered: "Unanswered"
		};
		this.sectionsByType = {
			all: ["inThisFile", "mine", "recent"],
			comment: ["inThisFile", "mine", "recent"],
			question: ["inThisFile", "unanswered", "recent"],
			issue: ["inThisFile", "mine", "open", "recent", "closed"],
			trap: ["inThisFile", "recent"],
			bookmark: ["inThisFile", "recent"]
		};
		this.sectionsFilterOrder = {
			all: ["inThisFile", "mine", "recent"],
			comment: ["inThisFile", "mine", "recent"],
			question: ["inThisFile", "unanswered", "recent"],
			issue: ["closed", "inThisFile", "mine", "open", "recent"],
			trap: ["inThisFile", "recent"],
			bookmark: ["inThisFile", "recent"]
		};
	}

	componentDidMount() {
		this.props.fetchCodemarks();
		// this.disposables.push(
		// 	EventEmitter.subscribe("interaction:active-editor-changed", this.handleFileChangedEvent)
		// );
	}

	componentDidUpdate(prevProps, prevState) {
		if (!!prevProps.searchBarOpen === false && this.props.searchBarOpen) {
			requestAnimationFrame(() => this._searchInput.focus());
		}
	}

	componentWillUnmount() {
		this.disposables.forEach(d => d.dispose());
	}

	handleFileChangedEvent = body => {
		// if (body && body.editor && body.editor.fileName)
		// 	this.setState({ thisFile: body.editor.fileName, thisRepo: body.editor.repoId });
		// else this.setState({ thisFile: null });
	};

	toggleSection = (e, section) => {
		e.stopPropagation();
		this.setState({
			expanded: { ...this.state.expanded, [section]: !this.state.expanded[section] }
		});
	};

	renderPosts = codemarks => {
		const { typeFilter } = this.props;
		if (codemarks.length === 0)
			return <div className="no-matches">No {typeFilter}s in file foo/bar/baz.js</div>;
		else {
			return codemarks.map(codemark => {
				return (
					<Codemark
						key={codemark.id}
						codemark={codemark}
						collapsed={this.state.openPost !== codemark.id}
						currentUserName={this.props.currentUserName}
						usernames={this.props.usernames}
						onClick={this.handleClickCodemark}
						action={this.props.postAction}
						query={this.state.q}
					/>
					// <div key={codemark.id}>
					// 	<Post
					// 		id={codemark.postId}
					// 		streamId={codemark.streamId}
					// 		q={this.props.q}
					// 		showStatus={codemark.type === "issue"}
					// 		showAssigneeHeadshots={true}
					// 		alwaysShowReplyCount={!collapsed}
					// 		teammates={this.props.teammates}
					// 		collapsed={collapsed}
					// 		showFileAfterTitle={collapsed}
					// 		context="knowledge"
					// 		headshotSize={18}
					// 		usernames={this.props.usernames}
					// 		currentUserId={this.props.currentUserId}
					// 		currentUserName={this.props.currentUserName}
					// 		currentCommit={this.props.currentCommit}
					// 		action={this.props.postAction}
					// 	/>
					// </div>
				);
			});
		}
	};

	renderSection = (section, codemarks) => {
		if (codemarks.length === 0) return null;

		const sectionLabel =
			section === "inThisFile" && this.props.mostRecentSourceFile ? (
				<span>
					In This File: <span className="filename">{this.props.mostRecentSourceFile}</span>
				</span>
			) : (
				this.sectionLabel[section]
			);
		return (
			<div
				className={createClassString("section", "has-children", {
					expanded: this.state.expanded[section]
				})}
			>
				<div className="header" onClick={e => this.toggleSection(e, section)}>
					<Icon name="triangle-right" className="triangle-right" />
					<span className="clickable">{sectionLabel}</span>
				</div>
				<ul>{this.renderPosts(codemarks)}</ul>
			</div>
		);
	};

	render() {
		const { codemarks, currentUserId, mostRecentSourceFile, fileFilter, typeFilter } = this.props;
		const { thisRepo } = this.state;

		const sections = this.sectionsByType[typeFilter];

		let displayCodemarks = {};
		let assignedCodemarks = {};
		let sectionFilters = this.sectionsFilterOrder[typeFilter] || [];
		let totalCodemarks = 0;

		const assignCodemark = (codemark, section) => {
			if (!displayCodemarks[section]) displayCodemarks[section] = [];
			displayCodemarks[section].push(codemark);
			assignedCodemarks[codemark.id] = true;
			totalCodemarks++;
		};

		codemarks.forEach(codemark => {
			const codemarkType = codemark.type || "comment";
			if (codemark.deactivated) return null;
			if (typeFilter !== "all" && codemarkType !== typeFilter) return null;
			if (codemarkType === "comment" && (!codemark.markers || codemark.markers.length === 0))
				return null;
			const codeBlock = codemark.markers && codemark.markers.length && codemark.markers[0];

			const codeBlockFile = codeBlock && codeBlock.file;
			const codeBlockRepo = codeBlock && codeBlock.repoId;
			const title = codemark.title;
			const assignees = codemark.assignees;
			const status = codemark.status;
			sectionFilters.forEach(section => {
				if (assignedCodemarks[codemark.id]) return;
				// if (!this.state.expanded[section]) return;
				if (
					this.state.q &&
					!(codemark.text || "").includes(this.state.q) &&
					!(title || "").includes(this.state.q)
				)
					return;
				if (fileFilter === "current" && section !== "inThisFile") return;
				if (fileFilter === "repo" && codeBlockRepo !== thisRepo) return;
				if (fileFilter === "unseparated" && section === "inThisFile") return;
				switch (section) {
					case "inThisFile":
						if (mostRecentSourceFile && codeBlockFile === mostRecentSourceFile)
							assignCodemark(codemark, "inThisFile");
						break;
					case "mine":
						if (status === "open" && _.contains(assignees || [], currentUserId))
							assignCodemark(codemark, "mine");
						break;
					case "open":
						if (status === "open" || !status) assignCodemark(codemark, "open");
						break;
					case "unanswered":
						if (codemark.numReplies > 0) assignCodemark(codemark, "unanswered");
						break;
					case "recent":
						assignCodemark(codemark, "recent");
						break;
					case "closed":
						if (status === "closed") assignCodemark(codemark, "closed");
						break;
				}
			});
		});

		let typeMenuItems = [
			{ label: "All Codemarks", action: "all" },
			{ label: "-" },
			{ label: "Code Comments", action: "comment" },
			{ label: "Frequently Asked Questions", action: "question" },
			{ label: "Issues", action: "issue" },
			{ label: "Traps", action: "trap" },
			{ label: "Bookmarks", action: "bookmark" }
		];

		let fileMenuItems = [
			{ label: "From All Files", action: "all" },
			{ label: "From All Files, Unseparated", action: "unseparated" },
			// { label: "In Current Repo Only", action: "repo" },
			{ label: "In Current File Only", action: "current" }
		];

		return (
			<div className="panel knowledge-panel">
				{this.props.searchBarOpen && (
					<div className="search-bar">
						<input
							name="q"
							className="native-key-bindings input-text control"
							type="text"
							ref={ref => (this._searchInput = ref)}
							onChange={e => this.setState({ q: e.target.value })}
							placeholder="Search Codemarks"
						/>
					</div>
				)}
				{!this.props.searchBarOpen && (
					<div className="panel-header">{this.typeLabels[this.props.typeFilter]}</div>
				)}
				<ScrollBox>
					<div className="channel-list vscroll">
						{totalCodemarks > 0 &&
							sections.map(section => {
								return this.renderSection(section, displayCodemarks[section] || []);
							})}
						{!totalCodemarks && <div className="no-matches">No codemarks match this type.</div>}
					</div>
				</ScrollBox>
			</div>
		);
	}

	toggleShowMarkers = () => {
		const showMarkers = !this.props.showMarkers;
		this.props.showMarkersInEditor(showMarkers);
		// this.setState({ showMarkers });
	};

	handleClickCodemark = codemark => {
		if (codemark.markers) this.props.showCode(codemark.markers[0], true);
		this.props.setThread(codemark.streamId, codemark.parentPostId || codemark.postId);
		// const isOpen = this.state.openPost === id;
		// if (isOpen) this.setState({ openPost: null });
		// else {
		// this.setState({ openPost: id });
		// }
	};

	toggleStatus = id => {
		this.setState({
			statusPosts: { ...this.state.statusPosts, [id]: !this.state.statusPosts[id] }
		});
	};

	handleClickCreateKnowledge = e => {
		e.stopPropagation();
		this.props.setActivePanel("main");
		setTimeout(() => {
			this.props.runSlashCommand("multi-compose");
		}, 500);
		return;
	};

	handleClickSelectItem = event => {
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
}

const mapStateToProps = state => {
	const { context, teams, configs } = state;
	return {
		usernames: userSelectors.getUsernames(state),
		codemarks: codemarkSelectors.getTypeFilteredCodemarks(state),
		showMarkers: configs.showMarkers,
		team: teams[context.currentTeamId],
		fileFilter: context.codemarkFileFilter,
		mostRecentSourceFile: context.mostRecentSourceFile
	};
};

export default connect(
	mapStateToProps,
	actions
)(SimpleKnowledgePanel);
