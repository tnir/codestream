import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip as ReTooltip,
	XAxis,
	YAxis
} from "recharts";
import Tooltip from "../Tooltip";

import styled from "styled-components";
import {
	GetMethodLevelTelemetryRequestType,
	GetMethodLevelTelemetryResponse,
	TelemetryRequestType,
	WarningOrError
} from "@codestream/protocols/agent";
import { DelayedRender } from "@codestream/webview/Container/DelayedRender";
import { LoadingMessage } from "@codestream/webview/src/components/LoadingMessage";
import { CodeStreamState } from "@codestream/webview/store";
import { useDidMount, usePrevious } from "@codestream/webview/utilities/hooks";
import { HostApi } from "@codestream/webview/webview-api";
import { PanelHeader } from "../../src/components/PanelHeader";
import { closePanel, setUserPreferences } from "../actions";
import CancelButton from "../CancelButton";
import { Dropdown } from "../Dropdown";
import Icon from "../Icon";
import { Link } from "../Link";
import { WarningBox } from "../WarningBox";
import { CurrentMethodLevelTelemetry } from "@codestream/webview/store/context/types";
import { RefreshEditorsCodeLensRequestType } from "@codestream/webview/ipc/host.protocol";
import { ALERT_SEVERITY_COLORS } from "../CodeError";

const Root = styled.div``;

const ApmServiceTitle = styled.span`
	a {
		color: var(--text-color-highlight);
		text-decoration: none;
	}
	.open-external {
		margin-left: 5px;
		font-size: 12px;
		visibility: hidden;
		color: var(--text-color-highlight);
	}
	&:hover .open-external {
		visibility: visible;
	}
`;

export const MethodLevelTelemetryPanel = () => {
	const dispatch = useDispatch();

	const derivedState = useSelector((state: CodeStreamState) => {
		const cmlt = (state.context.currentMethodLevelTelemetry || {}) as CurrentMethodLevelTelemetry;
		const repo = state.repos[cmlt.repoId] || {};
		const methodLevelTelemetryRepoEntities =
			(state.users[state.session.userId!].preferences || {}).methodLevelTelemetryRepoEntities || {};
		return {
			currentMethodLevelTelemetry: cmlt,
			methodLevelTelemetryRepoEntities,
			repo,
			methodLevelTelemetryRepoEntitiesForRepo: methodLevelTelemetryRepoEntities[repo.id]
		};
	});

	const [telemetryResponse, setTelemetryResponse] = useState<
		GetMethodLevelTelemetryResponse | undefined
	>(undefined);
	const [loading, setLoading] = useState<boolean>(true);
	const [warningOrErrors, setWarningOrErrors] = useState<WarningOrError[] | undefined>(undefined);
	const previouscurrentMethodLevelTelemetry = usePrevious(derivedState.currentMethodLevelTelemetry);

	const loadData = async (newRelicEntityGuid: string) => {
		setLoading(true);
		try {
			if (!derivedState.currentMethodLevelTelemetry.repoId) {
				setWarningOrErrors([{ message: "Repository missing" }]);
				return;
			}
			if (!derivedState.currentMethodLevelTelemetry.metricTimesliceNameMapping) {
				setWarningOrErrors([{ message: "Repository metric timeslice names" }]);
				return;
			}

			const response = await HostApi.instance.send(GetMethodLevelTelemetryRequestType, {
				newRelicEntityGuid: newRelicEntityGuid,
				metricTimesliceNameMapping: derivedState.currentMethodLevelTelemetry
					.metricTimesliceNameMapping!,
				repoId: derivedState.currentMethodLevelTelemetry.repoId
			});

			setTelemetryResponse(response);
		} catch (ex) {
			setWarningOrErrors([{ message: ex.toString() }]);
		} finally {
			setLoading(false);
		}
	};
	useDidMount(() => {
		HostApi.instance.send(TelemetryRequestType, {
			eventName: "Method Level Telemetry Viewed",
			properties: {}
		});
		loadData(derivedState.currentMethodLevelTelemetry.newRelicEntityGuid!);
	});

	useEffect(() => {
		if (
			!previouscurrentMethodLevelTelemetry ||
			JSON.stringify(previouscurrentMethodLevelTelemetry) ===
				JSON.stringify(derivedState.currentMethodLevelTelemetry)
		) {
			return;
		}

		loadData(derivedState.currentMethodLevelTelemetry.newRelicEntityGuid!);
	}, [derivedState.currentMethodLevelTelemetry]);

	return (
		<Root className="full-height-codemark-form">
			{!loading && (
				<div
					style={{
						paddingTop: "2px",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis"
					}}
				>
					<div
						style={{
							display: "inline-block",
							width: "10px",
							height: "10px",
							border: "0px",
							backgroundColor:
								ALERT_SEVERITY_COLORS[
									(telemetryResponse && telemetryResponse.newRelicAlertSeverity) || "UNKNOWN"
								],
							margin: "0 5px 0 6px"
						}}
					/>

					{telemetryResponse && telemetryResponse.newRelicUrl && (
						<Tooltip title="View service summary on New Relic One" placement="bottom" delay={1}>
							<span style={{ opacity: ".5" }}>
								<ApmServiceTitle>
									<Link href={telemetryResponse.newRelicUrl}>
										<span className="subtle">
											{(telemetryResponse && telemetryResponse.newRelicEntityName) || "Entity"}
										</span>
									</Link>{" "}
									<Icon name="link-external" className="open-external"></Icon>
								</ApmServiceTitle>
							</span>
						</Tooltip>
					)}
					<PanelHeader
						title={derivedState.currentMethodLevelTelemetry.functionName + " telemetry"}
					></PanelHeader>
				</div>
			)}
			<CancelButton onClick={() => dispatch(closePanel())} />

			<div className="plane-container" style={{ padding: "5px 20px 0px 10px" }}>
				<div className="standard-form vscroll">
					{warningOrErrors ? (
						<WarningBox items={warningOrErrors} />
					) : (
						<>
							{loading ? (
								<>
									<DelayedRender>
										<div style={{ display: "flex", alignItems: "center" }}>
											<LoadingMessage>Loading Telemetry...</LoadingMessage>
										</div>
									</DelayedRender>
								</>
							) : (
								<div>
									<div>
										<b>Entity:</b>{" "}
										{telemetryResponse && (
											<Dropdown
												selectedValue={telemetryResponse.newRelicEntityName!}
												items={([
													{
														type: "search",
														placeholder: "Search...",
														action: "search",
														key: "search"
													}
												] as any).concat(
													telemetryResponse.newRelicEntityAccounts!.map((item, i) => {
														return {
															label: item.entityName,
															searchLabel: item.entityName,
															key: item.entityGuid + "-" + i,
															checked: item.entityGuid === telemetryResponse.newRelicEntityGuid!,
															action: async () => {
																await dispatch(
																	setUserPreferences({
																		[`methodLevelTelemetryRepoEntities.${
																			derivedState.currentMethodLevelTelemetry!.repoId
																		}`]: item.entityGuid
																	})
																);

																loadData(item.entityGuid);
																HostApi.instance.send(RefreshEditorsCodeLensRequestType, {});
															}
														};
													})
												)}
											/>
										)}
									</div>
									<div>
										<b>Repo:</b> {derivedState.repo.name}
									</div>
									<div>
										<b>File:</b> {derivedState?.currentMethodLevelTelemetry.relativeFilePath}
									</div>
									<div>
										<br />
										{telemetryResponse &&
											telemetryResponse.goldenMetrics &&
											telemetryResponse.goldenMetrics.map(_ => {
												return (
													<div style={{ marginLeft: "-25px", marginBottom: "15px" }}>
														<ResponsiveContainer width="90%" height={270}>
															<LineChart
																width={500}
																height={300}
																data={_.result}
																margin={{
																	top: 5,
																	right: 30,
																	left: 10,
																	bottom: 5
																}}
															>
																<CartesianGrid strokeDasharray="3 3" />
																<XAxis dataKey="endDate" />
																<YAxis dataKey={_.title} />
																<ReTooltip />
																<Legend />
																<Line
																	type="monotone"
																	dataKey={_.title}
																	stroke="#8884d8"
																	activeDot={{ r: 8 }}
																/>
															</LineChart>
														</ResponsiveContainer>
													</div>
												);
											})}
									</div>
									{/* {telemetryResponse && telemetryResponse.newRelicUrl && (
										<div>
											<Link className="external-link" href={telemetryResponse.newRelicUrl}>
												View service summary on New Relic One <Icon name="link-external" />
											</Link>
										</div>
									)} */}
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</Root>
	);
};