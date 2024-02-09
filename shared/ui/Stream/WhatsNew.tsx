import React from "react";
import styled from "styled-components";
import Icon from "../Stream/Icon";
import { Link } from "./Link";

const Main = styled.main``;

const TimelineWrapper = styled.div`
	padding: 1rem 3rem;
`;

const TimelineContent = styled.div`
	padding-left: 25.6px;
	border-left: 3px solid var(--base-border-color);

	&:last-child .tl-body {
		border-left: 3px solid transparent;
	}
`;

const TimelineHeader = styled.div`
	position: relative;
	display: grid;
`;

const TimelineTitle = styled.h2`
	font-weight: 600;
	border-bottom: 1px solid var(--base-border-color);
	padding-bottom: 2px;
	margin-bottom: 0.2em;
`;

const TimelineMarker = styled.span`
	display: block;
	position: absolute;
	width: 14px;
	height: 14px;
	border-radius: 50% / 50%;
	background: var(--base-border-color);
	left: -2.56rem;
	top: 50%;
	transform: translate(50%, -50%);
`;

const TimelineDate = styled.div`
	font-size: smaller;
	font-style: italic;
`;

const Update = styled.div``;
const UpdateTitle = styled.h3`
	margin-bottom: 2px;
`;
const UpdateItem = styled.div`
	margin-bottom: 4px;
`;

const ListContainer = styled.ul`
	margin-top: 2px;
	padding-left: 20px;
`;

export const WhatsNewPanel = () => {
	return (
		<TimelineWrapper>
			<h1>
				<Icon
					style={{
						transform: "scale(2)",
						display: "inline-block",
						marginRight: "15px",
						top: "15px",
					}}
					name="newrelic"
				/>
				What's New
			</h1>
			<TimelineContent>
				<TimelineHeader>
					<TimelineMarker />
					<TimelineTitle>15.3.0</TimelineTitle>
					<TimelineDate>February 14, 2024</TimelineDate>
				</TimelineHeader>
				<div className="tl-body">
					<Update>
						<UpdateTitle>Log Search</UpdateTitle>
						<ListContainer>
							No need to slow down your investigation by context switching between your IDE and your browser to search logs. CodeStream brings the New Relic log-search experience right into your IDE! 
							
							Click on the "View Logs" entry for any service listed in the CodeStream pane, or on the "View Logs" icon in CodeStream's global navigation. You can also right-click on a log line in your code and select "Find in logs" to look for entries from that specific log line.
							
							CodeStream's log search is currently available for logs collected by a New Relic APM agent or the OTel integration.
						</ListContainer>
					</Update>
					<Update>
						<UpdateTitle>Query Builder</UpdateTitle>
						<ListContainer>
							The ability to run NRQL queries right from your IDE gives you powerful access to all of the performance data New Relic has about your services.

							Click on the "Query your data" icon in CodeStream's global navigation to access the query builder.

							Add a file with a `.nrql` extension to your repository to save and share queries. Just click the "Run" link in the CodeLense above each query to run the query.
						</ListContainer>
					</Update>
				</div>
			</TimelineContent>
			<TimelineContent>
				<TimelineHeader>
					<TimelineMarker />
					<TimelineTitle>15.2.0</TimelineTitle>
					<TimelineDate>February 7, 2024</TimelineDate>
				</TimelineHeader>
				<div className="tl-body">
					<Update>
						<UpdateTitle>Added</UpdateTitle>
						<ListContainer>
							<li>
								A new "Apply Fix" button allows you to easily accept a suggested code fix when NRAI
								analyzes an error for you
							</li>
							<li>Code fixes suggested by NRAI are now presented in a diff view</li>
						</ListContainer>
					</Update>
				</div>
			</TimelineContent>
			<TimelineContent>
				<TimelineHeader>
					<TimelineMarker />
					<TimelineTitle>15.1.1</TimelineTitle>
					<TimelineDate>January 15, 2024</TimelineDate>
				</TimelineHeader>
				<div className="tl-body">
					<Update>
						<UpdateTitle>Fixed</UpdateTitle>
						<ListContainer>
							<li>Fixes an issue with an infinite loop on non-refresh token errors</li>
						</ListContainer>
					</Update>
				</div>
			</TimelineContent>
			<TimelineContent>
				<TimelineHeader>
					<TimelineMarker />
					<TimelineTitle>15.1.0</TimelineTitle>
					<TimelineDate>January 23, 2024</TimelineDate>
				</TimelineHeader>
				<div className="tl-body">
					<Update>
						<UpdateTitle>Added</UpdateTitle>
						<ListContainer>
							<li>Adds support for errors from Browser services</li>
							<li>
								Adds change in error rate and response time in Golden Metrics section from three
								hours before your last deployment to three hours after
							</li>
							<li>Adds display of Golden Metrics, SLOs and Related Services for OTel services</li>
							<li>Adds display of Golden Metrics for Lambda functions</li>
						</ListContainer>
					</Update>
					<Update>
						<UpdateTitle>Changed</UpdateTitle>
						<ListContainer>
							<li>
								Anomalies in the Code-Level Metrics section are now displayed in a hierarchy of
								transactions and metrics
							</li>
							<li>
								When viewing anomaly details, the chart appropriate to the type of anomaly is now
								displayed first
							</li>
						</ListContainer>
					</Update>
					<Update>
						<UpdateTitle>Fixed</UpdateTitle>
						<ListContainer>
							<li>
								Addressed{" "}
								<Link href="https://github.com/TeamCodeStream/codestream/issues/1682">#1682</Link> -
								Export data has bad header
							</li>
							<li>
								Addressed{" "}
								<Link href="https://github.com/TeamCodeStream/codestream/issues/1683">#1683</Link> -
								Export data corrupt when comment has a comma
							</li>
						</ListContainer>
					</Update>
				</div>
			</TimelineContent>
			<TimelineContent>
				<TimelineHeader>
					<TimelineMarker />
					<TimelineTitle>15.0.1</TimelineTitle>
					<TimelineDate>December 15, 2023</TimelineDate>
				</TimelineHeader>
				<div className="tl-body">
					<Update>
						<UpdateTitle>Changed</UpdateTitle>
						<ListContainer>
							<li>Generative AI assistant is now named New Relic AI</li>
						</ListContainer>
					</Update>
				</div>
			</TimelineContent>
			<TimelineContent>
				<TimelineHeader>
					<TimelineMarker />
					<TimelineTitle>15.0.0</TimelineTitle>
					<TimelineDate>December 13, 2023</TimelineDate>
				</TimelineHeader>
				<div className="tl-body">
					<Update>
						<UpdateTitle>Changed</UpdateTitle>
						<ListContainer>
							<li>
								Identity is now unified with New Relic, and you will sign in to CodeStream using
								your New Relic credentials
							</li>
							<li>
								Adding and removing organization members is now handled via New Relic on the web
							</li>
							<li>
								Changing your email address or full name is now handled via New Relic on the web
							</li>
							<li>
								The expanded/collapsed state of each top-level section of the CodeStream pane is
								preserved as you switch between services
							</li>
							<li>
								Open incidents for a given service have been replaced by open issues, and are now
								displayed above the Golden Metrics
							</li>
							<li>
								Anomalous methods in the Code-Level Metrics section are no longer split up between
								average duration and error rate anomalies
							</li>
							<li>The "Switch Organization" menu has been renamed to "Switch Users"</li>
						</ListContainer>
					</Update>
					<Update>
						<UpdateTitle>Fixed</UpdateTitle>
						<ListContainer>
							<li>
								Fixes an issue where a newly opened repo wouldn't be recognized by the CodeStream
								pane without a reload
							</li>
						</ListContainer>
					</Update>
				</div>
			</TimelineContent>
		</TimelineWrapper>
	);
};
