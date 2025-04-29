// Load environment variables
require('dotenv').config();

// Import required modules
const { createClient } = require('@deepgram/sdk');
const { PostProcess } = require('./postprocessing.js');
const fs = require('fs');
const path = require('path');

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

function saveTranscription(
    filePath,
    transcription,
    outputDir,
    includeTimestamps
) {
    try {
        const fileName = path.basename(filePath);

        const rawPath = path.join(outputDir, `${fileName}.raw.json`);
        const postProcessedJsonPath = path.join(
            outputDir,
            `${fileName}.post.json`
        );

        const rawJson = jsonString(transcription);
        const postProcessedJson = jsonString(
            PostProcess.json(transcription, includeTimestamps)
        );

        fs.writeFileSync(rawPath, rawJson);
        fs.writeFileSync(postProcessedJsonPath, postProcessedJson);

        console.log(`Transcriptions saved to: ${outputDir}`);
    } catch (error) {
        console.error(`Error saving transcription for ${filePath}:`, error);
        throw error; // Re-throw if you want calling functions to handle it
    }
}

async function transcribeFiles(
    inputDir,
    outputDir,
    options = {},
    includeTimestamps
) {
    const filePaths = audioFilePaths(inputDir);

    if (filePaths.length === 0) {
        console.log('No audio files found.');
        return false;
    }

    console.log(`Found ${filePaths.length} audio files to process.`);
    console.log(
        `Timestamps will be ${includeTimestamps ? 'included' : 'excluded'} in the output.`
    );

    // Process files sequentially to avoid overwhelming the API
    for (const filePath of filePaths) {
        try {
            const result = await transcribeFile(filePath, options);
            saveTranscription(filePath, result, outputDir, includeTimestamps);
        } catch (error) {
            console.error(`Failed to process ${filePath}:`, error);
            // Continue with next file
        }
    }

    console.log('All files processed.');
    return true;
}

async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);

    // Check for help flag
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Usage: node index.js <inputDir> [outputDir] [options]

Options:
  --timestamps, -t       Include timestamps in the output (default: false)
  --help, -h             Show this help message
        `);
        process.exit(0);
    }

    // Check if minimum required arguments are provided
    if (args.length === 0) {
        console.error('Please provide a directory path as an argument');
        console.error('Usage: node index.js <inputDir> [outputDir] [options]');
        console.error('Use --help for more information');
        process.exit(1);
    }

    // Parse arguments
    let inputDir = '';
    let outputDir = '';
    let includeTimestamps = false;

    // Parse non-flag arguments (directories)
    const directories = args.filter((arg) => !arg.startsWith('-'));
    inputDir = directories[0];
    outputDir = directories.length > 1 ? directories[1] : inputDir;

    // Parse flags
    includeTimestamps = args.includes('--timestamps') || args.includes('-t');

    // Create output directory if it doesn't exist
    try {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
    } catch (error) {
        console.error(`Failed to create output directory ${outputDir}:`, error);
        process.exit(1);
    }

    // Smart format is a feature that: auto capitalizes; adds punctuation;
    // formats numbers, currencies, and dates; and removes filler words ("um").

    // Utterances generates timestamps for significant pauses in speech,
    // breaking the speech into logical segments.

    const options = {
        diarize: true, // Required for postprocessing.js
        model: 'nova-3',
        smart_format: true,
        utterances: true,
        language: 'multi'
    };

    const processed = await transcribeFiles(
        inputDir,
        outputDir,
        options,
        includeTimestamps
    );

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
