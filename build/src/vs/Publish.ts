import { execSync } from "child_process";
import fs from "fs";
import * as consoul from "../lib/Consoul";
import * as ssh from "../lib/SSH";
import { isWhatIfMode } from "../lib/TeamCity";

export default function (vsRootPath: string) {
	const version = process.env.build_number;

	const localVSCETokenFile = `${process.env.TEMP}\\codestream.vsce`;
	const remoteVSCETokenFile = "/home/web/.codestream/microsoft/vsce-credentials";
	const asset = `${vsRootPath}\\artifacts\\codestream-vs-PROD-${version}-x64.vsix`;
	const vsixPublisher =
		"C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\VSSDK\\VisualStudioIntegration\\Tools\\Bin\\VsixPublisher.exe";

	try {
		if (!fs.existsSync(asset)) {
			consoul.error(`Unable to locate PI asset for release: "${asset}"`);
			process.exit(1);
		}

		ssh.copyRemoteFile(remoteVSCETokenFile, localVSCETokenFile);

		const tokenJson = JSON.parse(fs.readFileSync(localVSCETokenFile, "utf-8"));
		const token = tokenJson.publishers.pat;

		const publishCommand = `"${vsixPublisher}" publish -payload "${asset}" -publishManifest "${vsRootPath}\\src\\CodeStream.VisualStudio.Vsix.x64\\dist\\publish\\publishManifest.json" -personalAccessToken "${token}"`;

		if (isWhatIfMode()) {
			consoul.info("Would have ran...");
			consoul.info(publishCommand);
		} else {
			execSync(publishCommand, { stdio: "inherit" });
		}
	} catch (error) {
		console.error("Error executing command:", error);
		process.exit(1);
	} finally {
		if (fs.existsSync(localVSCETokenFile)) {
			fs.rmSync(localVSCETokenFile);
		}
	}
}
