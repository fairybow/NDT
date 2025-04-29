# Project Objective: Creating EOT Training Data

## Data Generation Framework

Our project aims to create structured JSON data from conversational transcripts to train End-of-Turn (EOT) detection models. While acoustic features like pitch contour are valuable for EOT detection in audio, our current focus is on developing a purely text-based dataset that captures the textual patterns of turn completion and transition.

## Methodology

We're extracting turn-taking patterns from transcripts where the textual content, not transcription accuracy, is our primary concern. The JSON data we're generating will model various turn-taking scenarios, including:

- Complete turns (when a speaker naturally finishes)
- Interrupted turns (where one speaker interrupts but the original speaker continues)
- Abandoned turns (when a speaker stops without completion)

## Editing Choices and Assumptions

I'll edit the Timestamps section to make it clearer and better worded. Here's my improved version:

## Editing Choices and Assumptions

### Problematic Crosstalk

In cases of overlapping speech, we prioritize clarity by focusing on the primary speaker's content. For instance, if Speaker 0 continues talking despite Speaker 1's interruption, we may simplify the data by labeling Speaker 0's turn as "not over" (EOT=false) while preserving only the relevant speech content without the crosstalk.

This approach allows us to create clean, structured training data that captures the essential textual markers of EOT while maintaining the integrity of the conversational flow patterns.

### Timestamps

We've chosen to exclude timestamps from our processed output for several practical reasons:

1. Deepgram's speaker diarization frequently misidentifies speakers in single-channel audio, requiring extensive manual JSON restructuring

2. When correcting these speaker attribution errors by splitting content blocks, maintaining accurate timestamps becomes prohibitively time-consuming

3. Since our EOT detection model focuses exclusively on textual patterns rather than acoustic features, timestamp data adds complexity without providing significant value to the training dataset

This decision prioritizes dataset quality and development efficiency while remaining aligned with our objective of building a robust text-based EOT detection model.
