# Project Objective: Creating EOT Training Data

## Data Generation Framework

Our project aims to create structured JSON data from conversational transcripts to train End-of-Turn (EOT) detection models. While acoustic features like pitch contour are valuable for EOT detection in audio, our current focus is on developing a purely text-based dataset that captures the textual patterns of turn completion and transition.

## Methodology

We're extracting turn-taking patterns from transcripts where the textual content, not transcription accuracy, is our primary concern. The JSON data we're generating will model various turn-taking scenarios, including:

- Complete turns (when a speaker naturally finishes)
- Interrupted turns (where one speaker interrupts but the original speaker continues)
- Abandoned turns (when a speaker stops without completion)

## Practical Application

In cases of overlapping speech, we prioritize clarity by focusing on the primary speaker's content. For instance, if Speaker 0 continues talking despite Speaker 1's interruption, we may simplify the data by labeling Speaker 0's turn as "not over" (EOT=false) while preserving only the relevant speech content without the crosstalk.

This approach allows us to create clean, structured training data that captures the essential textual markers of EOT while maintaining the integrity of the conversational flow patterns.
