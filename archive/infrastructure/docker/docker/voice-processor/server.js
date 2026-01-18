const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `voice-${timestamp}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// Environment variables
const MODEL_RUNNER_URL = process.env.MODEL_RUNNER_URL || 'http://model-runner.docker.internal/engines/v1';
const SPEECH_MODEL = process.env.SPEECH_MODEL || 'ai/whisper:base-Q4_K_M';

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    service: 'voice-processor',
    modelRunner: MODEL_RUNNER_URL,
    speechModel: SPEECH_MODEL
  });
});

// Test Docker Model Runner connectivity
app.get('/test-connection', async (req, res) => {
  try {
    const response = await fetch(`${MODEL_RUNNER_URL}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (response.ok) {
      const models = await response.json();
      res.json({ 
        connected: true, 
        modelRunner: MODEL_RUNNER_URL,
        availableModels: models
      });
    } else {
      res.status(500).json({ 
        connected: false, 
        error: `HTTP ${response.status}`,
        modelRunner: MODEL_RUNNER_URL
      });
    }
  } catch (error) {
    res.status(500).json({ 
      connected: false, 
      error: error.message,
      modelRunner: MODEL_RUNNER_URL
    });
  }
});

// Audio transcription endpoint
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const audioPath = req.file.path;
    const audioBuffer = fs.readFileSync(audioPath);

    // Create form data for the transcription request
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: req.file.mimetype });
    formData.append('file', audioBlob, req.file.filename);
    formData.append('model', SPEECH_MODEL);
    formData.append('response_format', 'json');

    // Send to Docker Model Runner
    const response = await fetch(`${MODEL_RUNNER_URL}/audio/transcriptions`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: HTTP ${response.status}`);
    }

    const transcriptionResult = await response.json();

    // Clean up uploaded file
    fs.unlinkSync(audioPath);

    res.json({
      success: true,
      transcription: transcriptionResult.text || transcriptionResult.transcript,
      duration: req.file.size, // Approximate
      model: SPEECH_MODEL,
      confidence: transcriptionResult.confidence || null
    });

  } catch (error) {
    console.error('Transcription error:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Real-time speech endpoint (for future WebSocket integration)
app.post('/speech/stream', express.raw({ type: 'audio/*', limit: '1mb' }), async (req, res) => {
  try {
    // This would be for real-time audio streaming
    // For now, just return a placeholder
    res.json({
      success: true,
      message: 'Real-time speech streaming not yet implemented',
      suggestion: 'Use /transcribe endpoint for file-based transcription'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get available models
app.get('/models', async (req, res) => {
  try {
    const response = await fetch(`${MODEL_RUNNER_URL}/models`);
    
    if (response.ok) {
      const models = await response.json();
      res.json({
        success: true,
        models: models,
        speechModel: SPEECH_MODEL
      });
    } else {
      res.status(500).json({
        success: false,
        error: `Failed to fetch models: HTTP ${response.status}`
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Voice processor service running on port ${port}`);
  console.log(`Model Runner URL: ${MODEL_RUNNER_URL}`);
  console.log(`Speech Model: ${SPEECH_MODEL}`);
}); 