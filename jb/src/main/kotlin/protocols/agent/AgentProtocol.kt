package com.codestream.protocols.agent

import com.codestream.RECORD_REQUESTS
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.annotations.SerializedName
import com.intellij.openapi.application.ApplicationInfo
import com.intellij.openapi.application.ApplicationNamesInfo
import com.intellij.util.io.HttpRequests
import org.apache.commons.codec.digest.DigestUtils
import org.eclipse.lsp4j.Range
import org.eclipse.lsp4j.TextDocumentIdentifier
import org.eclipse.lsp4j.WorkspaceFolder
import javax.swing.Icon
import javax.swing.ImageIcon

class ProxySettings(val url: String, val strictSSL: Boolean)

class InitializationOptions(
    val extension: Extension,
    val ide: Ide,
    val isDebugging: Boolean,
    val proxy: ProxySettings?,
    val proxySupport: String?,
    val serverUrl: String,
    val disableStrictSSL: Boolean,
    val traceLevel: String,
    val gitPath: String?,
    val workspaceFolders: Set<WorkspaceFolder>,
    val recordRequests: Boolean = RECORD_REQUESTS
)

class LoginWithTokenParams(
    val token: JsonElement,
    val teamId: String?
)

class LoginResult(
    val loginResponse: LoginResponse?,
    val state: LoginState?,
    val error: String?,
    val extra: JsonElement?
) {
    val team: CSTeam
        get() = loginResponse?.teams?.find { it.id == state?.teamId }
            ?: throw IllegalStateException("User's teams does not contain their own team")

    val company: CSCompany
        get() = loginResponse?.companies?.find { it.id == team.companyId }
            ?: throw IllegalStateException("User's companies does not contain their own company")

    val userLoggedIn: UserLoggedIn
        get() = loginResponse?.let {
            return UserLoggedIn(it.user, team, company, state!!, it.teams.size, it.companies.size)
        } ?: throw IllegalStateException("LoginResult has no loginResponse")
}

class LoginResponse(
    val user: CSUser,
    val teams: List<CSTeam>,
    val companies: List<CSCompany>,
    val accessToken: String
)

class LoginState(
    val userId: String,
    val teamId: String,
    val email: String,
    val capabilities: JsonObject,
    val environmentInfo: EnvironmentInfo,
    val serverUrl: String,
    val token: JsonObject?
)

class UserLoggedIn(
    val user: CSUser,
    val team: CSTeam,
    val company: CSCompany,
    val state: LoginState,
    val teamsCount: Int,
    val companiesCount: Int
) {
    val userId get() = state.userId
    val teamId get() = state.teamId

    val avatarIcon: Icon? by lazy {
        try {
            val email = user.email
            val emailHash: String = DigestUtils.md5Hex(email.toLowerCase().trim())
            val size = 20
            val avatarUrl = "https://www.gravatar.com/avatar/$emailHash.png?s=$size&d=identicon"
            val bytes: ByteArray = HttpRequests.request(avatarUrl).readBytes(null)
            ImageIcon(bytes)
        } catch(ignore: Exception) {
            null
        }
    }
}


class EnvironmentHost(
    val name: String,
    val publicApiUrl: String,
    val shortName: String
)
class EnvironmentInfo(
    val environment: String,
    val isOnPrem: Boolean,
    val isProductionCloud: Boolean,
    val newRelicLandingServiceUrl: String,
    val newRelicApiUrl: String,
    val environmentHosts: List<EnvironmentHost>
)

class CSUser(
    val id: String,
    val username: String,
    val email: String,
    val fullName: String,
    var preferences: CSPreferences?
) {
    fun wantsToastNotifications(): Boolean = when (preferences?.notificationDelivery) {
        null -> true
        NotificationDeliveryPreference.All.value -> true
        NotificationDeliveryPreference.ToastOnly.value -> true
        else -> false
    }
}

enum class NotificationDeliveryPreference(val value: String) {
    All("all"),
    EmailOnly("emailOnly"),
    ToastOnly("toastOnly"),
    Off("off")
}

class CSPreferences(
    val mutedStreams: Map<String, Boolean>?,
    val notificationDelivery: String?,
    val reviewCreateOnCommit: Boolean?
)

class CSTeam(
    val id: String,
    val companyId: String,
    val name: String,
    val providerInfo: ProviderInfo?
)

class CSCompany(
    val id: String,
    val name: String
)

class CSRepo(
    val id: String,
    val name: String,
    val remote: String
)

class ProviderInfo(
    val slack: JsonObject?
)

class Extension(val versionFormatted: String) {
    val version: String
    val build: String

    init {
        val parts = versionFormatted.split("+")
        version = parts[0]
        build = parts.getOrElse(1) { "SNAPSHOT" }
    }
}

class Ide {
    val name = "JetBrains"
    val version: String = ApplicationInfo.getInstance().fullVersion
    var detail: String = ApplicationNamesInfo.getInstance().fullProductNameWithEdition
}

enum class TraceLevel(val value: String) {
    SILENT("silent"),
    ERRORS("errors"),
    VERBOSE("verbose"),
    DEBUG("debug")
}

class ReviewCoverageParams(val textDocument: TextDocument)

class ReviewCoverageResult(val reviewIds: List<String?>)

class DocumentMarkersParams(val textDocument: TextDocument, val gitSha: String?, val applyFilters: Boolean)

class DocumentMarkersResult(val markers: List<DocumentMarker>, val markersNotLocated: Any)

class DocumentMarker(
    val id: String,
    val codemark: Codemark?,
    val creatorName: String,
    val createdAt: Long,
    val type: String?,
    val range: Range,
    val summary: String,
    val title: String?,
    val externalContent: DocumentMarkerExternalContent?
)

class DocumentMarkerExternalContent(
    val provider: DocumentMarkerExternalContentProvider?,
    val externalId: String,
    val externalChildId: String?,
    val actions: List<DocumentMarkerExternalActions>?
)

class DocumentMarkerExternalActions(
    val label: String,
    val uri: String
)

class DocumentMarkerExternalContentProvider(
    val id: String
)

class CreatePermalinkParams(
    val uri: String?,
    val range: Range,
    val privacy: String
)

class CreatePermalinkResult(
    val linkUrl: String
)

enum class PermalinkPrivacy(val value: String) {
    PUBLIC("public"),
    PRIVATE("private")
}

class GetAllReviewContentsParams(
    val reviewId: String,
    val checkpoint: Int?
)

class ReviewFileContents(
    val leftPath: String,
    val rightPath: String,
    val path: String,
    val left: String,
    val right: String
)

class ReviewRepoContents(
    val repoId: String,
    val files: List<ReviewFileContents>
)

class GetAllReviewContentsResult(
    val repos: List<ReviewRepoContents>
)

class GetReviewContentsParams(
    val reviewId: String,
    val repoId: String,
    val path: String,
    val checkpoint: Int?
)

class GetLocalReviewContentsParams(
    val repoId: String,
    val path: String,
    val oldPath: String?,
    val editingReviewId: String?,
    val baseSha: String,
    val rightVersion: String
)

class GetReviewContentsResult(
    val repoRoot: String?,
    val leftPath: String,
    val rightPath: String,
    val left: String?,
    val right: String?
)

class TextDocumentFromKeyParams(val key: Int)

class TextDocumentFromKeyResult(
    val textDocument: TextDocumentIdentifier,
    val range: Range,
    val marker: JsonObject
)

class TelemetryParams(
    val eventName: String,
    val properties: Map<String, Any>? = null,
    val options: TelemetryParamsOptions? = null
)

class TelemetryParamsOptions(
    val alias: String?
)

class TelemetryResult()

class SetServerUrlParams(
    val serverUrl: String,
    val disableStrictSSL: Boolean = false,
    val environment: String
)

class SetServerUrlResult

class Codemark(
    val id: String,
    val color: String?,
    val streamId: String,
    val postId: String?,
    val status: String?,
    val pinned: Boolean?,
    val followerIds: List<String>?,
    val reviewId: String?
)

class TextDocument(val uri: String)

class Post(
    val id: String,
    val version: Int?,
    val streamId: String,
    val creatorId: String?,
    val mentionedUserIds: List<String>?,
    val text: String,
    val deactivated: Boolean,
    val hasBeenEdited: Boolean,
    val numReplies: Int,
    val reactions: JsonElement?,
    val parentPostId: String?,
    val codemark: Codemark?,
    val review: Review?
) {
    val isNew: Boolean
        get() {
            return if (version != null) {
                version == 1
            } else {
                !deactivated && !hasBeenEdited && numReplies == 0 && reactions == null
            }
        }
}

class Review(
    val id: String,
    val postId: String,
    val title: String,
    val followerIds: List<String>?,
    val reviewChangesets: List<ReviewChangeset>
)

class PullRequest(
    val title: String,
    val providerId: String,
    val id: String
)

class PullRequestNotification(
    val queryName: String,
    val pullRequest: PullRequest
)

class ReviewChangeset(
    val repoId: String,
    val checkpoint: Int,
    val modifiedFiles: List<ReviewChangesetFileInfo>,
    val modifiedFilesInCheckpoint: List<ReviewChangesetFileInfo>
)

class ReviewChangesetFileInfo(
    val oldFile: String,
    val file: String
)

class Stream(
    val id: String,
    val type: StreamType,
    val name: String?
)

enum class StreamType {
    @SerializedName("channel")
    CHANNEL,

    @SerializedName("direct")
    DIRECT,

    @SerializedName("file")
    FILE
}

class GetStreamParams(
    val streamId: String
)

class GetUserParams(
    val userId: String
)

class GetUsersParams()

class GetPostParams(
    val streamId: String,
    val postId: String
)

class GetReviewParams(val reviewId: String)

class getPullRequestFilesChangedParams(val pullRequestId: String)

class getPullRequestFilesParams(
    val method: String,
    val providerId: String,
    val params: getPullRequestFilesChangedParams
)

class PullRequestFile(
    val sha: String,
    val previousFilename: String?,
    val filename: String,
    val status: String,
    val additions: Int,
    val changes: Int,
    val deletions: Int,
    val patch: String?
)

class ExecuteThirdPartyRequestParams(
    val method: String,
    val providerId: String,
    val params: ThirdPartyRequestParams
)

interface ThirdPartyRequestParams

class GetPullRequestReviewIdParams(
    val pullRequestId: String
) : ThirdPartyRequestParams

class Marker(
    val id: String,
    val code: String
)

class GetFileContentsAtRevisionParams(
    val repoId: String?,
    val path: String,
    val sha: String
)

class GetFileContentsAtRevisionResult(
    val repoRoot: String,
    val content: String,
    val error: String?
)

class CreateReviewsForUnreviewedCommitsParams(
    val sequence: Int
)

class CreateReviewsForUnreviewedCommitsResult(
    val reviewIds: List<String>
)

class FollowReviewParams(
    val id: String,
    val value: Boolean
)

class FollowReviewResult()

class ResolveStackTraceLineParams(
    val rawLine: String,
    val repoRemote: String,
    val sha: String
)

class ResolveStackTraceLineResult(
    val repoId: String?,
    val fileRelativePath: String?,
    val fileFullPath: String?,
    val line: Int?,
    val column: Int?,
    val error: String?
)

class PixieDynamicLoggingParams(
    val functionName: String,
    val functionParameters: List<PixieDynamicLoggingFunctionParameter>,
    val functionReceiver: String?,
    val packageName: String,
    val upid: String
)

class PixieDynamicLoggingFunctionParameter(
    val name: String,
    val type: String
)

class PixieDynamicLoggingResult(
    val id: String
)

class PixieDynamicLoggingEvent(
    val id: String,
    val metaData: List<String>?,
    val data: List<Map<String, String>>?,
    val error: String?,
    val status: String,
    val done: Boolean
)

class FileLevelTelemetryOptions(
    val includeThroughput: Boolean?,
    val includeAverageDuration: Boolean?,
    val includeErrorRate: Boolean?
)

class FileLevelTelemetryParams(
    val filePath: String,
    val languageId: String,
    val codeNamespace: String?,
    val newRelicAccountId: Int?,
    val newRelicEntityGuid: String?,
    val resetCache: Boolean?,
    val options: FileLevelTelemetryOptions?
)

data class MethodLevelTelemetrySymbolIdentifier(
    val className: String?,
    val functionName: String
)

open class MethodLevelTelemetryData(
    val className: String?,
    val functionName: String,
    val metricTimesliceName: String
) {
    val symbolIdentifier: MethodLevelTelemetrySymbolIdentifier
        get() = MethodLevelTelemetrySymbolIdentifier(className, functionName)
}

class MethodLevelTelemetryThroughput (
    className: String?,
    functionName: String,
    metricTimesliceName: String,
    val requestsPerMinute: Float
) : MethodLevelTelemetryData(className, functionName, metricTimesliceName)

class MethodLevelTelemetryAverageDuration(
    className: String?,
    functionName: String,
    metricTimesliceName: String,
    val averageDuration: Float
) : MethodLevelTelemetryData(className, functionName, metricTimesliceName)

class MethodLevelTelemetryErrorRate(
    className: String?,
    functionName: String,
    metricTimesliceName: String,
    val errorsPerMinute: Float
) : MethodLevelTelemetryData(className, functionName, metricTimesliceName)

class FileLevelTelemetryResult(
    var error: FileLevelTelemetryResultError?,
    val repo: CSRepo,
    val throughput: List<MethodLevelTelemetryThroughput>?,
    val averageDuration: List<MethodLevelTelemetryAverageDuration>?,
    val errorRate: List<MethodLevelTelemetryErrorRate>?,
    val lastUpdateDate: Int?,
    val hasAnyData: Int?,
    val sinceDateFormatted: String?,
    val newRelicAccountId: Int?,
    val newRelicEntityGuid: String?,
    val newRelicEntityName: String?,
    val newRelicUrl: String?,
    // val newRelicEntityAccounts: EntityAccount[];
    val codeNamespace: String?,
    val relativeFilePath: String?
)

class FileLevelTelemetryResultError(
    val type: String
)

class ScmRangeInfoParams(
    val uri: String,
    val range: Range
)

class ScmRangeInfoResult(
    val uri: String,
    val range: Range,
    val contents: String,
    val scm: ScmRangeInfoResultScm?,
    val error: String?,
    val context: JsonObject?,
    val ignored: Boolean?,
// context?: {
//     pullRequest?: {
//         id: string;
//         providerId: string;
//         pullRequestReviewId?: string;
//     };
)

class ScmRangeInfoResultScm(
    val file: String,
    val repoPath: String,
    val repoId: String?,
    val revision: String?,
    val fixedGitSha: Boolean?,
    val authors: List<BlameAuthor>,
    val remotes: List<GitRemote>,
    val branch: String?
)
class BlameAuthor()
class GitRemote(
    val name: String,
    val url: String
)

class ScmSha1RangesParams(
    val repoId: String,
    val filePath: String,
    val baseSha: String,
    val headSha: String
)

class ScmSha1RangesResult(
    val baseLinesChanged: ScmSha1RangesResultLinesChanged,
    val headLinesChanged: ScmSha1RangesResultLinesChanged
)

class ScmSha1RangesResultLinesChanged(
    val start: Int,
    val end: Int
)

class CreateShareableCodemarkParams(
    val attributes: ShareableCodemarkAttributes,
    val parentPostId: String?,
    val memberIds: List<String>,
    val textDocuments: List<TextDocumentIdentifier>?,
    val entryPoint: String?,
    val mentionedUserIds: List<String>?,
    val addedUsers: List<String>?,
    // files?: Attachment[];
    // parentPostId?: string;
    // isPseudoCodemark?: boolean;
    // /**
    //  * true, if this "comment" is part of a PR provider review, rather than a single comment
    //  */
    val isProviderReview: Boolean?,
    // /**
    //  * the possible reviewId of
    //  */
    // pullRequestReviewId?: string;
    val ideName: String?
)

class ShareableCodemarkAttributes(
    // providerType?: ProviderType | undefined;
    val type: String, // TODO CodemarkType,
    val text: String?,
    // streamId?: string;
    // postId?: string;
    val parentPostId: String?,
    // status?: string;
    // title?: string;
    // assignees?: string[];
    // tags?: string[];
    val remotes: List<String>?,
    // externalProvider?: string;
    // externalProviderUrl?: string;
    // externalProviderHost?: string;
    // externalAssignees?: { displayName: string; email?: string }[];
    // remoteCodeUrl?: { name: string; url: string };
    // threadUrl?: string;
    // createPermalink?: false | "public" | "private";
    // relatedCodemarkIds?: string[];

    val codeBlocks: List<ScmRangeInfoResult>
    // crossPostIssueValues?: CrossPostIssueValues;
)

class CreateShareableCodemarkResult(
    val pullRequest: JsonObject?,
    val directives: JsonObject?
)

