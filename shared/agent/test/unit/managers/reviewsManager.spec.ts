import { describe, expect, it } from "@jest/globals";
import { ReviewsManager } from "../../../src/managers/reviewsManager";

describe("ReviewsManager.spec.ts", () => {
	describe("checkPullRequestPreconditions", () => {
		it("REPO_NOT_FOUND", async () => {
			const manager = new ReviewsManager({ onDidRequestReset: function() {} } as any);
			const response = await manager.checkPullRequestPreconditions({} as any, null, {
				session: {} as any,
				git: {},
				providerRegistry: {}
			} as any);

			expect(response.error?.type).toEqual("REPO_NOT_FOUND");
		});

		describe("with review", () => {
			it("HAS_LOCAL_MODIFICATIONS", async () => {
				const manager = new ReviewsManager({ onDidRequestReset: function() {} } as any);
				manager.getById = async function() {
					return {
						reviewChangesets: [
							{
								repoId: "123"
							}
						]
					} as any;
				};
				const response = await manager.checkPullRequestPreconditions(
					{
						reviewId: "123"
					} as any,
					null,
					{
						session: {} as any,
						git: {
							getHasLocalCommits: async function() {
								return false;
							},
							getHasModifications: async function() {
								return true;
							},
							getRepositoryById: async function() {
								return {};
							}
						},
						providerRegistry: {}
					} as any
				);

				expect(response.error?.type).toEqual("HAS_LOCAL_MODIFICATIONS");
			});

			it("HAS_LOCAL_COMMITS", async () => {
				const manager = new ReviewsManager({ onDidRequestReset: function() {} } as any);
				manager.getById = async function() {
					return {
						reviewChangesets: [
							{
								repoId: "123"
							}
						]
					} as any;
				};
				const response = await manager.checkPullRequestPreconditions(
					{
						reviewId: "123"
					} as any,
					null,
					{
						session: {} as any,
						git: {
							getHasLocalCommits: async function() {
								return true;
							},
							getHasModifications: async function() {
								return false;
							},
							getRepositoryById: async function() {
								return {};
							}
						},
						providerRegistry: {}
					} as any
				);

				expect(response.error?.type).toEqual("HAS_LOCAL_COMMITS");
			});
		});

		describe("without review", () => {
			it("REQUIRES_PROVIDER", async () => {
				const manager = new ReviewsManager({ onDidRequestReset: function() {} } as any);

				const response = await manager.checkPullRequestPreconditions(
					{
						headRefName: "develop",
						repoId: "123"
					} as any,
					null,
					{
						users: {
							getMe: async function() {
								return {
									user: {}
								};
							}
						},
						session: {},
						git: {
							getHasLocalCommits: async function() {
								return false;
							},
							getHasModifications: async function() {
								return true;
							},
							getRepositoryById: async function() {
								return {
									getPullRequestProvider: async function() {
										return undefined;
									},
									getWeightedRemotes: async function() {
										return [];
									}
								};
							},
							getCurrentBranch: async function() {
								return "develop";
							},
							getWeightedRemotes: async function() {
								return [];
							},
							getWeightedRemotesByStrategy: function() {
								return [];
							}
						},
						providerRegistry: {
							getConnectedPullRequestProviders: async function() {
								return [];
							}
						}
					} as any
				);

				expect(response.error?.type).toEqual("REQUIRES_PROVIDER");
			});

			it("works", async () => {
				const manager = new ReviewsManager({ onDidRequestReset: function() {} } as any);

				const response = await manager.checkPullRequestPreconditions(
					{ headRefName: "develop", repoId: "123" } as any,
					null,
					{
						users: {
							getMe: async function() {
								return {
									user: {}
								};
							}
						},
						git: {
							getBranches: async function() {
								return {
									branchesMeta: []
								};
							},
							getBranchCommitsStatus: async function() {
								return "0";
							},
							getBranchRemote: async function() {
								return "origin/develop";
							},
							getHasLocalCommits: async function() {
								return false;
							},
							getHasModifications: async function() {
								return true;
							},
							getRepositoryById: async function() {
								return {
									getPullRequestProvider: async function() {
										return {
											provider: {
												providerId: "github*com",
												name: "github"
											},
											providerId: "github*com",
											name: "github",
											path: "",
											remotes: [
												{
													webUrl: "something/a.git"
												}
											]
										};
									},
									getWeightedRemotes: async function() {
										return [];
									},
									getWeightedRemotesByStrategy: function() {
										return ["origin"];
									}
								};
							},
							getCurrentBranch: async function() {
								return "develop";
							},
							getWeightedRemotes: async function() {
								return [];
							}
						},
						providerRegistry: {
							getRepoInfo: async function() {
								return {
									provider: {
										defaultBranch: "develop"
									}
								};
							},
							getConnectedPullRequestProviders: async function() {
								return [
									{
										id: "github*com"
									}
								];
							}
						}
					} as any
				);
				if (response?.error) {
					console.warn(response.error);
				}
				expect(response.success).toEqual(true);
			});
		});
	});
});
