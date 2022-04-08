import { CodeStreamState } from "@codestream/webview/store";
import { useDidMount } from "@codestream/webview/utilities/hooks";
import { normalizeUrl } from "@codestream/webview/utilities/urls";
import React, { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { configureProvider, ViewLocation } from "../store/providers/actions";
import { closePanel } from "./actions";
import Button from "./Button";
import CancelButton from "./CancelButton";
import { PROVIDER_MAPPINGS } from "./CrossPostIssueControls/types";

interface Props {
    providerId: string;
    originLocation: ViewLocation;
}

export default function ConfigureYouTrackPanel(props: Props) {
    const initialInput = useRef<HTMLInputElement>(null);

    const derivedState = useSelector((state: CodeStreamState) => {
        const { providers, ide } = state;
        const provider = providers[props.providerId];
        const isInVscode = ide.name === "VSC";
        const providerDisplay = PROVIDER_MAPPINGS[provider.name];
        return { provider, providerDisplay, isInVscode };
    });

    const [baseUrl, setBaseUrl] = useState("");
    const [baseUrlTouched, setBaseUrlTouched] = useState(false);
    const [token, setToken] = useState("");
    const [tokenTouched, setTokenTouched] = useState(false);
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [loading, setLoading] = useState(false);

    const dispatch = useDispatch();

    useDidMount(() => {
        initialInput.current?.focus();
    });

    const onSubmit = async e => {
        e.preventDefault();
        setSubmitAttempted(true);
        if (isFormInvalid()) return;
        setLoading(true);
        const { providerId } = props;

        // for YouTrack, configuring is as good as connecting, since we are letting the user
        // set the access token ... sending the fourth argument as true here lets the
        // configureProvider function know that they can mark YouTrack as connected as soon
        // as the access token entered by the user has been saved to the server
        await dispatch(configureProvider(
            providerId,
            { baseUrl: normalizeUrl(baseUrl), token },
            true,
            props.originLocation
        ));

        setLoading(false);
        await dispatch(closePanel());
    };

    const renderError = () => {
    };

    const onBlurBaseUrl = () => {
        setBaseUrlTouched(true);
    };

    const renderBaseUrlHelp = () => {
        if (baseUrlTouched || submitAttempted) {
            if (baseUrl.length === 0) return <small className="error-message">Required</small>;
        }
        return;
    };

    const onBlurToken = () => {
        setTokenTouched(true);
    };

    const renderTokenHelp = () => {
        if (tokenTouched || submitAttempted) {
            if (token.length === 0) return <small className="error-message">Required</small>;
        }
        return;
    };

    const tabIndex = (): any => {
    };

    const isFormInvalid = () => {
        return baseUrl.length === 0 || token.length === 0;
    };

    const inactive = false;
    const { providerDisplay } = derivedState;
    const { displayName, urlPlaceholder, getUrl } = providerDisplay;
    return (
        <div className="panel configure-provider-panel">
            <form className="standard-form vscroll" onSubmit={onSubmit}>
                <div className="panel-header">
                    <CancelButton onClick={() => dispatch(closePanel())}/>
                    <span className="panel-title">Configure {displayName}</span>
                </div>
                <fieldset className="form-body" disabled={inactive}>
                    {getUrl && (
                        <p style={{ textAlign: "center" }} className="explainer">
                            Not a {displayName} customer yet? <a href={getUrl}>Get {displayName}</a>
                        </p>
                    )}
                    {renderError()}
                    <div id="controls">
                        <div id="configure-youtrack-controls" className="control-group">
                            <label>
                                <strong>{displayName} Base URL</strong>
                            </label>
                            <label>
                                Please provide the Base URL used by your team to access YouTrack. This can be
                                found under your{" "}
                                <a href="https://www.jetbrains.com/help/youtrack/incloud/Domain-Settings.html">
                                    Domain Settings
                                </a>
                                .
                            </label>
                            <input
                                ref={initialInput}
                                className="input-text control"
                                type="text"
                                name="baseUrl"
                                tabIndex={tabIndex()}
                                value={baseUrl}
                                onChange={e => setBaseUrl(e.target.value)}
                                onBlur={onBlurBaseUrl}
                                placeholder={urlPlaceholder}
                                id="configure-provider-initial-input"
                            />
                            {renderBaseUrlHelp()}
                        </div>
                        <br/>
                        <div id="token-controls" className="control-group">
                            <label>
                                <strong>{displayName} Permanent Token</strong>
                            </label>
                            <label>
                                Please provide a{" "}
                                <a href="https://www.jetbrains.com/help/youtrack/standalone/Manage-Permanent-Token.html">
                                    permanent token
                                </a>{" "}
                                we can use to access your YouTrack projects and issues.
                            </label>
                            <input
                                className="input-text control"
                                type="password"
                                name="token"
                                tabIndex={tabIndex()}
                                value={token}
                                onChange={e => setToken(e.target.value)}
                                onBlur={onBlurToken}
                            />
                            {renderTokenHelp()}
                        </div>
                        <div className="button-group">
                            <Button
                                id="save-button"
                                className="control-button"
                                tabIndex={tabIndex()}
                                type="submit"
                                loading={loading}
                            >
                                Submit
                            </Button>
                            <Button
                                id="discard-button"
                                className="control-button cancel"
                                tabIndex={tabIndex()}
                                type="button"
                                onClick={() => dispatch(closePanel())}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </fieldset>
            </form>
        </div>
    );
}

