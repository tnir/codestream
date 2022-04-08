import React, { useEffect } from "react";
import { connect, useDispatch, useSelector } from "react-redux";
import { configureAndConnectProvider, getUserProviderInfo } from "../../store/providers/actions";
import {
	openPanel,
	setIssueProvider,
	setCurrentCodemark,
	setNewPostEntry
} from "../../store/context/actions";
import Icon from "../Icon";
import Menu from "../Menu";
import { ProviderDisplay, PROVIDER_MAPPINGS } from "./types";
import {
	ThirdPartyProviderConfig,
	ThirdPartyProviders,
	FetchThirdPartyBoardsRequestType,
	FetchThirdPartyCardsRequestType
} from "@codestream/protocols/agent";
import { CSMe } from "@codestream/protocols/api";
import { PrePRProviderInfoModalProps, PrePRProviderInfoModal } from "../PrePRProviderInfoModal";
import { CodeStreamState } from "@codestream/webview/store";
import { updateForProvider } from "@codestream/webview/store/activeIntegrations/actions";
import { setUserPreference, setUserStatus } from "../actions";
import { HostApi } from "../..";
import { keyFilter } from "@codestream/webview/utils";
import { EMPTY_STATUS } from "../StartWork";
import styled from "styled-components";
import Filter from "../Filter";
import { SmartFormattedList } from "../SmartFormattedList";
import { Provider, IntegrationButtons } from "../IntegrationsPanel";
import { LoadingMessage } from "@codestream/webview/src/components/LoadingMessage";
import Tooltip from "../Tooltip";
import { Headshot } from "@codestream/webview/src/components/Headshot";
import * as codemarkSelectors from "../../store/codemarks/reducer";
import { useDidMount } from "@codestream/webview/utilities/hooks";
import { Modal } from "../Modal";
import { Button } from "@codestream/webview/src/components/Button";
import { OpenUrlRequestType, WebviewPanels } from "@codestream/protocols/webview";
import { ButtonRow } from "@codestream/webview/src/components/Dialog";
import { Dialog } from "@codestream/webview/src/components/Dialog";
import { PaneHeader, PaneBody, PaneState } from "@codestream/webview/src/components/Pane";
import { StartWork } from "../StartWork";
import { mapFilter } from "@codestream/webview/utils";
import { Link } from "../Link";
import { ErrorMessage } from "../ConfigurePullRequestQuery";
import { isEmpty as _isEmpty } from "lodash-es";
interface ProviderInfo {
	provider: ThirdPartyProviderConfig;
	display: ProviderDisplay;
}

interface ConnectedProps {
	// connectedProviderNames: string[];
	currentTeamId: string;
	currentUser: CSMe;
	issueProviderConfig?: ThirdPartyProviderConfig;
	providers: ThirdPartyProviders;
	disabledProviders: { [key: string]: boolean };
	setUserPreference?: Function;
	teamSettings: { [key: string]: any };
	isOnPrem: boolean;
}

interface Props extends ConnectedProps {
	configureAndConnectProvider(...args: Parameters<typeof configureAndConnectProvider>): any;
	updateForProvider(...args: Parameters<typeof updateForProvider>): any;
	setIssueProvider(providerId?: string): void;
	openPanel(...args: Parameters<typeof openPanel>): void;
	isEditing?: boolean;
	paneState?: PaneState;
}

interface State {
	isLoading: boolean;
	loadingProvider?: ProviderInfo;
	issueProviderMenuOpen: boolean;
	issueProviderMenuTarget: any;
	propsForPrePRProviderInfoModal?: PrePRProviderInfoModalProps;
}

class IssueDropdown extends React.Component<Props, State> {
	constructor(props: Props) {
		super(props);
		const providerInfo = props.issueProviderConfig
			? this.getProviderInfo(props.issueProviderConfig.id)
			: undefined;
		const loadingProvider = providerInfo;
		this.state = {
			isLoading: false,
			loadingProvider,
			issueProviderMenuOpen: false,
			issueProviderMenuTarget: undefined
		};
	}

	componentDidMount() {
		const { issueProviderConfig } = this.props;
		const providerInfo = issueProviderConfig
			? this.getProviderInfo(issueProviderConfig.id)
			: undefined;
		if (!issueProviderConfig || !providerInfo) {
			this.props.setIssueProvider(undefined);
		}
	}

	componentDidUpdate(prevProps: Props, prevState: State) {
		const { issueProviderConfig } = this.props;
		const providerInfo = issueProviderConfig
			? this.getProviderInfo(issueProviderConfig.id)
			: undefined;
		if (
			providerInfo &&
			issueProviderConfig &&
			(!prevProps.issueProviderConfig ||
				prevProps.issueProviderConfig.id !== issueProviderConfig.id)
		) {
			this.setState({ isLoading: false });
		} else if (!providerInfo && prevProps.issueProviderConfig) {
			if (this.state.isLoading) {
				this.setState({ isLoading: false, loadingProvider: undefined });
			}
		}
	}

	renderLoading() {
		const { isLoading, loadingProvider } = this.state;

		if (!isLoading) return null;

		return (
			<LoadingMessage align="left">
				Authenticating with {loadingProvider!.display.displayName}... (check your web browser){" "}
				<a onClick={this.cancelLoading}>cancel</a>
			</LoadingMessage>
		);
	}

	cancelLoading = () => {
		this.setState({ isLoading: false });
		this.props.setIssueProvider(undefined);
	};

	render() {
		// console.warn("rendering issues...");
		const { issueProviderConfig, teamSettings } = this.props;
		const providerInfo = issueProviderConfig
			? this.getProviderInfo(issueProviderConfig.id)
			: undefined;

		if (!this.props.providers || !Object.keys(this.props.providers).length) return null;

		const knownIssueProviders = Object.keys(this.props.providers).filter(providerId => {
			const provider = this.props.providers![providerId];
			return provider.hasIssues && !!PROVIDER_MAPPINGS[provider.name];
		});
		if (knownIssueProviders.length === 0) {
			return null;
		}

		const knownIssueProviderOptions = mapFilter(knownIssueProviders, providerId => {
			const issueProvider = this.props.providers![providerId];
			const providerDisplay = PROVIDER_MAPPINGS[issueProvider.name];
			const displayName = issueProvider.isEnterprise
				? `${providerDisplay.displayName} - ${issueProvider.host}`
				: providerDisplay.displayName;

			const checked = this.providerIsConnected(providerId) && !this.providerIsDisabled(providerId);
			if (!providerDisplay.supportsStartWork) return;
			if (teamSettings.limitIssues && !teamSettings.issuesProviders[providerId] && !checked) return;
			return {
				providerIcon: <Icon name={providerDisplay.icon || "blank"} />,
				checked: checked,
				value: providerId,
				label: displayName,
				key: providerId,
				action: () => this.selectIssueProvider(providerId)
			};
		}).sort((a, b) => a.label.localeCompare(b.label));
		// const index = knownIssueProviderOptions.findIndex(i => i.disabled);
		// @ts-ignore
		// knownIssueProviderOptions.splice(index, 0, { label: "-" });

		const activeProviders = knownIssueProviders
			.filter(id => this.providerIsConnected(id) && !this.providerIsDisabled(id))
			.map(id => this.props.providers![id]);

		return (
			<>
				{this.state.propsForPrePRProviderInfoModal && (
					<PrePRProviderInfoModal {...this.state.propsForPrePRProviderInfoModal} />
				)}
				<IssueList
					providers={activeProviders}
					knownIssueProviderOptions={knownIssueProviderOptions}
					loadingMessage={this.state.isLoading ? this.renderLoading() : null}
					paneState={this.props.paneState}
				></IssueList>
			</>
		);
	}

	renderProviderOptions = (selectedProvider, knownIssueProviderOptions) => {
		return (
			<span className="dropdown-button" onClick={this.switchIssueProvider}>
				<Icon name="chevron-down" />
				{this.state.issueProviderMenuOpen && (
					<Menu
						align="dropdownRight"
						target={this.state.issueProviderMenuTarget}
						items={knownIssueProviderOptions}
						action={() => {}}
					/>
				)}
			</span>
		);
	};

	switchIssueProvider = (event: React.SyntheticEvent) => {
		if (this.props.isEditing) return;

		event.stopPropagation();
		const target = event.target;
		this.setState(state => ({
			issueProviderMenuOpen: !state.issueProviderMenuOpen,
			// @ts-ignore
			issueProviderMenuTarget: target.closest(".dropdown-button")
		}));
	};

	providerIsDisabled = providerId => this.props.disabledProviders[providerId];

	selectIssueProvider = providerId => {
		const { setUserPreference } = this.props;
		this.setState({ issueProviderMenuOpen: false });
		if (!providerId) return;
		if (providerId === "codestream") {
			this.props.setIssueProvider(undefined);
			return;
		}

		// if (setUserPreference) setUserPreference(["skipConnectIssueProviders"], false);

		if (this.providerIsDisabled(providerId)) {
			// if it's disabled, enable it
			if (setUserPreference)
				setUserPreference(["startWork", "disabledProviders", providerId], false);
		} else if (this.providerIsConnected(providerId)) {
			// if it's conected and not disabled, disable it
			if (setUserPreference) {
				setUserPreference(["startWork", "disabledProviders", providerId], true);
				// setUserPreference(["skipConnectIssueProviders"], false);
			}
		} else {
			// otherwise we need to connect
			const issueProvider = this.props.providers![providerId];
			const providerDisplay = PROVIDER_MAPPINGS[issueProvider.name];
			this.onChangeProvider({ provider: issueProvider, display: providerDisplay });
		}
	};

	async onChangeProvider(providerInfo: ProviderInfo) {
		await this.props.configureAndConnectProvider(providerInfo.provider.id, "Compose Modal");

		/*
		// Per https://newrelic.atlassian.net/browse/CDSTRM-1591, the need for the "pre-PR" modal
		// is discontinued ... if we bring it back, suggest we figure out a way not to repeat the
		// logic below across all our launch integration points - Colin

		if (
			(providerInfo.provider.needsConfigure ||
				(providerInfo.provider.needsConfigureForOnPrem && this.props.isOnPrem)) &&
			!this.providerIsConnected(providerInfo.provider.id)
		) {
			const { name, id } = providerInfo.provider;
			this.props.openPanel(`configure-provider-${name}-${id}-Compose Modal`);
		} else if (
			providerInfo.provider.forEnterprise &&
			!this.providerIsConnected(providerInfo.provider.id)
		) {
			const { name, id } = providerInfo.provider;
			//if (name === "github_enterprise") {
			//	this.setState({
			//		propsForPrePRProviderInfoModal: {
			//			providerName: name,
			//			onClose: () => this.setState({ propsForPrePRProviderInfoModal: undefined }),
			//			action: () => this.props.openPanel(`configure-enterprise-${name}-${id}`)
			//		}
			//	});
			//} else
			this.props.openPanel(
				`configure-enterprise-${name}-${id}-Issues Section`
			);
		} else {
			const { name } = providerInfo.provider;
			const { issueProviderConfig } = this.props;
			const newValueIsNotCurrentProvider =
				issueProviderConfig == undefined || issueProviderConfig.name !== name;
			const newValueIsNotAlreadyConnected =
				!issueProviderConfig || !this.providerIsConnected(issueProviderConfig.id);
			if (
				newValueIsNotCurrentProvider &&
				newValueIsNotAlreadyConnected &&
				(name === "github" || name === "bitbucket" || name === "gitlab")
			) {
				this.setState({
					propsForPrePRProviderInfoModal: {
						providerName: name,
						onClose: () => {
							this.setState({ propsForPrePRProviderInfoModal: undefined });
						},
						action: () => {
							this.setState({ isLoading: true, loadingProvider: providerInfo });
							this.props.connectProvider(providerInfo.provider.id, "Issues Section");
						}
					}
				});
			} else {
				this.setState({ isLoading: true, loadingProvider: providerInfo });
				const ret = await this.props.connectProvider(providerInfo.provider.id, "Issues Section");
				if (ret && ret.alreadyConnected) this.setState({ isLoading: false });
			}
		}
		*/
	}

	getProviderInfo(providerId: string): ProviderInfo | undefined {
		const provider = this.props.providers ? this.props.providers[providerId] : undefined;
		if (!provider) return undefined;
		const display = provider ? PROVIDER_MAPPINGS[provider.name] : undefined;
		if (!display) return undefined;
		let providerInfo = getUserProviderInfo(
			this.props.currentUser,
			provider.name,
			this.props.currentTeamId
		);
		if (!providerInfo) return;
		if (providerInfo.accessToken) return { provider, display };
		if (!provider.isEnterprise) return undefined;
		if (!providerInfo!.hosts) return undefined;
		providerInfo = providerInfo!.hosts[provider.id];
		if (!providerInfo) return undefined;
		return { provider, display };
	}

	providerIsConnected(providerId: string): boolean {
		const provider = this.props.providers ? this.props.providers[providerId] : undefined;
		const { currentUser } = this.props;
		if (!provider || currentUser.providerInfo == undefined) return false;
		let providerInfo = getUserProviderInfo(currentUser, provider.name, this.props.currentTeamId);
		if (!providerInfo) return false;
		if (providerInfo.accessToken) return true;
		if (!provider.isEnterprise) return false;
		if (!providerInfo.hosts) return false;
		providerInfo = providerInfo.hosts[provider.id];
		return providerInfo && providerInfo.accessToken ? true : false;
	}
	componentWillReceiveProps(nextProps) {
		for (const index in nextProps) {
			if (nextProps[index] !== this.props[index]) {
				console.warn(index, this.props[index], "-->", nextProps[index]);
			}
		}
	}
}

const EMPTY_HASH2 = {};
const mapStateToProps = (state: CodeStreamState): ConnectedProps => {
	const { users, teams, session, context, providers, preferences, configs } = state;
	const currentIssueProviderConfig = context.issueProvider
		? providers[context.issueProvider]
		: undefined;

	const workPreferences = preferences.startWork || EMPTY_HASH;
	const team = teams[context.currentTeamId];
	const teamSettings = team.settings || EMPTY_HASH2;

	return {
		currentUser: users[session.userId!] as CSMe,
		currentTeamId: context.currentTeamId,
		teamSettings,
		providers,
		issueProviderConfig: currentIssueProviderConfig,
		disabledProviders: workPreferences.disabledProviders || EMPTY_HASH,
		isOnPrem: configs.isOnPrem
	};
};

export default connect(mapStateToProps, {
	configureAndConnectProvider,
	setIssueProvider,
	openPanel,
	updateForProvider,
	setUserPreference
})(IssueDropdown);

export function Issue(props) {
	const { card } = props;
	return (
		<div onClick={props.onClick} style={{ padding: "2px 0" }}>
			{card.icon}
			{card.label}
		</div>
	);
}

interface IssueListProps {
	providers: ThirdPartyProviderConfig[];
	knownIssueProviderOptions: any;
	loadingMessage?: React.ReactNode;
	paneState?: PaneState;
}

const EMPTY_HASH = {};
const EMPTY_CUSTOM_FILTERS = { selected: "", filters: {} };

export const IssueList = React.memo((props: React.PropsWithChildren<IssueListProps>) => {
	const dispatch = useDispatch();
	const data = useSelector((state: CodeStreamState) => state.activeIntegrations);
	const derivedState = useSelector((state: CodeStreamState) => {
		const { preferences } = state;
		const currentUser = state.users[state.session.userId!] as CSMe;
		const startWorkPreferences = preferences.startWork || EMPTY_HASH;
		const providerIds = props.providers.map(provider => provider.id).join(":");
		const skipConnect = preferences.skipConnectIssueProviders;
		const csIssues = codemarkSelectors.getMyOpenIssues(state.codemarks, state.session.userId!);
		const teamId = state.context.currentTeamId;
		const status =
			currentUser.status && currentUser.status[teamId] && "label" in currentUser.status[teamId]
				? currentUser.status[teamId]
				: EMPTY_STATUS;
		const selectedCardId = status.ticketId || "";
		const invisible =
			(currentUser.status && currentUser.status[teamId] && currentUser.status[teamId].invisible) ||
			false;

		return {
			csIssues,
			currentUser,
			invisible,
			providerIds,
			startWorkCard: state.context.startWorkCard,
			startWorkPreferences,
			selectedCardId,
			skipConnect,
			teamId
		};
	});

	const clearAndSave = () => {
		dispatch(setUserStatus("", "", "", "", derivedState.invisible, derivedState.teamId));
	};

	const [initialLoadComplete, setInitialLoadComplete] = React.useState(false);
	const [isLoading, setIsLoading] = React.useState(false);
	const [isLoadingCard, setIsLoadingCard] = React.useState("");
	const [loadedBoards, setLoadedBoards] = React.useState(0);
	const [loadedCards, setLoadedCards] = React.useState(0);
	const [addingCustomFilterForProvider, setAddingCustomFilterForProvider] = React.useState<
		ThirdPartyProviderConfig | undefined
	>();
	const [newCustomFilter, setNewCustomFilter] = React.useState("");
	const [newCustomFilterName, setNewCustomFilterName] = React.useState("");
	const [queryOpen, setQueryOpen] = React.useState(false);
	const [query, setQuery] = React.useState("");
	const [reload, setReload] = React.useState(1);
	const [testCards, setTestCards] = React.useState<any[] | undefined>(undefined);
	const [loadingTest, setLoadingTest] = React.useState(false);
	const [startWorkCard, setStartWorkCard] = React.useState<any>(undefined);
	const [validGHQueries, setvalidGHQueries] = React.useState(
		new Set([
			"user",
			"org",
			"repo",
			"author",
			"assignee",
			"mentions",
			"team",
			"commenter",
			"involves",
			"reviewed-by",
			"review-requested",
			"team-review-requested",
			"project"
		])
	);
	const [validGLQueries, setvalidGLQueries] = React.useState(
		new Set([
			"project_id",
			"group_id",
			"assignee_username",
			"assignee_id",
			"author_username",
			"author_id",
			"created_by_me",
			"my_reaction_emoji",
			"assigned_to_me"
		])
	);
	const [validQuery, setValidQuery] = React.useState(true);
	const [errorQuery, setErrorQuery] = React.useState(false);

	const getFilterLists = (providerId: string) => {
		const prefs = derivedState.startWorkPreferences[providerId] || {};
		const lists = prefs.filterLists ? { ...prefs.filterLists } : EMPTY_HASH;
		return lists;
	};

	const getFilterBoards = (providerId: string) => {
		const prefs = derivedState.startWorkPreferences[providerId] || {};
		const boards = prefs.filterBoards ? { ...prefs.filterBoards } : EMPTY_HASH;
		return boards;
	};

	// the keys are the filter text (e.g. "assignee:@me milestone:jan")
	// and the values are the optional label that the user created
	const getFilterCustom = (providerId: string) => {
		const prefs = derivedState.startWorkPreferences[providerId] || {};
		const custom =
			prefs.filterCustom && prefs.filterCustom.filters
				? { ...prefs.filterCustom }
				: EMPTY_CUSTOM_FILTERS;
		return custom;
	};

	const codemarkState = useSelector((state: CodeStreamState) => state.codemarks);

	useDidMount(() => {
		if (!codemarkState.bootstrapped) {
			// dispatch(bootstrapCodemarks());
		}
		//setup blank data state for provider cards
		props.providers.forEach(provider => {
			updateDataState(provider.id, { cards: [] });
		});
	});

	useEffect(() => {
		const card = derivedState.startWorkCard;
		if (card) selectCard({ ...card, label: card.title });
	}, [derivedState.startWorkCard]);

	const updateDataState = (providerId, data) => dispatch(updateForProvider(providerId, data));

	const setPreference = (providerId, key, value) => {
		dispatch(setUserPreference(["startWork", providerId, key], value));
	};

	React.useEffect(() => {
		// if (data.boards && data.boards.length > 0) return;
		if (props.providers.length === 0) return;

		if (!isLoading) setIsLoading(true);

		let isValid = true;

		const fetchBoards = async () => {
			if (!isValid) return;

			await Promise.all(
				props.providers.map(async provider => {
					const response = await HostApi.instance.send(FetchThirdPartyBoardsRequestType, {
						providerId: provider.id
					});
					updateDataState(provider.id, { boards: response.boards });
				})
			);
			setLoadedBoards(loadedBoards + 1);
			if (!initialLoadComplete) {
				setIsLoading(false);
			}
		};

		const fetchCards = async () => {
			setIsLoading(true);

			await Promise.all(
				props.providers.map(async provider => {
					const filterCustom = getFilterCustom(provider.id);
					try {
						const response = await HostApi.instance.send(FetchThirdPartyCardsRequestType, {
							customFilter: filterCustom.selected,
							providerId: provider.id
						});
						updateDataState(provider.id, {
							cards: response.cards
						});
					} catch (error) {
						console.warn("Error Loading Cards: ", error);
					}
				})
			);
			setIsLoading(false);
			setLoadedCards(loadedCards + 1);
		};

		fetchBoards();
		// don't run duplicate fetch cards call on initial load
		if (initialLoadComplete) {
			fetchCards();
		}

		return () => {
			isValid = false;
		};
	}, [derivedState.providerIds, reload]);

	const delay = n => {
		return new Promise(resolve => {
			setTimeout(resolve, n * 1000);
		});
	};

	// Fetch initial cards here, api call triggered once initial updateDataState is complete
	// Without doing this, we run into an issue where cards are fetched too early and nothing
	// is loaded into cards array.  User would have to use reload button to see cards.
	// See: https://newrelic.atlassian.net/browse/CDSTRM-1329
	// 		https://newrelic.atlassian.net/browse/CDSTRM-1425
	React.useEffect(() => {
		let selectedProvidersHaveBeenInitialized = props.providers.some(provider => {
			return data[provider.id] && _isEmpty(data[provider.id]?.cards);
		});

		if (selectedProvidersHaveBeenInitialized && !initialLoadComplete) {
			void (async () => {
				setIsLoading(true);
				// API needs a second to register with third party providers ???
				// Calling this too early on initial load can cause an issue where
				// nothing is returned.
				// @TODO: See if there is further optimization that could be done here.
				await delay(1);
				await Promise.all(
					props.providers.map(async provider => {
						const filterCustom = getFilterCustom(provider.id);
						try {
							const response = await HostApi.instance.send(FetchThirdPartyCardsRequestType, {
								customFilter: filterCustom.selected,
								providerId: provider.id
							});
							updateDataState(provider.id, {
								cards: response.cards
							});
						} catch (error) {
							console.warn("Error Loading Cards: ", error);
						}
					})
				);

				setIsLoading(false);
				setInitialLoadComplete(true);
				setLoadedCards(loadedCards + 1);
			})();
		}
	}, [data]);

	const selectCard = React.useCallback(
		async (card?) => {
			if (card) {
				const { provider } = card;
				if (provider) {
					const providerDisplay = PROVIDER_MAPPINGS[provider.name];
					const pData = data[provider.id] || {};
					// @ts-ignore
					const board = pData.boards && pData.boards.find(b => b.id === card.idBoard);
					// console.warn("SETTINGS VALUES: ", pData, card);
					let { idList } = card;
					let moveCardOptions = board && board.lists;
					if (providerDisplay.hasCardBasedWorkflow) {
						// setIsLoadingCard(card.id);
						// const response = await HostApi.instance.send(FetchThirdPartyCardWorkflowRequestType, {
						// 	providerId: provider.id,
						// 	cardId: card.id
						// });
						// moveCardOptions = response.workflow;

						// setIsLoadingCard("");
						moveCardOptions = card.lists;
					}
					setStartWorkCard({
						...card,
						label: card.title,
						providerIcon: provider.id === "codestream" ? "issue" : providerDisplay.icon,
						providerToken: providerDisplay.icon,
						providerName: providerDisplay.displayName,
						providerId: provider.id,
						moveCardLabel: `Move this ${providerDisplay.cardLabel} to`,
						moveCardOptions,
						idList
					});
				} else {
					// creating a new card/issue
					setStartWorkCard({ ...card });
				}
			} else {
				setStartWorkCard(undefined);
			}
		},
		[loadedBoards, loadedCards]
	);

	const escapeRegExp = (str: string) => str?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
	const queryRegexp = React.useMemo(() => new RegExp(escapeRegExp(query), "gi"), [query]);

	const underlineQ = string => (
		<span
			dangerouslySetInnerHTML={{ __html: (string || "").replace(queryRegexp, "<u><b>$&</b></u>") }}
		/>
	);

	const filterMenuItemsSubmenu = provider => {
		const filterLists = getFilterLists(provider.id);
		const filterBoards = getFilterBoards(provider.id);
		const filterCustom = getFilterCustom(provider.id);
		const items = [] as any;
		const pData = data[provider.id] || {};

		const providerDisplay = PROVIDER_MAPPINGS[provider.name];
		if (providerDisplay.hasCustomFilters) {
			const activeFilters = keyFilter(filterCustom.filters).filter(
				f => typeof filterCustom.filters[f] === "string"
			);
			activeFilters.forEach((filter: any) => {
				if (typeof filterCustom.filters[filter] !== "string") return; // failsafe
				const checked = filterCustom.selected === filter;
				items.push({
					checked,
					label: filterCustom.filters[filter],
					subtext: filterCustom.filters[filter] == filter ? null : filter,
					key: "customer-filter-" + filter,
					action: () => {
						setPreference(provider.id, "filterCustom", { selected: filter });
						setLoadedBoards(loadedBoards + 1);
					}
				});
			});
			if (items.length > 0) {
				items.push({ label: "-" });
			}
			items.push({
				icon: <Icon name="plus" />,
				label: "Create Custom Filter...",
				key: "add-custom",
				action: () => {
					setNewCustomFilterName("");
					setAddingCustomFilterForProvider(provider);
				}
			});
			if (activeFilters.length > 0) {
				items.push({
					icon: <Icon name="trash" />,
					label: "Delete Custom Filter",
					key: "delete-custom",
					submenu: activeFilters.map((filter: any) => {
						return {
							label: filterCustom.filters[filter],
							key: "delete-customer-filter-" + filter,
							action: () => {
								const selected = filterCustom.selected;
								setPreference(provider.id, "filterCustom", {
									filters: { [filter]: false },
									// reset selected if we're deleting the selected one
									selected: selected === filter ? "" : selected
								});
								if (selected === filter) setLoadedBoards(loadedBoards + 1);
							}
						};
					})
				});
			}
		}

		// @ts-ignore
		if (providerDisplay.hasFilters && pData.boards) {
			if (items.length > 0) {
				items.push({ label: "-" });
			}
			// @ts-ignore
			pData.boards.forEach(board => {
				const b = board;
				let boardChecked = false;
				const lists = board.lists;
				if (lists) {
					const submenu = board.lists.map(list => {
						const l = list;
						const checked = !!filterLists[list.id || "_"];
						if (checked) boardChecked = true;
						return {
							label: list.name,
							key: list.id,
							checked,
							action: () =>
								setPreference(provider.id, "filterLists", {
									...filterLists,
									[l.id || "_"]: !checked
								})
						};
					});
					items.push({
						label: board.name,
						key: "board-" + board.id,
						checked: boardChecked,
						action: () => {},
						submenu
					});
				} else {
					const checked = !!filterBoards[b.id];
					// console.warn("GOT: ", checked, " from ", b, " and ", filterBoards);
					items.push({
						label: board.name,
						key: "board-" + board.id,
						checked,
						action: () =>
							setPreference(provider.id, "filterBoards", {
								...filterBoards,
								[b.id || "_"]: !checked
							})
					});
				}
			});
		}

		return items;
	};

	const filterMenuItemsForProvider = provider => {
		const providerDisplay = PROVIDER_MAPPINGS[provider.name];
		return {
			label: `${providerDisplay.displayName} Filter`,
			icon: <Icon name={providerDisplay.icon} />,
			key: "filters-" + provider.name,
			submenu: filterMenuItemsSubmenu(provider)
		};
	};

	const { cards, canFilter, cardLabel, selectedLabel } = React.useMemo(() => {
		const items = [] as any;
		const lowerQ = (query || "").toLocaleLowerCase();
		const numConnectedProviders = props.providers.length;
		let canFilter = false;
		let cardLabel = "issue";
		let selectedLabel = "issues assigned to you";
		props.providers.forEach(provider => {
			const providerDisplay = PROVIDER_MAPPINGS[provider.name];
			canFilter =
				canFilter || providerDisplay.hasFilters || providerDisplay.hasCustomFilters || false;
			if (providerDisplay.cardLabel) cardLabel = providerDisplay.cardLabel;

			const filterLists = getFilterLists(provider.id);
			const isFilteringLists = providerDisplay.hasFilters && keyFilter(filterLists).length > 0;
			const filterBoards = getFilterBoards(provider.id);
			const isFilteringBoards = providerDisplay.hasFilters && keyFilter(filterBoards).length > 0;
			const filterCustom = getFilterCustom(provider.id);
			const isFilteringCustom = providerDisplay.hasCustomFilters && filterCustom.selected;

			if (isFilteringCustom) {
				// if we have more than one connected provider, we don't want
				// the label to be misleading in terms of what you're filtering on
				if (numConnectedProviders > 1) selectedLabel = cardLabel + "s";
				else if (filterCustom.filters[filterCustom.selected]) {
					selectedLabel = `${filterCustom.filters[filterCustom.selected]}`;
				}
			} else {
				selectedLabel = `${cardLabel}s assigned to you`;
			}

			const pData = data[provider.id] || {};
			// @ts-ignore
			const cards = pData.cards || [];

			// console.warn("COMPARING: ", cards, " TO ", filterLists);
			items.push(
				...(cards
					// @ts-ignore
					.filter(card => !isFilteringLists || filterLists[card.idList || "_"])
					.filter(card => !isFilteringBoards || filterBoards[card.idBoard || "_"])
					.filter(
						card =>
							!query ||
							(card.title || "").toLocaleLowerCase().includes(lowerQ) ||
							(card.body || "").toLocaleLowerCase().includes(lowerQ)
					)
					.map(card => ({
						...card,
						label: query ? underlineQ(card.title) : card.title,
						body: query ? underlineQ(card.body) : card.body,
						icon: providerDisplay.icon && <Icon name={providerDisplay.icon} />,
						key: "card-" + card.id,
						provider
					})) as any)
			);
		});

		items.push(
			...(derivedState.csIssues
				.filter(
					issue =>
						!query ||
						(issue.title || "").toLocaleLowerCase().includes(lowerQ) ||
						(issue.text || "").toLocaleLowerCase().includes(lowerQ)
				)
				.map(issue => ({
					...issue,
					label: query ? underlineQ(issue.title) : issue.title,
					body: query ? underlineQ(issue.text) : issue.text,
					key: "card-" + issue.id,
					icon: <Icon name="issue" />,
					provider: { id: "codestream", name: "codestream" }
				})) as any)
		);

		items.sort((a, b) => b.modifiedAt - a.modifiedAt);

		return { cards: items, canFilter, cardLabel, selectedLabel };
	}, [
		loadedCards,
		derivedState.startWorkPreferences,
		derivedState.csIssues,
		derivedState.selectedCardId
	]);

	const menuItems = React.useMemo(() => {
		// if (props.provider.canFilterByAssignees) {
		// 	items.unshift({
		// 		label: "Filter by Assignee",
		// 		icon: <Icon name="filter" />,
		// 		key: "assignment",
		// 		submenu: [
		// 			{
		// 				label: `${derivedState.providerDisplay.cardLabel} Assigned to Me`,
		// 				key: "mine",
		// 				checked: derivedState.filterAssignees === "mine",
		// 				action: () => setPreference("filterAssignees", "mine")
		// 			},
		// 			{
		// 				label: `Unassigned ${derivedState.providerDisplay.cardLabel}`,
		// 				key: "unassigned",
		// 				checked: derivedState.filterAssignees === "unassigned",
		// 				action: () => setPreference("filterAssignees", "unassigned")
		// 			},
		// 			{
		// 				label: `All ${derivedState.providerDisplay.cardLabel}`,
		// 				key: "all",
		// 				checked: derivedState.filterAssignees === "all",
		// 				action: () => setPreference("filterAssignees", "all")
		// 			}
		// 		]
		// 	});
		// }
		// const submenu = [] as any;
		// props.providers.forEach(provider => {
		// 	submenu.push(filterMenuItemsForProvider(provider));
		// });
		// submenu.push(
		// 	{ label: "-" },
		// 	{
		// 		label: "Connect another Service",
		// 		key: "connect",
		// 		submenu: props.knownIssueProviderOptions
		// 	}
		// );

		const items = { filters: [], services: [] } as any;
		props.providers.forEach(provider => {
			const providerDisplay = PROVIDER_MAPPINGS[provider.name];
			if (providerDisplay.hasFilters || providerDisplay.hasCustomFilters)
				items.filters.unshift(filterMenuItemsForProvider(provider));
		});
		if (items.filters.length === 1) items.filters = items.filters[0].submenu;

		items.services = props.knownIssueProviderOptions;

		return items;
	}, [loadedCards, derivedState.startWorkPreferences]);

	const saveCustomFilter = query => {
		if (isValidQuery(query)) {
			const id = addingCustomFilterForProvider ? addingCustomFilterForProvider.id : "";
			setPreference(id, "filterCustom", {
				filters: {
					[newCustomFilter]: newCustomFilterName || newCustomFilter
				},
				selected: newCustomFilter
			});
			setLoadedBoards(loadedBoards + 1);
			setAddingCustomFilterForProvider(undefined);
		}
	};

	const isValidQuery = query => {
		if (
			addingCustomFilterForProvider?.id === "github*com" ||
			addingCustomFilterForProvider?.id === "github/enterprise"
		) {
			// Verify if valid query for Github
			const queryStr = query.replace(/:/g, " ").split(/\s+/);
			for (let word of queryStr) {
				if (validGHQueries.has(word)) {
					setValidQuery(true);
					return true;
				}
			}
			setValidQuery(false);
			return false;
		} else if (
			addingCustomFilterForProvider?.id === "gitlab*com" ||
			addingCustomFilterForProvider?.id === "gitlab/enterprise"
		) {
			// Verify if valid query for Gitlab
			const queryStr = query.replace(/[=&]/g, " ").split(/\s+/);
			for (let word of queryStr) {
				if (validGLQueries.has(word)) {
					setValidQuery(true);
					return true;
				}
			}
			setValidQuery(false);
			return false;
		}
		setValidQuery(true);
		return true;
	};

	const testCustomFilter = async query => {
		if (isValidQuery(query)) {
			setTestCards(undefined);
			setLoadingTest(true);
			const id = addingCustomFilterForProvider ? addingCustomFilterForProvider.id : "";
			const response = await HostApi.instance.send(FetchThirdPartyCardsRequestType, {
				customFilter: newCustomFilter,
				providerId: id
			});

			if (response.error) {
				setErrorQuery(true);
			} else {
				setErrorQuery(false);
			}

			if (id !== "") {
				const provider = props.providers.find(_ => _.id === id);
				const cardsWithProvider = response.cards.map(card => {
					return {
						...card,
						provider
					};
				});
				setLoadingTest(false);
				setTestCards(cardsWithProvider || ([] as any));
			} else {
				setLoadingTest(false);
				setTestCards(response.cards || ([] as any));
			}
		}
	};

	const firstLoad = cards.length == 0 && isLoading;
	const providersLabel =
		props.providers.length === 0 ? (
			"CodeStream"
		) : (
			<SmartFormattedList
				value={props.providers.map(provider => PROVIDER_MAPPINGS[provider.name].displayName)}
			/>
		);

	const closeCustomFilter = () => {
		setValidQuery(true);
		setErrorQuery(false);
		setAddingCustomFilterForProvider(undefined);
		setNewCustomFilter("");
		setNewCustomFilterName("");
		setTestCards(undefined);
	};

	const renderCustomFilter = () => {
		if (!addingCustomFilterForProvider) return null;
		const providerDisplay = PROVIDER_MAPPINGS[addingCustomFilterForProvider.name];

		return (
			<Modal translucent>
				<Dialog title="Create a Custom Filter" onClose={closeCustomFilter}>
					<div className="standard-form">
						<fieldset className="form-body">
							<span dangerouslySetInnerHTML={{ __html: providerDisplay.customFilterHelp || "" }} />
							<span
								dangerouslySetInnerHTML={{ __html: providerDisplay.customFilterExample || "" }}
							/>
							<input
								type="text"
								className="input-text control"
								value={newCustomFilterName}
								onChange={e => setNewCustomFilterName(e.target.value)}
								placeholder="Name Your Custom Filter (optional)"
								style={{ margin: "20px 0 10px 0" }}
							/>
							{!validQuery ? (
								<ErrorMessage>
									<small className="error-message">
										Missing required qualifier.
										{addingCustomFilterForProvider.id === "github*com" ||
										addingCustomFilterForProvider.id === "github/enterprise" ? (
											<Link href="https://docs.newrelic.com/docs/codestream/how-use-codestream/pull-requests#github">
												Learn more.
											</Link>
										) : (
											<Link href="https://docs.newrelic.com/docs/codestream/how-use-codestream/pull-requests#gitlab">
												Learn more.
											</Link>
										)}
									</small>
								</ErrorMessage>
							) : (
								errorQuery && (
									<ErrorMessage>
										<small className="error-message">
											Invalid query.{" "}
											{addingCustomFilterForProvider.id === "github*com" ||
											addingCustomFilterForProvider.id === "github/enterprise" ? (
												<Link href="https://docs.newrelic.com/docs/codestream/how-use-codestream/pull-requests#github">
													Learn more.
												</Link>
											) : (
												<Link href="https://docs.newrelic.com/docs/codestream/how-use-codestream/pull-requests#gitlab">
													Learn more.
												</Link>
											)}
										</small>
									</ErrorMessage>
								)
							)}

							<input
								type="text"
								className="input-text control"
								autoFocus
								value={newCustomFilter}
								onChange={e => setNewCustomFilter(e.target.value)}
								placeholder="Enter Custom Filter"
							/>
							<ButtonRow>
								<Button
									disabled={newCustomFilter.length == 0}
									variant="secondary"
									isLoading={loadingTest}
									onClick={() => testCustomFilter(newCustomFilter)}
								>
									&nbsp;&nbsp;&nbsp;&nbsp;Test&nbsp;&nbsp;&nbsp;&nbsp;
								</Button>
								<Button
									disabled={newCustomFilter.length == 0}
									onClick={() => saveCustomFilter(newCustomFilter)}
								>
									&nbsp;&nbsp;&nbsp;&nbsp;Save&nbsp;&nbsp;&nbsp;&nbsp;
								</Button>
							</ButtonRow>
							{testCards != undefined && (
								<div style={{ width: "460px", margin: "20px -20px 0 -20px" }}>
									<h3
										style={{
											padding: "20px 0 0 20px",
											borderTop: "1px solid var(--base-border-color)"
										}}
									>
										{testCards.length} total results
									</h3>
									{testCards.map(card => (
										<Row
											key={card.key}
											onClick={() => selectCard(card)}
											className={card.id === derivedState.selectedCardId ? "selected" : ""}
										>
											<div>
												{card.parentId && (
													<span style={{ display: "inline-block", width: "20px" }}>&nbsp;</span>
												)}
												{card.id === isLoadingCard ? (
													<Icon name="refresh" className="spin" />
												) : card.typeIcon ? (
													<img className="issue-type-icon" src={card.typeIcon} />
												) : (
													card.icon
												)}
											</div>
											<div>
												{card.title}
												<span className="subtle">{card.body}</span>
											</div>
										</Row>
									))}
								</div>
							)}
						</fieldset>
					</div>
				</Dialog>
			</Modal>
		);
	};

	return (
		<>
			{startWorkCard && (
				<StartWork
					card={startWorkCard}
					onClose={() => {
						setStartWorkCard(undefined);
						setReload(reload + 1);
					}}
				/>
			)}
			{renderCustomFilter()}
			<PaneHeader
				title="Issues"
				count={cards.length}
				id={WebviewPanels.Tasks}
				isLoading={isLoading}
			>
				{!firstLoad && (
					<Icon
						title="Refresh"
						onClick={() => setReload(reload + 1)}
						className={`fixed ${isLoading ? "spin" : "spinnable"}`}
						name="refresh"
						placement="bottom"
						delay={1}
					/>
				)}
				<Icon
					name="plus"
					onClick={() => {
						dispatch(setNewPostEntry("Issues Section"));
						dispatch(openPanel(WebviewPanels.NewIssue));
					}}
					title={"New " + cardLabel}
					placement="bottom"
					delay={1}
				/>
				<Icon
					name="checked-checkbox"
					onClick={() => {
						selectCard({ title: "" });
						HostApi.instance.track("StartWork Form Opened", {
							"Opened Via": "Ad-Hoc Button"
						});
					}}
					title="Start ad-hoc work"
					placement="bottom"
					delay={1}
				/>
			</PaneHeader>
			{props.paneState !== PaneState.Collapsed && (
				<PaneBody>
					<div className="instructions">
						<Icon name="light-bulb" />
						Start work by grabbing a ticket below, and creating a branch.
					</div>
					{props.loadingMessage ? (
						<div>{props.loadingMessage}</div>
					) : props.providers.length > 0 || derivedState.skipConnect ? (
						<div className="filters" style={{ padding: "0 20px 5px 20px" }}>
							Show{" "}
							{canFilter ? (
								<Filter
									title="Filter Items"
									selected={"selectedLabel"}
									labels={{ selectedLabel }}
									items={[{ label: "-" }, ...menuItems.filters]}
									align="center"
									dontCloseOnSelect
								/>
							) : (
								selectedLabel + " "
							)}
							from{" "}
							<Filter
								title={<>{isLoading && <Icon name="sync" className="spin" />}Select Providers</>}
								selected={"providersLabel"}
								labels={{ providersLabel }}
								items={[{ label: "-" }, ...menuItems.services]}
								align="center"
								dontCloseOnSelect
							/>
						</div>
					) : (
						<>
							<div className="filters" style={{ padding: "0 20px 10px 20px" }}>
								<span>
									Connect your issue provider(s) to make it easy to manage tasks, create branches,
									and connect tasks to commits &amp; PRs.{" "}
									<Tooltip title="Connect later on the Integrations page" placement="top">
										<Linkish
											onClick={() =>
												dispatch(setUserPreference(["skipConnectIssueProviders"], true))
											}
										>
											Skip this step.
										</Linkish>
									</Tooltip>
								</span>
							</div>
							<IntegrationButtons noBorder style={{ marginBottom: "20px" }}>
								{props.knownIssueProviderOptions.map(item => {
									if (item.disabled) return null;
									return (
										<Provider key={item.key} onClick={item.action}>
											{item.providerIcon}
											{item.label}
										</Provider>
									);
								})}
							</IntegrationButtons>
							<IssueMissing>
								Don't see your service?{" "}
								<Link href="https://github.com/TeamCodeStream/codestream/issues?q=is%3Aissue+is%3Aopen+label%3A%22issue+tracker%22">
									Let us know.
								</Link>
							</IssueMissing>
						</>
					)}
					{firstLoad && <LoadingMessage align="left">Loading...</LoadingMessage>}
					{cards.length == 0 &&
					selectedLabel !== "issues assigned to you" &&
					!props.loadingMessage &&
					initialLoadComplete &&
					(props.providers.length > 0 || derivedState.skipConnect) ? (
						<FilterMissing>The selected filter(s) did not return any issues.</FilterMissing>
					) : (
						!props.loadingMessage &&
						(props.providers.length > 0 || derivedState.skipConnect) &&
						cards.length == 0 &&
						initialLoadComplete && (
							<FilterMissing>There are no open issues assigned to you.</FilterMissing>
						)
					)}
					{cards.map(card => (
						<Row
							key={card.key}
							onClick={() => {
								selectCard(card);
								HostApi.instance.track("StartWork Form Opened", {
									"Opened Via": "Selected Ticket"
								});
							}}
							className={card.id === derivedState.selectedCardId ? "selected" : ""}
						>
							<div>
								{card.parentId && (
									<span style={{ display: "inline-block", width: "20px" }}>&nbsp;</span>
								)}
								{card.id === derivedState.selectedCardId && (
									<Icon name="arrow-right" className="selected-icon" />
								)}
								{card.id === isLoadingCard ? (
									<Icon name="sync" className="spin" />
								) : card.typeIcon ? (
									<img className="issue-type-icon" src={card.typeIcon} />
								) : (
									card.icon
								)}
							</div>
							<div>
								{card.label}
								<span className="subtle">{card.body}</span>
							</div>
							<div className="icons">
								{card.listName && <span className="status">{card.listName}</span>}
								{card.id === derivedState.selectedCardId && (
									<Icon
										title={`Clear work item`}
										delay={1}
										placement="bottomRight"
										name="x-circle"
										className="clickable"
										onClick={e => {
											e.stopPropagation();
											e.preventDefault();
											clearAndSave();
										}}
									/>
								)}
								{card.url && (
									<Icon
										title={`Open on web`}
										delay={1}
										placement="bottomRight"
										name="globe"
										className="clickable"
										onClick={e => {
											e.stopPropagation();
											e.preventDefault();
											HostApi.instance.send(OpenUrlRequestType, {
												url: card.url
											});
										}}
									/>
								)}
								{card.provider.id === "codestream" && (
									<Icon
										title={`View Issue Details`}
										delay={1}
										placement="bottomRight"
										name="description"
										className="clickable"
										onClick={e => {
											e.stopPropagation();
											e.preventDefault();
											dispatch(setCurrentCodemark(card.id));
										}}
									/>
								)}
							</div>
						</Row>
					))}
				</PaneBody>
			)}
		</>
	);
});

export const Row = styled.div`
	display: flex;
	position: relative;
	&:not(.no-hover) {
		cursor: pointer;
	}
	white-space: nowrap;
	&.wrap {
		white-space: normal;
	}
	overflow: hidden;
	text-overflow: ellipsis;
	width: 100%;
	padding: 0 10px 0 20px;
	&.selected {
		color: var(--text-color-highlight);
		font-weight: bold;
	}
	&.wide {
		padding: 0;
	}
	&.disabled {
		opacity: 0.5;
	}
	> div {
		overflow: hidden;
		text-overflow: ellipsis;
		padding: 3px 5px 3px 0;
		&:nth-child(1) {
			flex-shrink: 0;
			.icon {
				margin: 0;
			}
		}
		&:nth-child(2) {
			flex-grow: 10;
		}
		&:nth-child(3) {
			flex-shrink: 0;
		}
	}
	.icons {
		margin-left: auto;
		text-align: right;
		color: var(--text-color);
		.icon {
			margin-left: 10px;
			display: none !important;
		}
		padding-left: 2.5px;
		.clickable {
			opacity: 0.7;
		}
	}
	&:hover .icons .icon {
		display: inline-block !important;
	}
	&:hover > div:nth-child(3) {
		min-width: 30px;
	}
	.status,
	time {
		color: var(--text-color-subtle);
		opacity: 0.75;
		padding-left: 5px;
	}
	&:hover:not(.review) .status,
	&:hover:not(.review) time,
	&:hover:not(.review) .badge {
		display: none;
	}
	@media only screen and (max-width: 350px) {
		.status,
		time {
			display: none;
		}
	}
	&:not(.disabled):not(.no-hover):hover {
		background: var(--app-background-color-hover);
		color: var(--text-color-highlight);
	}
	span.subtle {
		display: inline-block;
		padding-left: 15px;
		color: var(--text-color-subtle);
		opacity: 0.75;
	}
	span.subtle-tight {
		display: inline-block;
		padding-left: 12px;
		color: var(--text-color-subtle);
		opacity: 0.75;
	}
	${Headshot} {
		top: 1px;
	}
	// matches for search query
	span > u > b {
		color: var(--text-color-highlight);
	}
	.issue-type-icon {
		width: 16px;
		height: 16px;
		vertical-align: -3px;
		margin-right: 0;
		margin-left: 0;
	}
	.selected-icon {
		position: absolute !important;
		left: 2px;
		top: 3px;
	}
	.cs-tag {
		margin-bottom: 0;
	}
	.cs-tag-container {
		display: inline-block;
		margin-top: -1px;
		vertical-align: top;
		padding-left: 10px;
	}
`;

export const IssueRows = styled.div`
	border-top: 1px solid var(--base-border-color);
	padding-top: 15px;
	padding-bottom: 20px;
`;

export const Linkish = styled.span`
	text-decoration: underline;
	cursor: pointer;
	:hover {
		color: var(--text-color-highlight);
	}
`;

const IssueMissing = styled.div`
	text-align: center;
	padding: 0px 20px 0px 20px;
	margin-top: -20px;
`;

const FilterMissing = styled.div`
	text-align: left;
	padding: 10px 20px 0px 20px;
	color: @text-color-subtle;
	font-size: 12px;
`;
