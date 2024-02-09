import React from "react";
import { NRQLResult } from "@codestream/protocols/agent";
import {
	CartesianGrid,
	ResponsiveContainer,
	XAxis,
	YAxis,
	Legend,
	AreaChart,
	Area,
} from "recharts";

const colorHash = {
	0: "#e6b223",
	1: "#9558af",
	2: "#8884d8",
	3: "#7aa7d2",
	4: "#84d888",
	5: "#d2d27a",
	6: "#d88884",
	7: "#7ad2a7",
	8: "#d27aa7",
	9: "#a77ad2",
};

const formatXAxisTime = time => {
	return new Date(time).toLocaleTimeString();
};

export const NRQLResultsArea = (props: { results: NRQLResult[] }) => {
	const result = props.results ? props.results[0] : undefined;
	const dataKeys = Object.keys(result || {}).filter(
		_ => _ !== "beginTimeSeconds" && _ !== "endTimeSeconds"
	);
	return (
		<div className="histogram-chart">
			<div style={{ marginLeft: "0px", marginBottom: "20px" }}>
				<ResponsiveContainer width="100%" height={300} debounce={1}>
					<AreaChart
						width={500}
						height={300}
						data={props.results}
						margin={{
							top: 5,
							right: 0,
							left: 0,
							bottom: 5,
						}}
					>
						<CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />

						<XAxis
							tick={{ fontSize: 11 }}
							dataKey="endTimeSeconds"
							tickFormatter={formatXAxisTime}
						/>

						<YAxis tick={{ fontSize: 11 }} />

						{dataKeys.map((_, index) => {
							const color = colorHash[index % 10];
							return <Area dataKey={_} stroke={color} fill={color} />;
						})}
						<Legend align="center" fontSize={10} />
					</AreaChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
};