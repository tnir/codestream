import React, { PropsWithChildren, useCallback, useEffect, useState } from "react";
import Icon from "./Icon";
import { FetchThirdPartyPullRequestPullRequest } from "@codestream/protocols/agent";
import { api, getPullRequestFiles } from "../store/providerPullRequests/actions";
import { useDispatch, useSelector } from "react-redux";
import { PRDiffHunk } from "./PullRequestFilesChangedList";
import { PullRequestPatch } from "./PullRequestPatch";
import { Link } from "./Link";
import copy from "copy-to-clipboard";
import { FileStatus } from "@codestream/protocols/api";
import { CodeStreamState } from "../store";
import styled from "styled-components";
import { Modal } from "./Modal";
import { Dialog } from "../src/components/Dialog";
import { PullRequestFileCommentCard } from "./PullRequestFileCommentCard";
import { useDidMount } from "../utilities/hooks";

const Root = styled.div`
	background: var(--app-background-color);
	box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2);
	.vscode-dark & {
		box-shadow: 0 5px 10px rgba(0, 0, 0, 0.5);
	}
`;

const CommentsContainer = styled.div`
	margin: 0 0 20px 0;
	h1 {
		display: flex;
		align-items: center;
		border-radius: 5px 5px 0 0;
		font-size: 12px;
		font-weight: normal;
		margin: 0;
		padding: 10px;
		background: var(--app-background-color);
		border: 1px solid var(--base-border-color);
		width: 100%;
		overflow: hidden;
		position: sticky;
		top: -14px;
		z-index: 5;
		.filename-container {
			overflow: hidden;
			text-overflow: ellipsis;
		}
		&.hidden {
			border-radius: 5px;
		}
		.toggle {
			display: inline-block;
			margin-right: 5px;
			margin-top: -2px;
		}
		.viewed {
			flex-shrink: 0;
			margin-left: auto;
		}
		a .icon {
			color: var(--text-color);
		}
	}
`;

const CardContainer = styled.div`
	margin: 10px 10px 15px 10px;
	padding: 10px;
	background: var(--base-background-color);
	border-radius: 6px;
`;

const STATUS_MAP = {
	modified: FileStatus.modified
};

interface Props {
	pr: FetchThirdPartyPullRequestPullRequest;
	setIsLoadingMessage: Function;
	commentId: string | undefined;
	quote: Function;
	onClose: Function;
	prCommitsRange?: string[];
}

export const PullRequestFileComments = (props: PropsWithChildren<Props>) => {
	const { quote, pr, prCommitsRange } = props;
	const dispatch = useDispatch();

	const derivedState = useSelector((state: CodeStreamState) => {
		return {
			providerPullRequests: state.providerPullRequests.pullRequests,
			pullRequestFilesChangedMode: state.preferences.pullRequestFilesChangedMode || "files",
			currentPullRequestProviderId: state.context.currentPullRequest
				? state.context.currentPullRequest.providerId
				: undefined,
			currentPullRequestId: state.context.currentPullRequest
				? state.context.currentPullRequest.id
				: undefined
		};
	});

	const [isLoading, setIsLoading] = useState(true);
	const [fileInfo, setFileInfo] = useState<any>({});
	const [filename, setFilename] = useState("");

	const _mapData = data => {
		const fileInfo = data
			.filter(_ => _.filename === filename)
			.map(_ => {
				return {
					..._,
					linesAdded: _.additions,
					linesRemoved: _.deletions,
					file: _.filename,
					sha: _.sha,
					status: STATUS_MAP[_.status]
				};
			});
		setFileInfo(fileInfo[0]);
		setIsLoading(false);
	};

	useDidMount(() => {
		(async () => {
			const data = await dispatch(
				getPullRequestFiles(pr.providerId, derivedState.currentPullRequestId!)
			);
			_mapData(data);
		})();
	});

	const commentMap = React.useMemo(() => {
		const map = {} as any;
		if (
			derivedState.currentPullRequestProviderId === "gitlab*com" ||
			derivedState.currentPullRequestProviderId === "gitlab/enterprise"
		) {
			(pr as any).discussions.nodes.forEach((review: any) => {
				if (review.notes && review.notes.nodes) {
					review.notes.nodes.forEach((comment: any) => {
						const position = comment.position;
						if (position) {
							if (!map[position.newPath]) map[position.newPath] = [];
							map[position.newPath].push({
								review: {
									state: comment.state
								},
								comment: comment
							});
							if (
								comment.id === props.commentId ||
								comment.id.toString().replace("gid://gitlab/DiffNote/", "") === props.commentId
							) {
								setFilename(comment.position.newPath);
							}
						}
					});
				}
			});
		} else {
			const reviews = pr
				? pr.timelineItems.nodes.filter(node => node.__typename === "PullRequestReview")
				: [];
			reviews.forEach(review => {
				if (!review.comments) return;
				review.comments.nodes.forEach(comment => {
					if (!map[comment.path]) map[comment.path] = [];
					map[comment.path].push({ review, comment });
					if (comment.id === props.commentId || comment.threadId === props.commentId)
						setFilename(comment.path);
				});
			});
		}
		return map;
	}, [pr, pr?.updatedAt]);

	if (!filename) return null;

	const commentsArray = commentMap[filename];

	let commentsSortedByLineNumber = commentsArray;
	commentsSortedByLineNumber.sort((a, b) => (a.comment.position > b.comment.position ? 1 : -1));

	return (
		<Modal translucent onClose={() => props.onClose()}>
			<Root>
				<CommentsContainer>
					<>
						<h1>
							<span className="filename-container">
								<span className="filename">{filename}</span>{" "}
								<Icon
									title="Copy File Path"
									placement="bottom"
									name="copy"
									className="clickable"
									onClick={e => copy(filename)}
								/>{" "}
							</span>
						</h1>

						{commentsSortedByLineNumber.map((c, index) => {
							const isFirst = index === 0;

							return (
								<CardContainer>
									<PullRequestFileCommentCard
										pr={pr}
										comment={c.comment}
										review={c.review}
										setIsLoadingMessage={props.setIsLoadingMessage}
										author={c?.author?.login || ""}
										isFirst={isFirst}
										fileInfo={fileInfo}
										prCommitsRange={prCommitsRange}
									/>
								</CardContainer>
							);
						})}
					</>
				</CommentsContainer>
			</Root>
		</Modal>
	);
};
