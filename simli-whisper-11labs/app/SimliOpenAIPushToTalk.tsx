import React, { useCallback, useEffect, useRef, useState } from "react";
import { SimliClient } from "simli-client";
import VideoBox from "./Components/VideoBox";
import cn from "./utils/TailwindMergeAndClsx";
import IconExit from "@/media/IconExit";
import IconSparkleLoader from "@/media/IconSparkleLoader";
import { transcribeAudio } from "../stt/OpenAIWhisper";
import { synthesizeSpeech } from "../tts/ElevenLabsTTS";
import { getAssistantResponse } from "../utils/getAssistantResponse";
import axios from "axios";

interface SimliOpenAIPushToTalkProps {
  simli_faceid: string;
  openai_voice: "echo" | "alloy" | "shimmer";
  initialPrompt: string;
  onStart: () => void;
  onClose: () => void;
  showDottedFace: boolean;
}

const simliClient = new SimliClient();

const SimliOpenAIPushToTalk: React.FC<SimliOpenAIPushToTalkProps> = ({
  simli_faceid,
  openai_voice,
  initialPrompt,
  onStart,
  onClose,
  showDottedFace,
}) => {
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [isAvatarVisible, setIsAvatarVisible] = useState(false);
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [userMessage, setUserMessage] = useState("...");
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);

  // Refs for various components and states
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<MediaRecorder | null>(null);
  const isSecondRun = useRef(false);

  // New refs for managing audio chunk delay
  const audioChunkQueueRef = useRef<Int16Array[]>([]);
  const isProcessingChunkRef = useRef(false);

  // New ref to store recorded audio chunks
  const recordedChunksRef = useRef<Blob[]>([]);

  // Add mimeTypeRef at the top with other refs
  const mimeTypeRef = useRef<string>('');

  /**
   * Initializes the Simli client with the provided configuration.
   */
  const initializeSimliClient = useCallback(() => {
    if (videoRef.current && audioRef.current) {
      const SimliConfig = {
        apiKey: process.env.NEXT_PUBLIC_SIMLI_API_KEY,
        faceID: simli_faceid,
        handleSilence: true,
        maxSessionLength: 3600, // in seconds
        maxIdleTime: 600, // in seconds
        videoRef: videoRef,
        audioRef: audioRef,
      };

      simliClient.Initialize(SimliConfig as any);
      console.log("Simli Client initialized");
    }
  }, [simli_faceid]);

  /**
   * Starts audio recording from the user's microphone.
   */
  const startRecording = useCallback(async () => {
    try {
      console.log("Starting audio recording...");
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
        }
      });

      // Try different MIME types in order of preference
      const mimeTypes = [
        'audio/wav',
        'audio/mp3',
        'audio/webm',
        'audio/ogg'
      ];

      let selectedMimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error('No supported audio format found');
      }

      console.log(`Using MIME type: ${selectedMimeType}`);
      mimeTypeRef.current = selectedMimeType;

      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000
      });

      // Clear previous chunks
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      processorRef.current = mediaRecorder;
      setIsRecording(true);
      console.log("Audio recording started");
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Error accessing microphone. Please check your permissions.");
    }
  }, []);

  /**
   * Stops audio recording from the user's microphone
   */
  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.stop();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    console.log("Audio recording stopped");
  }, []);

  /**
   * Handles the start of the interaction, initializing clients and starting recording.
   */
  const handleStart = useCallback(async () => {
    setIsLoading(true);
    setError("");
    onStart();

    try {
      console.log("Starting...");
      initializeSimliClient();
      await simliClient?.start();
    } catch (error: any) {
      console.error("Error starting interaction:", error);
      setError(`Error starting interaction: ${error.message}`);
    } finally {
      setIsAvatarVisible(true);
      setIsLoading(false);
    }
  }, [initializeSimliClient, onStart]);

  /**
   * Handles stopping the interaction, cleaning up resources and resetting states.
   */
  const handleStop = useCallback(() => {
    console.log("Stopping interaction...");
    setIsLoading(false);
    setError("");
    setIsAvatarVisible(false);
    simliClient?.close();
    if (audioContextRef.current) {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }
    stopRecording();
    onClose();
    console.log("Interaction stopped");
  }, [stopRecording]);

  // Push-to-talk button handlers
  const handlePushToTalkStart = useCallback(() => {
    if (!isButtonDisabled) {
      setIsButtonDisabled(true);
      startRecording();

      // Clear Simli buffer
      simliClient?.ClearBuffer();
    }
  }, [startRecording, isButtonDisabled]);

  const handlePushToTalkEnd = useCallback(async () => {
    stopRecording();

    try {
      // Wait a bit for the last chunks to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      if (recordedChunksRef.current.length === 0) {
        console.error('No audio data recorded');
        return;
      }

      // Get the MIME type that was used for recording
      const mimeType = mimeTypeRef.current || 'audio/webm';
      console.log('Creating audio blob with type:', mimeType);

      // Create the blob from recorded chunks
      const audioBlob = new Blob(recordedChunksRef.current, {
        type: mimeType
      });

      // Convert to a format that OpenAI accepts (WAV)
      const audioFile = new File([audioBlob], 'audio.wav', {
        type: 'audio/wav'
      });

      console.log('Audio file created:', {
        name: audioFile.name,
        type: audioFile.type,
        size: audioFile.size
      });

      // Transcribe audio using OpenAI Whisper STT module
      const userTranscription = await transcribeAudio(audioFile);
      setUserMessage(userTranscription);

      // Get assistant response from OpenAI Chat API
      const assistantResponse = await getAssistantResponse(
        userTranscription,
        initialPrompt
      );

      const elevenlabsResponse = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=pcm_16000`,
        {
          text: assistantResponse,
          model_id: "eleven_multilingual_v2",
        },
        {
          headers: {
            "xi-api-key": `${process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY}`,
            "Content-Type": "application/json",
          },
          responseType: "arraybuffer",
        }
      );

      // Synthesize speech using Eleven Labs TTS module
      // const ttsAudioArrayBuffer = await synthesizeSpeech(assistantResponse);
      // 
      


      

      // Step 5: Convert audio to Uint8Array (Make sure its of type PCM16)
      const pcm16Data = new Uint8Array(elevenlabsResponse.data);
      console.log(pcm16Data);

      // Step 6: Send audio data to WebRTC as 6000 byte chunks
      const chunkSize = 6000;
      for (let i = 0; i < pcm16Data.length; i += chunkSize) {
        const chunk = pcm16Data.slice(i, i + chunkSize);
        simliClient.sendAudioData(chunk);}


      // // Convert ArrayBuffer to Uint8Array for Simli
      // const uint8Array = new Uint8Array(ttsAudioArrayBuffer);
      // simliClient?.sendAudioData(uint8Array);
    } catch (error: any) {
      console.error('Error during interaction:', error);
      setError(error.message || 'An error occurred');
    } finally {
      setIsButtonDisabled(false);
      // Clear recorded chunks
      recordedChunksRef.current = [];
    }
  }, [stopRecording, initialPrompt]);

  // Visualize mic audio
  const AudioVisualizer = () => {
    const [volume, setVolume] = useState(0);

    useEffect(() => {
      const interval = setInterval(() => {
        setVolume(Math.random() * 100);
      }, 100);

      return () => clearInterval(interval);
    }, []);

    return (
      <div className="flex items-end justify-center space-x-1 h-5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="w-2 bg-black transition-all duration-300 ease-in-out"
            style={{
              height: `${Math.min(100, volume + Math.random() * 20)}%`,
            }}
          />
        ))}
      </div>
    );
  };

  // Effect to initialize Simli client and clean up resources on unmount
  useEffect(() => {
    if (isSecondRun.current) {
      if (simliClient) {
        simliClient?.on("connected", () => {
          console.log("SimliClient connected");
          const audioData = new Uint8Array(6000).fill(0);
          simliClient?.sendAudioData(audioData);
          console.log("Sent initial audio data");
          initializeSimliClient();
        });

        simliClient?.on("disconnected", () => {
          console.log("SimliClient disconnected");
        });
      }

      return () => {
        try {
          simliClient?.close();
          if (audioContextRef.current) {
            audioContextRef.current?.close();
          }
        } catch {}
      };
    }
    isSecondRun.current = true;
  }, [initializeSimliClient]);

  return (
    <>
      <div
        className={`transition-all duration-300 ${
          showDottedFace ? "h-0 overflow-hidden" : "h-auto"
        }`}
      >
        <VideoBox video={videoRef} audio={audioRef} />
      </div>
      <div className="flex flex-col items-center">
        {!isAvatarVisible ? (
          <button
            onClick={handleStart}
            disabled={isLoading}
            className={cn(
              "w-full h-[52px] mt-4 disabled:bg-[#343434] disabled:text-white disabled:hover:rounded-[100px] bg-[#2f82fd] text-white py-3 px-6 rounded-[100px] transition-all duration-300 hover:text-black hover:bg-white hover:rounded-sm",
              "flex justify-center items-center"
            )}
          >
            {isLoading ? (
              <IconSparkleLoader className="h-[20px] animate-loader" />
            ) : (
              <span className="font-abc-repro-mono font-bold w-[164px]">
                Test Interaction
              </span>
            )}
          </button>
        ) : (
          <>
            <div className="flex items-center gap-4 w-full">
              <button
                onMouseDown={handlePushToTalkStart}
                onTouchStart={handlePushToTalkStart}
                onMouseUp={handlePushToTalkEnd}
                onTouchEnd={handlePushToTalkEnd}
                onMouseLeave={handlePushToTalkEnd}
                className={cn(
                  "mt-4 text-white flex-grow bg-[#2f82fd] hover:rounded-sm hover:bg-opacity-70 h-[52px] px-6 rounded-[100px] transition-all duration-300",
                  isRecording && "bg-[#1B1B1B] rounded-sm hover:bg-opacity-100"
                )}
              >
                <span className="font-abc-repro-mono font-bold w-[164px]">
                  {isRecording ? "Release to Stop" : "Push & hold to talk"}
                </span>
              </button>
              <button
                onClick={handleStop}
                className=" group w-[52px] h-[52px] flex items-center mt-4 bg-red text-white justify-center rounded-[100px] backdrop-blur transition-all duration-300 hover:bg-white hover:text-black hover:rounded-sm"
              >
                <IconExit className="group-hover:invert-0 group-hover:brightness-0 transition-all duration-300" />
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default SimliOpenAIPushToTalk;
