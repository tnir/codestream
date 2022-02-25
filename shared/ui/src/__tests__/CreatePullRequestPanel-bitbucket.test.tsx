import React from "react";
import { render, unmountComponentAtNode } from "react-dom";
import { act } from "react-dom/test-utils";
import { Provider } from "react-redux";
import configureStore from "redux-mock-store";

import { waitFor } from "@testing-library/react";

import { setupCommunication } from "../../index";
import { CreatePullRequestPanel } from "../../Stream/CreatePullRequestPanel";

import { HostApi } from "../../webview-api";
// HostApi is now a mock constructor
jest.mock("../../webview-api");

setupCommunication({
	postMessage: function() {}
});

let container: any = undefined;
beforeEach(() => {
	// setup a DOM element as a render target
	container = document.createElement("div");
	document.body.appendChild(container);

	HostApi.instance = {};
	HostApi.mockClear();
});

afterEach(() => {
	// cleanup on exiting
	unmountComponentAtNode(container);
	container.remove();
	container = undefined;
});

const storeFactory = () => {
	return {
		context: { currentTeamId: "", currentPullRequest: undefined },
		providers: {
			github: {},
			gitlab: {},
			"gitlab*com": {
				name: "GitLab"
			},
			github_enterprise: {},
			gitlab_enterprise: {},
			bitbucket: {},
			"bitbucket*org": {
				name: "BitBucket"
			},
			bitbucket_server: {}
		},
		repos: {},
		providerPullRequests: {},
		ide: {
			name: "VSC"
		},
		configs: {},
		users: {
			"123": {
				status: {}
			}
		},
		session: {
			userId: "123"
		},
		preferences: {
			pullRequestFilesChangedMode: "files"
		}
	};
};

it("renders default state 2", async () => {
	let mockFoo = {
		send: async (a: { method: string }, b, c) => {
			if (a.method === "codestream/scm/latestCommit") {
				return {
					shortMesssage: "shortMessage"
				};
			} else if (a.method === "codestream/review/pr/checkPreconditions") {
				return {
					success: true,
					repo: {
						id: "61fac86ad537c93d8bb9bf8a",
						remoteUrl: "//bitbucket.org/TeamCodeStream/a",
						remotes: [
							{
								repoPath: "/Users/TeamCodeStream/code/a",
								name: "origin",
								scheme: "https://",
								domain: "bitbucket.org",
								path: "TeamCodeStream/a",
								types: [
									{
										url: "https://bitbucket.org/TeamCodeStream/a.git",
										type: "fetch"
									},
									{
										url: "https://bitbucket.org/TeamCodeStream/a.git",
										type: "push"
									}
								],
								uri: {
									$mid: 1,
									external: "https://bitbucket.org/TeamCodeStream/a.git",
									path: "/TeamCodeStream/a.git",
									scheme: "https",
									authority: "bitbucket.org"
								}
							},
							{
								repoPath: "/Users/TeamCodeStream/code/a",
								name: "private",
								scheme: "https://",
								domain: "bitbucket.org",
								path: "TeamCodeStream/b",
								types: [
									{
										url: "https://bitbucket.org/TeamCodeStream/b.git",
										type: "fetch"
									},
									{
										url: "https://bitbucket.org/TeamCodeStream/b.git",
										type: "push"
									}
								],
								uri: {
									$mid: 1,
									external: "https://bitbucket.org/TeamCodeStream/b.git",
									path: "/TeamCodeStream/b.git",
									scheme: "https",
									authority: "bitbucket.org"
								}
							}
						],
						remoteBranch: "origin/foo",
						branches: ["foo", "master", "private"],
						branch: "foo",
						remoteBranches: [
							{
								remote: "origin",
								branch: "foo"
							},
							{
								remote: "origin",
								branch: "master"
							},
							{
								remote: "private",
								branch: "asdf"
							},
							{
								remote: "private",
								branch: "master"
							}
						]
					},
					provider: {
						id: "bitbucket*org",
						isConnected: true,
						pullRequestTemplateNames: [],
						pullRequestTemplatePath: "",

						repo: {
							defaultBranch: "master"
						}
					},
					review: {
						title: "",
						text: ""
					},

					commitsBehindOriginHeadBranch: "0"
				};
			} else if (a.method === "codestream/scm/repos") {
				return {
					repositories: [
						{
							id: "61fac86ad537c93d8bb9bf8a",
							path: "/Users/TeamCodeStream/code/a",
							folder: {
								uri: "file:///Users/TeamCodeStream/code/a",
								name: "a"
							},
							root: true,
							providerId: "bitbucket*org"
						}
					]
				};
			}
			return new Promise(resolve => resolve(true));
		},
		on: () => {}
	};
	HostApi.mockImplementation(() => {
		return mockFoo;
	});
	// YUCK yuck yuck, static singletons are bad bad bad for testing
	HostApi.instance = mockFoo;

	const mockStore = configureStore();

	act(() => {
		// @ts-ignore
		render(
			<Provider store={mockStore(storeFactory())}>
				{/* // @ts-ignore */}
				<CreatePullRequestPanel closePanel={e => {}} />{" "}
			</Provider>,
			container
		);
	});
	await waitFor(() => {
		expect((container as any).textContent).toBe(
			"Open a Pull RequestChoose two branches to start a new pull request.destination: mastersource: fooCancelCreate Pull Request "
		);
	});
});
