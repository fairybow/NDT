// https://github.com/orgs/deepgram/discussions/491#discussioncomment-7857447

/**
 * Determines if an utterance represents the end of a speaker's turn
 * based on textual features.
 *
 * @param {string} text - The utterance text
 * @return {boolean} - Whether this utterance likely represents an end of turn
 */
function determineEOT(text) {
    if (!text || text.trim().length === 0) return true;

    // 1. Check for terminal punctuation
    const endsWithTerminalPunctuation = /[.!?][\s"']*$/.test(text.trim());

    // 2. Check for incomplete phrases/sentences (e.g., trailing off)
    const endsWithEllipsis = /\.{3}$|…$/.test(text.trim());

    // 3. Check for phrases that suggest continuation
    const continuationPhrases = [
        'um',
        'uh',
        'like',
        'you know',
        'i mean',
        'so',
        'and then',
        'but',
        'or',
        'because',
        'however',
        'although',
        'therefore'
    ];

    // Check if the text ends with any continuation phrase
    const endsWithContinuationPhrase = continuationPhrases.some((phrase) =>
        new RegExp(`${phrase}[,\\s]*$`, 'i').test(text.trim())
    );

    // 4. Check if the text appears to be a question without a question mark
    const questionStarters = [
        'what',
        'who',
        'where',
        'when',
        'why',
        'how',
        'is',
        'are',
        'do',
        'does',
        'did',
        'can',
        'could',
        'would',
        'should'
    ];
    const startsWithQuestion = questionStarters.some((starter) =>
        new RegExp(`^${starter}\\b`, 'i').test(text.trim())
    );
    const missingQuestionMark = startsWithQuestion && !text.includes('?');

    // Combine factors to determine EOT
    return (
        endsWithTerminalPunctuation &&
        !endsWithContinuationPhrase &&
        !missingQuestionMark &&
        !endsWithEllipsis
    );
}

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

// This is a fallback.
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
    const results = joinedParagraphs.map((p, index, arr) => {
        const speaker = speakerId.get(`${p.channel}_${p.speaker}`);
        // Join all sentences in the paragraph
        const content = p.sentences.map((s) => s.text).join(' ');

        // Determine if this is the end of turn based on content analysis
        const isEndOfTurn = determineEOT(content);

        // If not the end of turn, check if next paragraph has same speaker
        // If the next paragraph has a different speaker, this IS the end of turn
        let forcedEndOfTurn = false;
        if (!isEndOfTurn && index < arr.length - 1) {
            const nextParagraph = arr[index + 1];
            const nextSpeaker = speakerId.get(
                `${nextParagraph.channel}_${nextParagraph.speaker}`
            );

            // If next speaker is different, force EOT to true
            forcedEndOfTurn = nextSpeaker !== speaker;
        }

        // Create result object based on whether timestamps should be included
        const result = {
            Role: `Speaker ${speaker}`,
            Content: content,
            EndOfTurn: isEndOfTurn || forcedEndOfTurn
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
    const results = utterances.map((u, index, arr) => {
        // Get the speaker ID from the map, or use "Unknown" if not available
        const speaker =
            u.speaker !== undefined
                ? speakerId.get(`${u.channel}_${u.speaker}`)
                : 'Unknown';

        const transcript = u.transcript || '';

        // Determine if this is the end of turn based on content analysis
        const isEndOfTurn = determineEOT(transcript);

        // If not the end of turn, check if next utterance has same speaker
        // If the next utterance has a different speaker, this IS the end of turn
        let forcedEndOfTurn = false;
        if (!isEndOfTurn && index < arr.length - 1) {
            const nextUtterance = arr[index + 1];
            const nextSpeaker =
                nextUtterance.speaker !== undefined
                    ? speakerId.get(
                          `${nextUtterance.channel}_${nextUtterance.speaker}`
                      )
                    : 'Unknown';

            // If next speaker is different, force EOT to true
            forcedEndOfTurn = nextSpeaker !== speaker;
        }

        // Create result object based on whether timestamps should be included
        const result = {
            Role: `Speaker ${speaker}`,
            Content: transcript,
            EndOfTurn: isEndOfTurn || forcedEndOfTurn
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
