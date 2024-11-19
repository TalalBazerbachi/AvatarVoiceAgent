import React, { useCallback, useEffect, useRef, useState } from "react";
import { RealtimeClient } from "@openai/realtime-api-beta";
import { SimliClient } from "simli-client";
import VideoBox from "./Components/VideoBox";
import cn from "./utils/TailwindMergeAndClsx";
import IconExit from "@/media/IconExit";
import IconSparkleLoader from "@/media/IconSparkleLoader";
import { on } from "events";
import { globalConversationHistory } from "./memory";
interface SimliOpenAIProps {
  simli_faceid: string;
  openai_voice: "echo" | "alloy" | "shimmer";
  initialPrompt: string;
  onStart: () => void;
  onClose: () => void;
  showDottedFace: boolean;
}

const simliClient = new SimliClient();

const SimliOpenAI: React.FC<SimliOpenAIProps> = ({
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

  // Refs for various components and states
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const openAIClientRef = useRef<RealtimeClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const isSecondRun = useRef(false);

  // New refs for managing audio chunk delay
  const audioChunkQueueRef = useRef<Int16Array[]>([]);
  const isProcessingChunkRef = useRef(false);

  /**
   * Initializes the Simli client with the provided configuration.
   */
  // const initializeSimliClient = useCallback(() => {
  //   if (videoRef.current && audioRef.current) {
  //     const SimliConfig = {
  //       apiKey: process.env.NEXT_PUBLIC_SIMLI_API_KEY,
  //       faceID: simli_faceid,
  //       handleSilence: true,
  //       maxSessionLength: 600, // in seconds
  //       maxIdleTime: 600, // in seconds
  //       videoRef: videoRef,
  //       audioRef: audioRef,
  //     };

  //     simliClient.Initialize(SimliConfig as any);
  //     console.log("Simli Client initialized");
  //   }
  // }, [simli_faceid]);
  const initializeSimliClient = useCallback(() => {
    if (videoRef.current && audioRef.current) {
      try {
        const SimliConfig = {
          apiKey: process.env.NEXT_PUBLIC_SIMLI_API_KEY,
          faceID: simli_faceid,
          handleSilence: true,
          maxSessionLength: 600,
          maxIdleTime: 600,
          videoRef: videoRef,
          audioRef: audioRef,
          webSocket: {
            reconnect: true,
            reconnectAttempts: 5,
            reconnectDelay: 3000,
            timeout: 10000
          }
        };
  
        console.log('Initializing Simli with config:', {
          ...SimliConfig,
          apiKey: '[REDACTED]'
        });
  
        simliClient.Initialize(SimliConfig as any);
        console.log("Simli Client initialized successfully");
      } catch (error) {
        console.error("Error initializing Simli client:", error);
        setError(`Failed to initialize Simli client: ${error}`);
      }
    } else {
      console.error("Video or audio ref not available");
    }
  }, [simli_faceid]);
  /**
   * Initializes the OpenAI client, sets up event listeners, and connects to the API.
   */
  const initializeOpenAIClient = useCallback(async () => {
    try {
      console.log("Initializing OpenAI client...");
      openAIClientRef.current = new RealtimeClient({
        apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        dangerouslyAllowAPIKeyInBrowser: true,
      });

      await openAIClientRef.current.updateSession({
        instructions: initialPrompt,
        voice: openai_voice,
        turn_detection: { type: "server_vad" },
        input_audio_transcription: { model: "whisper-1" },
      });

      // Set up event listeners
      openAIClientRef.current.on(
        "conversation.updated",
        handleConversationUpdate
      );

      openAIClientRef.current.on(
        "conversation.interrupted",
        interruptConversation
      );

      openAIClientRef.current.on(
        "input_audio_buffer.speech_stopped",
        handleSpeechStopped
      );
      // openAIClientRef.current.on('response.canceled', handleResponseCanceled);

      await openAIClientRef.current.connect().then(() => {
        console.log("OpenAI Client connected successfully");
        startRecording();
      });

      setIsAvatarVisible(true);
    } catch (error: any) {
      console.error("Error initializing OpenAI client:", error);
      setError(`Failed to initialize OpenAI client: ${error.message}`);
    }
  }, [initialPrompt]);

  const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

const connectWithRetry = async (retryCount = 0) => {
  try {
    await simliClient?.start();
    console.log("Successfully connected to Simli");
  } catch (error) {
    console.error(`Connection attempt ${retryCount + 1} failed:`, error);
    
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying in ${RETRY_DELAY/1000} seconds...`);
      setTimeout(() => {
        connectWithRetry(retryCount + 1);
      }, RETRY_DELAY);
    } else {
      console.error("Max retries reached. Connection failed.");
      setError("Failed to connect to Simli after multiple attempts");
    }
  }
};
  /**
   * Handles conversation updates, including user and assistant messages.
   */
  // const handleConversationUpdate = useCallback((event: any) => {
  //   console.log("Conversation updated:", event);
  //   const { item, delta } = event;

  //   if (item.type === "message" && item.role === "assistant") {
  //     console.log("Assistant message detected");
  //     if (delta && delta.audio) {
  //       const downsampledAudio = downsampleAudio(delta.audio, 24000, 16000);
  //       audioChunkQueueRef.current.push(downsampledAudio);
  //       if (!isProcessingChunkRef.current) {
  //         processNextAudioChunk();
  //       }
  //     }
  //   } else if (item.type === "message" && item.role === "user") {
  //     setUserMessage(item.content[0].transcript);
  //   }
  // }, []);

  const handleConversationUpdate = useCallback((event: any) => {
    console.log("Conversation updated:", event);
    const { item, delta } = event;

    if (item.type === "message") {
      if (item.role === "assistant") {
        // Handle assistant message
        if (delta?.content) {
          // For assistant messages, we need to check if there's existing content
          const lastMessage = globalConversationHistory[globalConversationHistory.length - 1];
          
          if (lastMessage?.role === "assistant") {
            // Append to existing assistant message
            lastMessage.content += delta.content;
          } else {
            // Create new assistant message
            globalConversationHistory.push({
              role: "assistant",
              content: delta.content
            });
          }
        }
        
        // Handle audio processing
        if (delta && delta.audio) {
          const downsampledAudio = downsampleAudio(delta.audio, 24000, 16000);
          audioChunkQueueRef.current.push(downsampledAudio);
          if (!isProcessingChunkRef.current) {
            processNextAudioChunk();
          }
        }
      } else if (item.role === "user") {
        // Filter out null messages
        const userText = item.content[0].transcript;
        if (userText) {  // Only add non-null messages
          setUserMessage(userText);
          globalConversationHistory.push({
            role: "user", 
            content: userText
          });
        }
      }
    }

    console.log('Conversation History:', globalConversationHistory)
}, []);

  /**
   * Handles interruptions in the conversation flow.
   */
  const interruptConversation = () => {
    console.warn("User interrupted the conversation");
    simliClient?.ClearBuffer();
    openAIClientRef.current?.cancelResponse("");
  };

  /**
   * Processes the next audio chunk in the queue.
   */
  const processNextAudioChunk = useCallback(() => {
    if (
      audioChunkQueueRef.current.length > 0 &&
      !isProcessingChunkRef.current
    ) {
      isProcessingChunkRef.current = true;
      const audioChunk = audioChunkQueueRef.current.shift();
      if (audioChunk) {
        const chunkDurationMs = (audioChunk.length / 16000) * 1000; // Calculate chunk duration in milliseconds

        // Send audio chunks to Simli immediately
        simliClient?.sendAudioData(audioChunk as any);
        console.log(
          "Sent audio chunk to Simli:",
          chunkDurationMs,
          "Duration:",
          chunkDurationMs.toFixed(2),
          "ms"
        );
        isProcessingChunkRef.current = false;
        processNextAudioChunk();
      }
    }
  }, []);

  /**
   * Handles the end of user speech.
   */
  const handleSpeechStopped = useCallback((event: any) => {
    console.log("Speech stopped event received", event);
  }, []);

  /**
   * Applies a simple low-pass filter to prevent aliasing of audio
   */
  const applyLowPassFilter = (
    data: Int16Array,
    cutoffFreq: number,
    sampleRate: number
  ): Int16Array => {
    // Simple FIR filter coefficients
    const numberOfTaps = 31; // Should be odd
    const coefficients = new Float32Array(numberOfTaps);
    const fc = cutoffFreq / sampleRate;
    const middle = (numberOfTaps - 1) / 2;

    // Generate windowed sinc filter
    for (let i = 0; i < numberOfTaps; i++) {
      if (i === middle) {
        coefficients[i] = 2 * Math.PI * fc;
      } else {
        const x = 2 * Math.PI * fc * (i - middle);
        coefficients[i] = Math.sin(x) / (i - middle);
      }
      // Apply Hamming window
      coefficients[i] *=
        0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (numberOfTaps - 1));
    }

    // Normalize coefficients
    const sum = coefficients.reduce((acc, val) => acc + val, 0);
    coefficients.forEach((_, i) => (coefficients[i] /= sum));

    // Apply filter
    const result = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < numberOfTaps; j++) {
        const idx = i - j + middle;
        if (idx >= 0 && idx < data.length) {
          sum += coefficients[j] * data[idx];
        }
      }
      result[i] = Math.round(sum);
    }

    return result;
  };

  /**
   * Downsamples audio data from one sample rate to another using linear interpolation
   * and anti-aliasing filter.
   *
   * @param audioData - Input audio data as Int16Array
   * @param inputSampleRate - Original sampling rate in Hz
   * @param outputSampleRate - Target sampling rate in Hz
   * @returns Downsampled audio data as Int16Array
   */
  const downsampleAudio = (
    audioData: Int16Array,
    inputSampleRate: number,
    outputSampleRate: number
  ): Int16Array => {
    if (inputSampleRate === outputSampleRate) {
      return audioData;
    }

    if (inputSampleRate < outputSampleRate) {
      throw new Error("Upsampling is not supported");
    }

    // Apply low-pass filter to prevent aliasing
    // Cut off at slightly less than the Nyquist frequency of the target sample rate
    const filteredData = applyLowPassFilter(
      audioData,
      outputSampleRate * 0.45, // Slight margin below Nyquist frequency
      inputSampleRate
    );

    const ratio = inputSampleRate / outputSampleRate;
    const newLength = Math.floor(audioData.length / ratio);
    const result = new Int16Array(newLength);

    // Linear interpolation
    for (let i = 0; i < newLength; i++) {
      const position = i * ratio;
      const index = Math.floor(position);
      const fraction = position - index;

      if (index + 1 < filteredData.length) {
        const a = filteredData[index];
        const b = filteredData[index + 1];
        result[i] = Math.round(a + fraction * (b - a));
      } else {
        result[i] = filteredData[index];
      }
    }

    return result;
  };

  /**
   * Starts audio recording from the user's microphone.
   */
  const startRecording = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }

    try {
      console.log("Starting audio recording...");
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const source = audioContextRef.current.createMediaStreamSource(
        streamRef.current
      );
      processorRef.current = audioContextRef.current.createScriptProcessor(
        2048,
        1,
        1
      );

      processorRef.current.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const audioData = new Int16Array(inputData.length);
        let sum = 0;

        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          audioData[i] = Math.floor(sample * 32767);
          sum += Math.abs(sample);
        }

        openAIClientRef.current?.appendInputAudio(audioData);
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
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
      processorRef.current.disconnect();
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
  // const handleStart = useCallback(async () => {
  //   setIsLoading(true);
  //   setError("");
  //   onStart();

  //   try {
  //     console.log("Starting...");
  //     initializeSimliClient();
  //     await simliClient?.start();
  //   } catch (error: any) {
  //     console.error("Error starting interaction:", error);
  //     setError(`Error starting interaction: ${error}`);
  //   } finally {
  //     setIsAvatarVisible(true);
  //     setIsLoading(false);
  //   }
  // }, [onStart]);
  const handleStart = useCallback(async () => {
    setIsLoading(true);
    setError("");
    onStart();
  
    try {
      console.log("Starting...");
      initializeSimliClient();
      await connectWithRetry();
    } catch (error: any) {
      console.error("Error starting interaction:", error);
      setError(`Error starting interaction: ${error.message}`);
    } finally {
      setIsAvatarVisible(true);
      setIsLoading(false);
    }
  }, [onStart]);
  /**
   * Handles stopping the interaction, cleaning up resources and resetting states.
   */
  const handleStop = useCallback(() => {
    console.log("Stopping interaction...");
    setIsLoading(false);
    setError("");
    stopRecording();
    setIsAvatarVisible(false);
    simliClient?.close();
    openAIClientRef.current?.disconnect();
    if (audioContextRef.current) {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }
    stopRecording();
    onClose();
    console.log("Interaction stopped");
  }, [stopRecording]);

  // Effect to initialize Simli client and clean up resources on unmount
  // useEffect(() => {
  //   if (isSecondRun.current) {
  //     if (simliClient) {
  //       simliClient?.on("connected", () => {
  //         console.log("SimliClient connected");
  //         const audioData = new Uint8Array(6000).fill(0);
  //         simliClient?.sendAudioData(audioData);
  //         console.log("Sent initial audio data");
  //         initializeOpenAIClient();
  //       });

  //       simliClient?.on("disconnected", () => {
  //         console.log("SimliClient disconnected");
  //         // Reinitialize and restart
    
          
  //         console.log("Successfully reconnected to SimliClient");
  //         // openAIClientRef.current?.disconnect();
  //         // if (audioContextRef.current) {
  //         //   audioContextRef.current?.close();
  //         // }
  //       });
  //     }

  //     return () => {
  //       try {
  //         simliClient?.close();
  //         openAIClientRef.current?.disconnect();
  //         if (audioContextRef.current) {
  //           audioContextRef.current?.close();
  //         }
  //       } catch {}
  //     };
  //   }
  //   isSecondRun.current = true;
  // }, [initializeSimliClient]);
  useEffect(() => {
    if (isSecondRun.current) {
      if (simliClient) {
        simliClient?.on("connected", () => {
          console.log("SimliClient connected successfully");
          try {
            const audioData = new Uint8Array(6000).fill(0);
            simliClient?.sendAudioData(audioData);
            console.log("Sent initial audio data successfully");
            initializeOpenAIClient();
          } catch (error) {
            console.error("Error during initial setup:", error);
            setError(`Connection error: ${error}`);
          }
        });
  
        simliClient?.on("error", (error: any) => {
          console.error("SimliClient error:", error);
          setError(`Simli error: ${error.message}`);
          
          // Attempt to reconnect on error
          setTimeout(() => {
            console.log("Attempting to reconnect...");
            initializeSimliClient();
          }, 3000);
        });
  
        simliClient?.on("disconnected", () => {
          console.log("SimliClient disconnected - attempting reconnection");
          // Implement reconnection logic
          setTimeout(() => {
            console.log("Attempting to reconnect after disconnect...");
            initializeSimliClient();
          }, 3000);
        });
      }
  
      return () => {
        try {
          simliClient?.close();
          openAIClientRef.current?.disconnect();
          if (audioContextRef.current) {
            audioContextRef.current?.close();
          }
        } catch (error) {
          console.error("Cleanup error:", error);
        }
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
                onClick={handleStop}
                className={cn(
                  "mt-4 group text-white flex-grow bg-red hover:rounded-sm hover:bg-white h-[52px] px-6 rounded-[100px] transition-all duration-300"
                )}
              >
                <span className="font-abc-repro-mono group-hover:text-black font-bold w-[164px] transition-all duration-300">
                  Stop Interaction
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default SimliOpenAI;