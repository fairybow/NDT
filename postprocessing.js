// https://github.com/orgs/deepgram/discussions/491#discussioncomment-7857447

function addChannelToParagraph(paragraph, channel) {
    return {
        ...paragraph,
        channel
    };
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    seconds = seconds - hours * 3600;
    const minutes = Math.floor(seconds / 60);
    seconds = seconds - minutes * 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${Math.floor(seconds).toString().padStart(2, '0')}`;
}

function script(data) {
    // Check if we have valid data to process
    if (!data?.results?.channels || !Array.isArray(data.results.channels)) {
        return '';
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

    // Format the paragraphs spoken by each speaker
    let result = '';

    joinedParagraphs.forEach((p) => {
        const start = formatTime(p.start);
        const speaker = speakerId.get(`${p.channel}_${p.speaker}`);

        // Join all sentences in the paragraph
        const sentences = p.sentences.map((s) => s.text).join(' ');

        result += `${start} Speaker ${speaker}: ${sentences}\n\n`;
    });

    return result;
}

function jsonScript(data) {
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

        return {
            timestamp: formatTime(p.start),
            role: `Speaker ${speaker}`,
            content
        };
    });

    return { results };
}

module.exports = {
    PostProcessing: {
        script,
        jsonScript
    }
};
