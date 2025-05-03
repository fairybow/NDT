// Reference to Deepgram discussion: https://github.com/orgs/deepgram/discussions/491#discussioncomment-7857447

/**
 * Determines if an utterance represents the end of a speaker's turn
 * based on textual features in the transcription.
 *
 * This function evaluates several linguistic patterns to decide if the text
 * represents a complete thought/statement that likely indicates the speaker
 * has finished their turn in the conversation.
 *
 * @param {string} text - The utterance text to analyze
 * @return {boolean} - Whether this utterance likely represents an end of turn
 */
function determineEOT(text) {
    // Return true for empty text - empty utterances are considered turn boundaries
    if (!text || text.trim().length === 0) return true;

    // 1. Check for terminal punctuation (.!?) that typically ends complete statements
    // Allows for trailing whitespace or quotes after punctuation
    const endsWithTerminalPunctuation = /[.!?][\s"']*$/.test(text.trim());

    // 2. Check for incomplete phrases/sentences (trailing off)
    // Identified by ellipses which often indicate incomplete thoughts
    const endsWithEllipsis = /\.{3}$|…$/.test(text.trim());

    // 3. Check for discourse markers and connectives that suggest continuation
    // These words/phrases typically indicate the speaker intends to continue speaking
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

    /// Potentially add trailing period below, too? (dashes?)

    // Check if the text ends with any continuation phrase
    // Using case-insensitive matching and allowing for trailing commas/whitespace
    const endsWithContinuationPhrase = continuationPhrases.some((phrase) =>
        new RegExp(`${phrase}[,\\s]*$`, 'i').test(text.trim())
    );

    // 4. Check if the text appears to be a question without a question mark
    // First identify common question starters
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

    // Check if text starts with a question word
    const startsWithQuestion = questionStarters.some((starter) =>
        new RegExp(`^${starter}\\b`, 'i').test(text.trim())
    );

    // Identify if it's a question without proper punctuation
    const missingQuestionMark = startsWithQuestion && !text.includes('?');

    // Combine all factors to determine EOT:
    // - Must end with terminal punctuation (indicating completion)
    // - Must NOT end with a continuation phrase (suggesting more to come)
    // - Must NOT be a question without a question mark (incomplete structure)
    // - Must NOT end with ellipsis (suggesting trailing off/incompletion)
    return (
        endsWithTerminalPunctuation &&
        !endsWithContinuationPhrase &&
        !missingQuestionMark &&
        !endsWithEllipsis
    );
}

/**
 * Formats a time value in seconds to HH:MM:SS format
 *
 * @param {number} seconds - Time in seconds
 * @return {string} - Formatted time string (HH:MM:SS)
 */
function timestamp(seconds) {
    // Convert seconds to hours, minutes, and seconds
    const hours = Math.floor(seconds / 3600);
    seconds = seconds - hours * 3600;
    const minutes = Math.floor(seconds / 60);
    seconds = seconds - minutes * 60;

    // Format as HH:MM:SS with zero-padding
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${Math.floor(seconds).toString().padStart(2, '0')}`;
}

/**
 * Adds channel information to a paragraph object
 *
 * @param {object} paragraph - Paragraph object from Deepgram
 * @param {number} channel - Audio channel number
 * @return {object} - Paragraph with added channel property
 */
function addChannelToParagraph(paragraph, channel) {
    return {
        ...paragraph,
        channel
    };
}

/**
 * Fallback function to process transcript data using paragraphs when utterances are not available
 * Creates a JSON structure with speaker turns, content, and EOT status
 *
 * @param {object} data - Raw Deepgram transcription result
 * @param {boolean} includeTimestamps - Whether to include timestamps in output
 * @return {object} - Processed data in the desired JSON format
 */
function jsonScriptFromParagraphs(data, includeTimestamps) {
    // Check if we have valid data to process
    if (!data?.results?.channels || !Array.isArray(data.results.channels)) {
        return { results: [] };
    }

    // Combine the paragraphs across channels and sort them by the time they
    // were spoken
    const nchannels = data.results.channels.length;
    let joinedParagraphs = [];

    // Collect paragraphs from all channels with channel information
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

    // Sort paragraphs by start time to maintain chronological order
    joinedParagraphs.sort((a, b) => a.start - b.start);

    // Map speakers to unique IDs across channels
    // This handles cases where multiple speakers might be on each channel
    const speakerId = new Map(); // key = "channel_speakerId"
    joinedParagraphs.forEach((p) => {
        const key = `${p.channel}_${p.speaker}`;
        if (!speakerId.has(key)) {
            speakerId.set(key, speakerId.size);
        }
    });

    // Create JSON format with turn-taking information
    const results = joinedParagraphs.map((p, index, arr) => {
        // Get speaker ID from the map
        const speaker = speakerId.get(`${p.channel}_${p.speaker}`);

        // Join all sentences in the paragraph to form complete content
        const content = p.sentences.map((s) => s.text).join(' ');

        // Determine if this is the end of turn based on content analysis
        const isEndOfTurn = determineEOT(content);

        // Speaker change detection:
        // If not detected as EOT by text, but next paragraph has different speaker,
        // then force EOT to be true (speaker change is a definitive turn boundary)
        let forcedEndOfTurn = false;
        if (!isEndOfTurn && index < arr.length - 1) {
            const nextParagraph = arr[index + 1];
            const nextSpeaker = speakerId.get(
                `${nextParagraph.channel}_${nextParagraph.speaker}`
            );

            // If next speaker is different, force EOT to true
            forcedEndOfTurn = nextSpeaker !== speaker;
        }

        // Create result object with Role, Content, and EndOfTurn status
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

/**
 * Main processing function to convert Deepgram transcription to turn-based format
 * Prefers utterances when available, falls back to paragraphs otherwise
 *
 * @param {object} data - Raw Deepgram transcription result
 * @param {boolean} includeTimestamps - Whether to include timestamps in output
 * @return {object} - Processed data in the desired JSON format for EOT training
 */
function json(data, includeTimestamps = false) {
    // Check if we have valid data to process
    if (!data?.results) {
        return { results: [] };
    }

    // Check if utterances are available at the top level
    // Utterances are preferred as they better represent natural speech segments
    const utterances = data.results.utterances || [];

    if (utterances.length === 0) {
        // Fall back to the original paragraph-based processing if no utterances
        return jsonScriptFromParagraphs(data, includeTimestamps);
    }

    // Sort utterances by start time (they should already be sorted, but just to be safe)
    utterances.sort((a, b) => a.start - b.start);

    // Map speakers to unique IDs across utterances
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

        // Speaker change detection:
        // If not the end of turn by text analysis, check if next utterance has same speaker
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

        // Create result object with speaker, content, and EOT information
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

// Export the processing function for use in other modules
module.exports = {
    PostProcess: {
        json
    }
};
