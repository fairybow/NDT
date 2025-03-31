// https://github.com/deepgram-starters/node-transcription/blob/30cd3afca725fa09a0e831c19d5302fea0bc0c84/server.js#L4

// Load environment variables
require('dotenv').config();

// Import required modules
const { createClient } = require("@deepgram/sdk");
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

function getAudioFiles(directoryPath, extensions = ['.wav']) {
    try {
      // Check if directory exists
      if (!fs.existsSync(directoryPath)) {
        console.error(`Directory does not exist: ${directoryPath}`);
        return [];
      }

      // Get all files in directory
      const files = fs.readdirSync(directoryPath);

      // Filter for audio files based on extensions
      const audioFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return extensions.includes(ext);
      });

      // Return full paths
      return audioFiles.map(file => path.join(directoryPath, file));

    } catch (error) {
      console.error('Error getting audio files:', error);
      return [];
    }
  }

  async function transcribeFile(filePath, options = {}) {
    console.log(`Transcribing: ${filePath}`);

    // Set default options if not provided
    const transcriptionOptions = {
      punctuate: true,
      diarize: true,
      model: "nova-2",
      ...options
    };

    // Send to Deepgram
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      fs.readFileSync(filePath),
      transcriptionOptions
    );

    if (error) {
      console.error(`Error transcribing file ${filePath}:`, error);
      throw error;
    }

    return result;
  }

  function saveTranscription(filePath, transcription) {
    // do this in sep dir
    const outputPath = filePath + '.json';
    fs.writeFileSync(outputPath, JSON.stringify(transcription, null, 2));
    console.log(`Transcription saved to: ${outputPath}`);

    // Also save just the transcript text for convenience
    const textPath = filePath + '.txt';
    // Get the transcript from the result (adjust this path as needed based on Deepgram's response structure)
    const transcriptText = transcription.results?.channels[0]?.alternatives[0]?.transcript || '';
    fs.writeFileSync(textPath, transcriptText);
    console.log(`Plain text transcript saved to: ${textPath}`);
  }

  async function transcribeDirFiles(directoryPath, transcriptionOptions = {}) {
    const audioFiles = getAudioFiles(directoryPath);

    if (audioFiles.length === 0) {
      console.log('No audio files found.');
      return;
    }

    console.log(`Found ${audioFiles.length} audio files to process.`);

    // Process files sequentially to avoid overwhelming the API
    for (const filePath of audioFiles) {
      try {
        const result = await transcribeFile(filePath, transcriptionOptions);
        saveTranscription(filePath, result);
      } catch (error) {
        console.error(`Failed to process ${filePath}:`, error);
        // Continue with next file
      }
    }

    console.log('All files processed.');
  }

  // Main function
  async function main() {
    // Check command line arguments
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.error('Please provide a directory path as an argument');
      console.error('Usage: node index.js <directoryPath> [--smart]');
      process.exit(1);
    }

    const directoryPath = args[0];
    const useSmartFeatures = args.includes('--smart');

    // Need to figure out if audio input is single or dual channel.
    // We only need to diarize is audio is mono.
    // We may want to convert all stereo to mono and diarize all.
    // Currently, our test files are all 8.000 kHz, mono, 16 bit.
    const transcriptionOptions = {
      punctuate: true,
      diarize: true,

      // Smart features
      model: useSmartFeatures ? 'nova-2' : 'base',
      smart_format: useSmartFeatures,
      utterances: useSmartFeatures
    };

    await transcribeDirFiles(directoryPath, transcriptionOptions);
  }

  // Run the application
  main().catch(error => {
    console.error('Application error:', error);
    process.exit(1);
  });
