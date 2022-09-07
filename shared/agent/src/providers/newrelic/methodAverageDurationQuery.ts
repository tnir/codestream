import { escapeNrql, LanguageId } from "../newrelic";

function mapRubyTimesliceName(name: string): string {
	if (name.startsWith("Nested/Controller")) {
		return name.replace("Nested/", "");
	} else {
		return name;
	}
}

function mapTimeslice(languageId: LanguageId, name: string): string {
	switch (languageId) {
		case "ruby":
			return mapRubyTimesliceName(name);
		case "python":
			return `WebTransaction/${name}`;
		default:
			return name;
	}
}

export function generateMethodAverageDurationQuery(
	languageId: LanguageId,
	newRelicEntityGuid: string,
	metricTimesliceNames?: string[],
	codeNamespace?: string
) {
	const mappedTimesliceNames = metricTimesliceNames?.map(_ => mapTimeslice(languageId, _));

	const extrapolationsLookup = mappedTimesliceNames?.length
		? `name in (${mappedTimesliceNames.map(metric => `'${metric}'`).join(",")})`
		: `name LIKE '${codeNamespace}%'`;
	const extrapolationsQuery = `SELECT average(duration) * 1000 AS 'averageDuration' FROM Span WHERE \`entity.guid\` = '${newRelicEntityGuid}' AND ${extrapolationsLookup} FACET name as metricTimesliceName SINCE 30 minutes AGO LIMIT 100 EXTRAPOLATE`;
	const metricsLookup = mappedTimesliceNames?.length
		? `metricTimesliceName in (${mappedTimesliceNames.map(metric => `'${metric}'`).join(",")})`
		: `metricTimesliceName LIKE '${codeNamespace}%'`;
	const metricsQuery = `SELECT average(newrelic.timeslice.value) * 1000 AS 'averageDuration' FROM Metric WHERE \`entity.guid\` = '${newRelicEntityGuid}' AND ${metricsLookup} FACET metricTimesliceName SINCE 30 minutes AGO LIMIT 100`;
	return `query GetMethodAverageDuration($accountId:Int!) {
	actor {
		account(id: $accountId) {
			metrics: nrql(query: "${escapeNrql(metricsQuery)}") {
				results
				metadata {
					timeWindow {
						begin
						end
					}
				}
			}
			extrapolations: nrql(query: "${escapeNrql(extrapolationsQuery)}") {
				results
				metadata {
					timeWindow {
						begin
						end
					}
				}
			}
		}
	}
}`;
}
