// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const { createClient } = require('@deepgram/sdk');
const { PostProcess } = require('./postprocessing.js');
const fs = require('fs');
const path = require('path');

// Create Deepgram client using API key from environment variables
const apiKey = process.env.DEEPGRAM_API_KEY;

// Exit if no API key is found
if (!apiKey) {
    console.error('Please set DEEPGRAM_API_KEY in your .env file');
    process.exit(1);
}

// Initialize Deepgram client with the API key
const deepgram = createClient(apiKey);
console.log('Deepgram Instance: ', deepgram);

// ----------

/**
 * Gets paths to audio files in the specified directory that match given extensions
 *
 * @param {string} inputDir - Directory to search for audio files
 * @param {string[]} extensions - Array of file extensions to include (default: ['.wav'])
 * @returns {string[]} - Array of full paths to matching audio files
 */
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

/**
 * Transcribes a single audio file using Deepgram API
 *
 * @param {string} filePath - Path to the audio file
 * @param {object} options - Transcription options for Deepgram API
 * @returns {object} - Transcription result from Deepgram
 * @throws {Error} - If transcription fails
 */
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

/**
 * Converts JavaScript object to formatted JSON string
 *
 * @param {any} javascriptValue - Value to convert to JSON
 * @returns {string} - Formatted JSON string with 2-space indentation
 */
function jsonString(javascriptValue) {
    return JSON.stringify(javascriptValue, null, 2);
}

/**
 * Saves both raw and post-processed transcription results to files
 *
 * @param {string} filePath - Original audio file path (used for output naming)
 * @param {object} transcription - Raw transcription result from Deepgram
 * @param {string} outputDir - Directory to save output files
 * @param {boolean} includeTimestamps - Whether to include timestamps in post-processed output
 * @throws {Error} - If saving fails
 */
function saveTranscription(
    filePath,
    transcription,
    outputDir,
    includeTimestamps
) {
    try {
        const fileName = path.basename(filePath);

        // Define output file paths for both raw and post-processed results
        const rawPath = path.join(outputDir, `${fileName}.raw.json`);
        const postProcessedJsonPath = path.join(
            outputDir,
            `${fileName}.post.json`
        );

        // Convert results to formatted JSON strings
        const rawJson = jsonString(transcription);
        const postProcessedJson = jsonString(
            PostProcess.json(transcription, includeTimestamps)
        );

        // Write both versions to files
        fs.writeFileSync(rawPath, rawJson);
        fs.writeFileSync(postProcessedJsonPath, postProcessedJson);

        console.log(`Transcriptions saved to: ${outputDir}`);
    } catch (error) {
        console.error(`Error saving transcription for ${filePath}:`, error);
        throw error; // Re-throw if you want calling functions to handle it
    }
}

/**
 * Processes multiple audio files sequentially, transcribing and saving results
 *
 * @param {string} inputDir - Directory containing audio files
 * @param {string} outputDir - Directory to save transcription outputs
 * @param {object} options - Transcription options for Deepgram API
 * @param {boolean} includeTimestamps - Whether to include timestamps in output
 * @returns {boolean} - True if files were processed, false if no files found
 */
async function transcribeFiles(
    inputDir,
    outputDir,
    options = {},
    includeTimestamps
) {
    // Get list of audio files to process
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
            // Continue with next file instead of halting the entire process
        }
    }

    console.log('All files processed.');
    return true;
}

/**
 * Main function that parses command line arguments and orchestrates the transcription process
 */
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

    // Configure Deepgram API options
    // Smart format is a feature that: auto capitalizes; adds punctuation;
    // formats numbers, currencies, and dates; and removes filler words ("um").

    // Utterances generates timestamps for significant pauses in speech,
    // breaking the speech into logical segments.
    const options = {
        diarize: true,
        model: 'nova-3',
        smart_format: true, // Should not affect filler words, according to Deepgram's AI assistant
        utterances: true,
        language: 'en', // Filler words are only available for English

        // Individual smart format features
        //punctuate: true,
        //capitalization: true,
        //numerals: true, // Format numbers
        profanity_filter: false,
        //paragraphs: true,
        filler_words: true, // A huge EOT cue, true = has filler words
        keyterms: [
            'uh:2',
            'um:2',
            'mhmm:2',
            'mm-mm:2',
            'uh-uh:2',
            'uh-huh:2',
            'nuh-uh:2'
        ]
    };

    // I cannot for the life of me get filler words to show.
    // https://github.com/orgs/deepgram/discussions/916

    // Start the transcription process
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

// Execute the main function and handle any uncaught errors
main().catch((error) => {
    console.error('Application error:', error);
    process.exit(1);
});
