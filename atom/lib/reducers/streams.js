const initialState = {
	byTeam: {
		//[teamId]: { [streamId]: {} }
	},
	byRepo: {
		//[repoId]: { byFile: {} }
	}
};

const addStreamForTeam = (state, stream) => {
	const teamId = stream.teamId;
	const teamStreams = state[teamId] || {};
	return {
		...state,
		[teamId]: { ...teamStreams, [stream.id]: stream }
	};
};

const addStream = (state, stream) => {
	const existingStreamsForRepo = state.byRepo[stream.repoId] || { byFile: {}, byId: {} };
	return {
		byTeam: addStreamForTeam(state.byTeam, stream),
		byRepo: {
			...state.byRepo,
			[stream.repoId]: {
				byFile: {
					...existingStreamsForRepo.byFile,
					[stream.file]: stream
				},
				byId: {
					...existingStreamsForRepo.byId,
					[stream.id]: stream
				}
			}
		}
	};
};

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "ADD_STREAMS":
		case "BOOTSTRAP_STREAMS":
			return payload.reduce(addStream, state);
		case "STREAMS-UPDATE_FROM_PUBNUB":
		case "ADD_STREAM":
			return addStream(state, payload);
		default:
			return state;
	}
};

// Selectors
export const getStreamForTeam = (state, teamId) => {
	const streams = state.byTeam[teamId] || {};
	return Object.values(streams).find(stream => stream.isTeamStream && stream.name === "general");
};

export const getChannelStreamsForTeam = (state, teamId, userId) => {
	const streams = state.byTeam[teamId] || {};
	return Object.values(streams).filter(
		stream =>
			stream.type === "channel" && (stream.isTeamStream || _.contains(stream.memberIds, userId))
	);
};

export const getPublicChannelStreamsForTeam = (state, teamId, userId) => {
	const streams = state.byTeam[teamId] || {};
	return Object.values(streams).filter(
		stream =>
			stream.type === "channel" && !stream.isTeamStream && !_.contains(stream.memberIds, userId)
	);
};

const makeName = user => {
	if (!user) return;
	if (user.username) {
		return user.username;
	} else {
		return user.email.replace(/@.*/, "");
	}
};

const makeDirectMessageStreamName = (memberIds, users) => {
	const names = memberIds.map(id => makeName(users[id])).filter(Boolean);
	if (!names) {
		console.log(memberIds);
		return "NO NAME";
	}
	return names.join(", ");
};

export const getDirectMessageStreamsForTeam = (state, teamId, userId, users) => {
	const streams = state.byTeam[teamId] || {};
	const directStreams = Object.values(streams).filter(stream => stream.type === "direct");
	directStreams.map(stream => {
		// if it's a direct message w/myself, then use my name, otherwise exclude myself
		if (stream.memberIds.length === 1 && stream.memberIds[0] === userId) {
			stream.name = makeDirectMessageStreamName([userId], users);
		} else {
			const withoutMe = (stream.memberIds || []).filter(id => id !== userId);
			stream.name = makeDirectMessageStreamName(withoutMe, users);
		}
	});
	return directStreams;
};

export const getStreamForId = (state, teamId, streamId) => {
	const streams = state.byTeam[teamId] || {};
	return Object.values(streams).find(stream => stream.id === streamId);
};

export const getStreamForRepoAndFile = (state, repoId, file) => {
	const filesForRepo = (state.byRepo[repoId] || {}).byFile;
	if (filesForRepo) return filesForRepo[file];
};

export const getStreamsByFileForRepo = (state, repoId) => {
	return (state.byRepo[repoId] || {}).byFile;
};

export const getStreamsByIdForRepo = (state, repoId) => {
	return (state.byRepo[repoId] || {}).byId;
};
