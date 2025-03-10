import express from 'express';
import cors from 'cors';
import ytdl from 'ytdl-core';
import { Configuration, OpenAIApi } from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// OpenAI configuration
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Temporary storage for audio files
const TEMP_DIR = path.join(__dirname, '../temp');

// Ensure temp directory exists
fs.mkdir(TEMP_DIR, { recursive: true }).catch(console.error);

app.post('/transcribe', async (req, res) => {
  const { videoUrl } = req.body;
  const tempFilePath = path.join(TEMP_DIR, `${Date.now()}.mp3`);

  try {
    // Validate URL
    if (!videoUrl) {
      return res.status(400).json({ message: 'Video URL is required' });
    }

    console.log('Processing video:', videoUrl);

    // Download and convert video to audio
    await new Promise((resolve, reject) => {
      ytdl(videoUrl, { filter: 'audioonly' })
        .pipe(
          ffmpeg()
            .toFormat('mp3')
            .on('end', resolve)
            .on('error', reject)
            .save(tempFilePath)
        );
    });

    console.log('Audio extracted successfully');

    // Read the audio file
    const audioFile = await fs.readFile(tempFilePath);

    console.log('Starting transcription');

    // Transcribe with Whisper
    const response = await openai.createTranscription(
      audioFile as any,
      'whisper-1'
    );

    console.log('Transcription completed');

    // Clean up temp file
    await fs.unlink(tempFilePath).catch(console.error);

    res.json({ transcription: response.data.text });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ 
      message: 'Failed to transcribe video',
      error: error.message 
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 