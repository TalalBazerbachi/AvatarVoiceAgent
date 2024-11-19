import React, { useCallback, useEffect, useRef, useState } from "react";
// import { useConversation } from "@11labs/react";
import { useConversation } from "./simli-elevenlabs/elevenlabs-react";
import { SimliClient } from "simli-client";
import VideoBox from "./Components/VideoBox";
import cn from "./utils/TailwindMergeAndClsx";
import IconSparkleLoader from "@/media/IconSparkleLoader";
import { send } from "process";
import { getElevenLabsSignedUrl } from "./actions/actions";

interface SimliElevenlabsProps {
  simli_faceid: string;
  agentId: string; // ElevenLabs agent ID
  onStart: () => void;
  onClose: () => void;
  showDottedFace: boolean;
}

const simliClient = new SimliClient();

const SimliElevenlabs: React.FC<SimliElevenlabsProps> = ({
  simli_faceid,
  agentId,
  onStart,
  onClose,
  showDottedFace,
}) => {
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [isAvatarVisible, setIsAvatarVisible] = useState(false);
  const [error, setError] = useState("");
  const [userMessage, setUserMessage] = useState("...");

  // Refs for media elements
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Initialize ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: () => {
      console.log("ElevenLabs conversation connected");
      setIsAvatarVisible(true);
      setIsLoading(false);
      // sendAudioDataToSimli();
    },

    onDisconnect: () => {
      console.log("ElevenLabs conversation disconnected");
      setIsAvatarVisible(false);
      simliClient?.ClearBuffer();
      simliClient?.close();
    },

    onMessage: (message) => {
      console.log("ElevenLabs conversation message:", message);
    },

    onModeChange(data) {
      console.log("ElevenLabs conversation mode change:", data);
      if (data.mode === "interrupted") {
        simliClient?.ClearBuffer();
      }
    },

    onError: (error) => {
      console.error("ElevenLabs conversation error:", error);
      setError(`Conversation error: ${error}`);
    },

    onAudioData: (audioData: Uint8Array) => {
      console.log("ElevenLabs conversation audio data:", audioData);
      simliClient.sendAudioData(audioData);
    },
  });

  /**
   * Initializes the Simli client with the provided configuration.
   */
  const initializeSimliClient = useCallback(() => {
    if (videoRef.current && audioRef.current) {
      try {
        const SimliConfig = {
          apiKey: process.env.NEXT_PUBLIC_SIMLI_API_KEY,
          faceID: simli_faceid,
          handleSilence: true,
          maxSessionLength: 3600,
          maxIdleTime: 3600,
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

  // Add retry mechanism
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

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

  const startElevenLabsConversation = async () => {
    // If agent is not publis then we must get signed URL from ElevenLabs
    await getElevenLabsSignedUrl(agentId).then(async (res) => {
      if ("error" in res) {
        console.error("Failed to get ElevenLabs URL:", res.error);
        return;
      }

      console.log("Got ElevenLabs signed URL:", res.signed_url);

      // Mute ElevenLabs internal audio to only hear it from Simli's side

      conversation.startSession({
        agentId: agentId,
        signedUrl: res.signed_url,
      });
    conversation.setVolume({ volume: 0.0 });

    });
  };

  /**
   * Handles the start of the interaction
   */
  const handleStart = useCallback(async () => {
    setIsLoading(true);
    setError("");
    onStart();

    try {
      // First check if permissions are already granted
      const permissions = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      
      if (permissions.state === 'denied') {
        throw new Error('Microphone permission has been denied. Please enable it in your browser settings.');
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false // explicitly set video to false since we don't need it here
      });

      // If we got the stream, clean it up (we'll get a new one when needed)
      stream.getTracks().forEach(track => track.stop());

      // Initialize Simli connection
      await connectWithRetry();
      
      // Start ElevenLabs conversation only after Simli is connected
      await startElevenLabsConversation();

    } catch (error: any) {
      console.error("Error starting interaction:", error);
      
      // More user-friendly error messages
      let errorMessage = 'Failed to start interaction. ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow microphone access in your browser settings.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No microphone found. Please connect a microphone and try again.';
      } else {
        errorMessage += error.message;
      }
      
      setError(errorMessage);
      setIsLoading(false);
      onClose(); // Clean up if we fail to start
    }
  }, [onStart, onClose]);

  /**
   * Handles stopping the interaction
   */
  const handleStop = useCallback(() => {
    console.log("Stopping interaction...");
    setIsLoading(false);
    setError("");
    setIsAvatarVisible(false);

    // Clean up ElevenLabs conversation
    conversation.endSession();

    // Clean up Simli client
    simliClient?.close();

    onClose();
    console.log("Interaction stopped");
  }, [conversation, onClose]);

  // Add a helper function to check browser compatibility
  const checkBrowserCompatibility = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Your browser does not support audio input. Please try a different browser.');
    }
  };

  // Update useEffect to include compatibility check
  useEffect(() => {
    try {
      checkBrowserCompatibility();
      initializeSimliClient();

      if (simliClient) {
        simliClient?.on("connected", () => {
          console.log("SimliClient connected");
          const audioData = new Uint8Array(6000).fill(0);
          simliClient?.sendAudioData(audioData);
          console.log("Sent initial audio data");
        });

        simliClient?.on("disconnected", () => {
          console.log("SimliClient disconnected");
          setError("Connection to Simli was lost. Please try again.");
          setIsAvatarVisible(false);
        });

        // simliClient?.on("error", (error: any) => {
        //   console.error("SimliClient error:", error);
        //   setError(`Simli error: ${error.message}`);
        // });
      }

      return () => {
        conversation.endSession();
        simliClient?.close();
      };
    } catch (error: any) {
      console.error("Setup error:", error);
      setError(error.message);
    }
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
        {error && (
          <div className="text-red-500 text-sm mb-2 text-center">
            {error}
          </div>
        )}
        {!isAvatarVisible ? (
          <button
            onClick={handleStart}
            disabled={isLoading}
            className={cn(
              "w-full h-[52px] mt-4 disabled:bg-[#343434] disabled:text-white disabled:hover:rounded-[100px] bg-simliblue text-white py-3 px-6 rounded-[100px] transition-all duration-300 hover:text-black hover:bg-white hover:rounded-sm",
              "flex justify-center items-center"
            )}
          >
            {isLoading ? (
              <IconSparkleLoader className="h-[20px] animate-loader" />
            ) : (
              <span className="font-abc-repro-mono font-bold w-[164px]">
                11labs Agent
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

export default SimliElevenlabs;
