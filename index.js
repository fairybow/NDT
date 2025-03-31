// Example uses outdated SDK:
// https://github.com/deepgram-starters/node-transcription/blob/30cd3afca725fa09a0e831c19d5302fea0bc0c84/server.js#L4

// Load environment variables
require('dotenv').config();

// Import required modules
const { createClient } = require('@deepgram/sdk');
const fs = require('fs');
const path = require('path');
const util = require('util');

// Create Deepgram client
const apiKey = process.env.DEEPGRAM_API_KEY;

if (!apiKey) {
    console.error('Please set DEEPGRAM_API_KEY in your .env file');
    process.exit(1);
}

const deepgram = createClient(apiKey);
console.log('Deepgram Instance: ', deepgram);

function getAudioFiles(inputDir, extensions = ['.wav']) {
    try {
        // Check if directory exists
        if (!fs.existsSync(inputDir)) {
            console.error(`Directory does not exist: ${inputDir}`);
            return [];
        }

        // Get all files in directory
        const files = fs.readdirSync(inputDir);

        // Filter for audio files based on extensions
        const audioFiles = files.filter((file) => {
            const extension = path.extname(file).toLowerCase();
            return extensions.includes(extension);
        });

        // Return full paths
        return audioFiles.map((file) => path.join(inputDir, file));
    } catch (error) {
        console.error('Error getting audio files:', error);
        return [];
    }
}

async function transcribeFile(filePath, options) {
    console.log(`Transcribing: ${filePath}`);

    // Send to Deepgram
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
        fs.createReadStream(filePath),
        options
    );

    if (error) {
        console.error(`Error transcribing file ${filePath}:`, error);
        throw error;
    }

    return result;
}

function saveTranscription(filePath, transcription, outputDir) {
    // Extract just the filename from the path
    const fileName = path.basename(filePath);

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create output paths using the filename in the output directory
    const outputPath = path.join(outputDir, `${fileName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(transcription, null, 2));
    console.log(`Transcription saved to: ${outputPath}`);

    // Also save just the transcript text for convenience
    const textPath = path.join(outputDir, `${fileName}.txt`);

    // Get the transcript from the result (adjust this path as needed based on Deepgram's response structure)
    const transcriptText =
        transcription.results?.channels[0]?.alternatives[0]?.transcript || '';
    fs.writeFileSync(textPath, transcriptText);
    console.log(`Plain text transcript saved to: ${textPath}`);
}

async function transcribeDirFiles(
    inputDir,
    outputDir,
    transcriptionOptions = {}
) {
    const audioFiles = getAudioFiles(inputDir);

    if (audioFiles.length === 0) {
        console.log('No audio files found.');
        return;
    }

    console.log(`Found ${audioFiles.length} audio files to process.`);

    // Process files sequentially to avoid overwhelming the API
    for (const filePath of audioFiles) {
        try {
            const result = await transcribeFile(filePath, transcriptionOptions);
            saveTranscription(filePath, result, outputDir);
        } catch (error) {
            console.error(`Failed to process ${filePath}:`, error);
            // Continue with next file
        }
    }

    console.log('All files processed.');
}

async function main() {
    // Check command line arguments
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Please provide a directory path as an argument');
        console.error('Usage: node index.js <directoryPath> <outputPath>');
        process.exit(1);
    }

    const inputDir = args[0];
    const outputDir = args.length > 1 ? args[1] : inputDir;

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Need to figure out if audio input is single or dual channel.
    // We only need to diarize if audio is mono.
    // However, we may want to convert all stereo to mono and diarize all.
    // Currently, our test files are all 8.000 kHz, mono, 16 bit.

    // Smart format is a feature that: auto capitalizes; adds punctuation;
    // formats numbers, currencies, and dates; and removes filler words ("um").

    // Utterances generates timestamps for significant pauses in speech,
    // breaking the speech into logical segments.

    const transcriptionOptions = {
        diarize: true,
        model: 'nova-2',
        smart_format: true,
        utterances: true,
    };

    await transcribeDirFiles(inputDir, outputDir, transcriptionOptions);
}

// ----------

main().catch((error) => {
    console.error('Application error:', error);
    process.exit(1);
});
