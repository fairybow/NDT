// Example uses outdated SDK:
// https://github.com/deepgram-starters/node-transcription/blob/30cd3afca725fa09a0e831c19d5302fea0bc0c84/server.js#L4

// Load environment variables
require('dotenv').config();

// Import required modules
const { createClient } = require('@deepgram/sdk');
const { PostProcessing } = require('./postprocessing.js');
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

// ----------

function audioFilePaths(inputDir, extensions = ['.wav']) {
    try {
        // Check if directory exists
        if (!fs.existsSync(inputDir)) {
            console.error(`Directory does not exist: ${inputDir}`);
            return [];
        }

        // Get all files in directory and filter for audio files based on
        // extensions
        const audioFilePaths = fs.readdirSync(inputDir).filter((file) => {
            const extension = path.extname(file).toLowerCase();
            return extensions.includes(extension);
        });

        // Return full paths
        return audioFilePaths.map((file) => path.join(inputDir, file));
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

function jsonString(javascriptValue) {
    return JSON.stringify(javascriptValue, null, 2);
}

function saveTranscription(filePath, transcription, outputDir) {
    try {
        const fileName = path.basename(filePath);

        const rawPath = path.join(outputDir, `${fileName}.raw.json`);
        const postProcessedTextPath = path.join(
            outputDir,
            `${fileName}.post.txt`
        );
        const postProcessedJsonPath = path.join(
            outputDir,
            `${fileName}.post.json`
        );

        const rawJson = jsonString(transcription);
        const postProcessedText = PostProcessing.textScript(transcription);
        const postProcessedJson = jsonString(
            PostProcessing.jsonScript(transcription)
        );

        fs.writeFileSync(rawPath, rawJson);
        fs.writeFileSync(postProcessedTextPath, postProcessedText);
        fs.writeFileSync(postProcessedJsonPath, postProcessedJson);

        console.log(`Transcriptions saved to: ${outputDir}`);
    } catch (error) {
        console.error(`Error saving transcription for ${filePath}:`, error);
        throw error; // Re-throw if you want calling functions to handle it
    }
}

async function transcribeFiles(inputDir, outputDir, options = {}) {
    const filePaths = audioFilePaths(inputDir);

    if (filePaths.length === 0) {
        console.log('No audio files found.');
        return false;
    }

    console.log(`Found ${filePaths.length} audio files to process.`);

    // Process files sequentially to avoid overwhelming the API
    for (const filePath of filePaths) {
        try {
            const result = await transcribeFile(filePath, options);
            saveTranscription(filePath, result, outputDir);
        } catch (error) {
            console.error(`Failed to process ${filePath}:`, error);
            // Continue with next file
        }
    }

    console.log('All files processed.');
    return true;
}

async function main() {
    // Check command line arguments
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Please provide a directory path as an argument');
        console.error(
            'Usage: node index.js <directoryPath> <optional: outputPath>'
        );
        process.exit(1);
    }

    const inputDir = args[0];
    const outputDir = args.length > 1 ? args[1] : inputDir;

    // Create output directory if it doesn't exist
    try {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
    } catch (error) {
        console.error(`Failed to create output directory ${outputDir}:`, error);
        process.exit(1);
    }

    // Need to figure out if audio input is single or dual channel. We only need
    // to diarize if audio is mono. However, we may want to convert all stereo
    // to mono and diarize all. Currently, our test files are all 8.000 kHz,
    // mono, 16 bit.

    // Smart format is a feature that: auto capitalizes; adds punctuation;
    // formats numbers, currencies, and dates; and removes filler words ("um").

    // Utterances generates timestamps for significant pauses in speech,
    // breaking the speech into logical segments.

    // Can manipulate with args later
    const options = {
        diarize: true, // Required for postprocessing.js
        model: 'nova-3',
        smart_format: true,
        utterances: true,
        language: 'multi' // <- didn't do so hot lol
    };

    const processed = await transcribeFiles(inputDir, outputDir, options);

    if (!processed) {
        console.error('No audio files were found for processing. Exiting.');
        process.exit(0);
    }
}

// ----------

main().catch((error) => {
    console.error('Application error:', error);
    process.exit(1);
});
