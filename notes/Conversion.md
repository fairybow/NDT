# Converting Stereo to Mono

To convert stereo audio to mono in a Node.js application, we can use the `ffmpeg` library.

```javascript
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function convertStereoToMono(inputFile, outputFile) {
  return new Promise((resolve, reject) => {
    // Create directory for the output file if it doesn't exist
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Set up ffmpeg command to convert to mono
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputFile,
      '-ac', '1',  // Set audio channels to 1 (mono)
      '-ar', '16000',  // Optional: set sample rate to 16kHz (good for speech recognition)
      '-y',  // Overwrite output file if it exists
      outputFile
    ]);

    ffmpeg.stderr.on('data', (data) => {
      // FFmpeg outputs status to stderr, which isn't necessarily an error
      console.log(`FFmpeg: ${data}`);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(outputFile);
      } else {
        reject(new Error(`FFmpeg process exited with code ${code}`));
      }
    });
  });
}

// Example batch processing function
async function batchConvertToMono(inputDir, outputDir) {
  // Get all audio files
  const files = fs.readdirSync(inputDir).filter(file =>
    ['.wav', '.mp3', '.aac', '.m4a', '.flac'].includes(path.extname(file).toLowerCase())
  );

  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, `mono_${file}`);

    try {
      await convertStereoToMono(inputPath, outputPath);
      console.log(`Successfully converted ${file} to mono`);
    } catch (error) {
      console.error(`Failed to convert ${file}: ${error.message}`);
    }
  }
}
```

To use this in your application:

1. Install FFmpeg on your system if you haven't already
2. Install the necessary Node.js dependencies: `npm install child_process fs path`
3. Use the `convertStereoToMono` function before sending files to Deepgram
