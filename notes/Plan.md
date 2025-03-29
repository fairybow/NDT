# Plan

Transcribe audio as described [here](https://developers.deepgram.com/docs/pre-recorded-audio).

(Deepgram's [sample Node application](https://github.com/deepgram-starters/node-transcription).)

Generate transcripts from each audio file using this program (processing all files in a given directory).

Review and correct the transcripts as necessary after listening to each file.

Format as JSON (see below), separating the transcripts into two parties: caller and assistant.

Divide into folders by customer and then use case (may need determining).

---

Two possible approaches:

### Mono Audio (Mixed/Single Channel)
- Use Deepgram's diarization feature to separate speakers
- Enable with `diarize: true` parameter
- Documentation: https://developers.deepgram.com/docs/diarization

### Stereo Audio (Dual Channel)
**Two options:**
1. Process each channel separately
2. Convert to mono and use diarization (same code as mono)

## Investigation Needed
- Compare accuracy between both stereo approaches
- Determine if unified approach (convert all to mono) is viable

## Next Steps
- Implement channel detection
- Test both approaches
- Select simplest reliable method

---

```json
[
  {
    "role": "assistant",
    "content": "Who are you?"
  },
  {
    "role": "caller",
    "content": "I am John."
  },
  {
    "role": "assistant",
    "content": "What is your last name?"
  },
  {
    "role": "caller",
    "content": "Smith."
  }
]
```
