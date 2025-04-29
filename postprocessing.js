// https://github.com/orgs/deepgram/discussions/491#discussioncomment-7857447

function timestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    seconds = seconds - hours * 3600;
    const minutes = Math.floor(seconds / 60);
    seconds = seconds - minutes * 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${Math.floor(seconds).toString().padStart(2, '0')}`;
}

function addChannelToParagraph(paragraph, channel) {
    return {
        ...paragraph,
        channel
    };
}

function jsonScriptFromParagraphs(data, includeTimestamps) {
    // Check if we have valid data to process
    if (!data?.results?.channels || !Array.isArray(data.results.channels)) {
        return { results: [] };
    }

    // Combine the paragraphs across channels and sort them by the time they
    // were spoken
    const nchannels = data.results.channels.length;
    let joinedParagraphs = [];

    for (let i = 0; i < nchannels; i++) {
        const channel = data.results.channels[i];
        const paragraphs =
            channel?.alternatives?.[0]?.paragraphs?.paragraphs || [];

        // Add channel info to each paragraph
        const paragraphsWithChannel = paragraphs.map((p) =>
            addChannelToParagraph(p, i)
        );
        joinedParagraphs = joinedParagraphs.concat(paragraphsWithChannel);
    }

    // Sort paragraphs by start time
    joinedParagraphs.sort((a, b) => a.start - b.start);

    // If there are multiple speakers in each channel, give them a unique ID
    const speakerId = new Map(); // key = "channel_speakerId"
    joinedParagraphs.forEach((p) => {
        const key = `${p.channel}_${p.speaker}`;
        if (!speakerId.has(key)) {
            speakerId.set(key, speakerId.size);
        }
    });

    // Create JSON format
    const results = joinedParagraphs.map((p) => {
        const speaker = speakerId.get(`${p.channel}_${p.speaker}`);
        // Join all sentences in the paragraph
        const content = p.sentences.map((s) => s.text).join(' ');

        // Create result object based on whether timestamps should be included
        const result = {
            Role: `Speaker ${speaker}`,
            Content: content,
            EndOfTurn: true
        };

        // Add timestamp only if includeTimestamps is true
        if (includeTimestamps) {
            result.Timestamp = timestamp(p.start);
        }

        return result;
    });

    return { results };
}

function json(data, includeTimestamps = false) {
    // Check if we have valid data to process
    if (!data?.results) {
        return { results: [] };
    }

    // Check if utterances are available at the top level
    const utterances = data.results.utterances || [];

    if (utterances.length === 0) {
        // Fall back to the original paragraph-based processing if no utterances
        return jsonScriptFromParagraphs(data, includeTimestamps);
    }

    // Sort utterances by start time (they should already be sorted, but just to be safe)
    utterances.sort((a, b) => a.start - b.start);

    // If there are multiple speakers across utterances, give them a unique ID
    const speakerId = new Map(); // key = "channel_speakerId"
    utterances.forEach((u) => {
        if (u.speaker !== undefined) {
            const key = `${u.channel}_${u.speaker}`;
            if (!speakerId.has(key)) {
                speakerId.set(key, speakerId.size);
            }
        }
    });

    // Create JSON format based on utterances
    const results = utterances.map((u) => {
        // Get the speaker ID from the map, or use "Unknown" if not available
        const speaker =
            u.speaker !== undefined
                ? speakerId.get(`${u.channel}_${u.speaker}`)
                : 'Unknown';

        // Create result object based on whether timestamps should be included
        const result = {
            Role: `Speaker ${speaker}`,
            Content: u.transcript || '',
            EndOfTurn: true
        };

        // Add timestamp only if includeTimestamps is true
        if (includeTimestamps) {
            result.Timestamp = timestamp(u.start);
        }

        return result;
    });

    return { results };
}

module.exports = {
    PostProcess: {
        json
    }
};
