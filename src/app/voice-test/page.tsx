'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Radio, Volume2, Play, Square } from 'lucide-react';

// Voice recognition interfaces (same as in PromptInterface)
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechGrammarList {
  readonly length: number;
  addFromString(string: string, weight?: number): void;
  addFromURI(src: string, weight?: number): void;
  item(index: number): SpeechGrammar;
}

interface SpeechGrammar {
  src: string;
  weight: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: SpeechGrammarList;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  serviceURI: string;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}

export default function VoiceTestPage() {
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [mediaRecorderSupported, setMediaRecorderSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [recordings, setRecordings] = useState<Array<{id: string, url: string, name: string}>>([]);
  const [testResults, setTestResults] = useState<Array<{test: string, result: string, status: 'pass' | 'fail' | 'warning'}>>([]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Test browser capabilities
  useEffect(() => {
    const results: Array<{test: string, result: string, status: 'pass' | 'fail' | 'warning'}> = [];

    // Test Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setVoiceSupported(true);
      results.push({
        test: 'Web Speech API',
        result: 'Available (webkitSpeechRecognition)',
        status: 'pass'
      });
    } else {
      results.push({
        test: 'Web Speech API',
        result: 'Not supported in this browser',
        status: 'fail'
      });
    }

    // Test MediaRecorder
    if (typeof MediaRecorder !== 'undefined') {
      setMediaRecorderSupported(true);
      results.push({
        test: 'MediaRecorder API',
        result: 'Available',
        status: 'pass'
      });
    } else {
      results.push({
        test: 'MediaRecorder API',
        result: 'Not supported',
        status: 'fail'
      });
    }

    // Test getUserMedia
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      results.push({
        test: 'getUserMedia',
        result: 'Available',
        status: 'pass'
      });
    } else {
      results.push({
        test: 'getUserMedia',
        result: 'Not supported',
        status: 'fail'
      });
    }

    // Test AudioContext
    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
      results.push({
        test: 'AudioContext',
        result: 'Available',
        status: 'pass'
      });
    } else {
      results.push({
        test: 'AudioContext',
        result: 'Not supported',
        status: 'warning'
      });
    }

    // Browser detection
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      results.push({
        test: 'Browser',
        result: 'Safari (Best for Web Speech API)',
        status: 'pass'
      });
    } else if (userAgent.includes('Chrome')) {
      results.push({
        test: 'Browser',
        result: 'Chrome (Good compatibility)',
        status: 'pass'
      });
    } else {
      results.push({
        test: 'Browser',
        result: `${userAgent.slice(0, 50)}...`,
        status: 'warning'
      });
    }

    setTestResults(results);
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      
      if (recognitionRef.current) {
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';
        
        recognitionRef.current.onstart = () => {
          setIsListening(true);
        };
        
        recognitionRef.current.onend = () => {
          setIsListening(false);
          setInterimTranscript('');
        };
        
        recognitionRef.current.onresult = (event) => {
          let finalTranscript = '';
          let interim = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcriptPart = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcriptPart;
            } else {
              interim += transcriptPart;
            }
          }
          
          if (finalTranscript) {
            setTranscript(prev => prev + finalTranscript + ' ');
          }
          setInterimTranscript(interim);
        };
        
        recognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          setInterimTranscript('');
        };
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startVoiceRecognition = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
    }
  }, [isListening]);

  const stopVoiceRecognition = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up audio context for visualization
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      // Visualize audio level
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      const updateLevel = () => {
        if (analyserRef.current && isRecording) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setVoiceLevel(average / 255 * 100);
          requestAnimationFrame(updateLevel);
        }
      };
      updateLevel();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const recording = {
          id: Date.now().toString(),
          url: audioUrl,
          name: `Recording ${recordings.length + 1}`
        };
        
        setRecordings(prev => [...prev, recording]);
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        setVoiceLevel(0);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }, [isRecording, recordings.length]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const clearTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">🎤 Voice Interface Test</h1>
        <p className="text-muted-foreground">
          Test Web Speech API and audio recording capabilities for VibeCode's multimodal interface.
        </p>
      </div>

      {/* Browser Capability Tests */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Browser Compatibility</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {testResults.map((result, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded">
                <span className="font-medium">{result.test}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={
                    result.status === 'pass' ? 'default' : 
                    result.status === 'warning' ? 'secondary' : 'destructive'
                  }>
                    {result.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{result.result}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Speech Recognition Test */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            Speech Recognition Test
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={isListening ? stopVoiceRecognition : startVoiceRecognition}
                disabled={!voiceSupported}
                variant={isListening ? 'destructive' : 'default'}
                className="flex items-center gap-2"
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {isListening ? 'Stop Listening' : 'Start Listening'}
              </Button>
              <Button onClick={clearTranscript} variant="outline">
                Clear
              </Button>
            </div>
            
            {isListening && (
              <div className="p-3 bg-green-50 border border-green-200 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-green-700">Listening...</span>
                </div>
                {interimTranscript && (
                  <p className="text-sm text-green-600 italic">&quot;{interimTranscript}&quot;</p>
                )}
              </div>
            )}
            
            <div className="p-4 border rounded min-h-24">
              <p className="text-sm text-muted-foreground mb-2">Speech transcript:</p>
              <p className="text-lg">{transcript || 'Say something...'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audio Recording Test */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="w-5 h-5" />
            Audio Recording Test
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!mediaRecorderSupported}
                variant={isRecording ? 'destructive' : 'default'}
                className="flex items-center gap-2"
              >
                {isRecording ? <Square className="w-4 h-4" /> : <Radio className="w-4 h-4" />}
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </Button>
            </div>
            
            {isRecording && (
              <div className="p-3 bg-red-50 border border-red-200 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-red-700">Recording...</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full transition-all duration-100"
                    style={{ width: `${voiceLevel}%` }}
                  />
                </div>
              </div>
            )}
            
            {recordings.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Recordings:</h4>
                <div className="space-y-2">
                  {recordings.map((recording) => (
                    <div key={recording.id} className="flex items-center gap-3 p-2 border rounded">
                      <Play className="w-4 h-4" />
                      <span className="text-sm">{recording.name}</span>
                      <audio controls className="ml-auto">
                        <source src={recording.url} type="audio/wav" />
                        Your browser does not support audio playback.
                      </audio>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Test Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <strong>Speech Recognition:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 text-muted-foreground">
                <li>Click "Start Listening" and speak clearly</li>
                <li>Watch for real-time transcription in the text box</li>
                <li>Best results in Safari on macOS</li>
              </ul>
            </div>
            <div>
              <strong>Audio Recording:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 text-muted-foreground">
                <li>Click "Start Recording" and speak</li>
                <li>Watch the audio level indicator</li>
                <li>Stop recording and play back your audio</li>
              </ul>
            </div>
            <div>
              <strong>Expected Results:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 text-muted-foreground">
                <li>All tests should show "pass" status in Safari</li>
                <li>Speech recognition should work in real-time</li>
                <li>Audio recording should capture and play back clearly</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 