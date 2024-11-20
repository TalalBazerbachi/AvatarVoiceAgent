// Type definitions for better type safety
interface ConversationHandlers {
    onConnect: (data: { conversationId: string }) => void;
    onDisconnect: () => void;
    onError: (message: string, details?: any) => void;
    onDebug: (data: any) => void;
    onMessage: (data: { source: string; message: string }) => void;
    onStatusChange: (data: { status: string }) => void;
    onModeChange: (data: { mode: string }) => void;
    onAudioData: (audioData: Uint8Array) => void; // Simplified to only handle output audio
}

interface ConversationConfig extends Partial<ConversationHandlers> {
    agentId?: string;
    signedUrl?: string;
}

// Updated mergeObjects implementation
function mergeObjects<T extends object>(...objects: Partial<T>[]): Partial<T> {
    return objects.reduce((result, current) => {
        return { ...result, ...current };
    }, {} as Partial<T>);
}

// Convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer: ArrayBuffer) {
    const uint8Array = new Uint8Array(buffer);
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
    }
    return window.btoa(binaryString);
}

// Convert Base64 string to ArrayBuffer
function base64ToArrayBuffer(base64String: string) {
    const binaryString = window.atob(base64String);
    const length = binaryString.length;
    const uint8Array = new Uint8Array(length);
    
    for (let i = 0; i < length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
    }
    
    return uint8Array.buffer;
}
// Audio processing worklet for raw audio handling
const RAW_AUDIO_PROCESSOR_BLOB = new Blob([`
    const TARGET_SAMPLE_RATE = 16000;
    
    class RawAudioProcessor extends AudioWorkletProcessor {
        constructor() {
            super();
            this.audioBuffer = []; // Buffer for audio samples
            this.bufferThreshold = TARGET_SAMPLE_RATE / 4; // ~0.25s of audio
            
            // Initialize resampler if needed
            if (globalThis.LibSampleRate && sampleRate !== TARGET_SAMPLE_RATE) {
                globalThis.LibSampleRate.create(1, sampleRate, TARGET_SAMPLE_RATE)
                    .then(resampler => {
                        this.resampler = resampler;
                    });
            }
        }
        
        process(inputs, outputs) {
            const primaryInput = inputs[0];
            if (primaryInput.length > 0) {
                let audioData = primaryInput[0];
                
                // Resample if necessary
                if (this.resampler) {
                    audioData = this.resampler.full(audioData);
                }
                
                // Add to buffer and calculate volume
                this.audioBuffer.push(...audioData);
                const maxVolume = this.calculateMaxVolume(audioData);
                
                // Process buffer when threshold is reached
                if (this.audioBuffer.length >= this.bufferThreshold) {
                    this.processAndSendBuffer(maxVolume);
                }
            }
            return true; // Keep processor alive
        }
        
        calculateMaxVolume(audioData) {
            let sumSquares = 0.0;
            for (let i = 0; i < audioData.length; i++) {
                sumSquares += audioData[i] * audioData[i];
            }
            return Math.sqrt(sumSquares / audioData.length);
        }
        
        processAndSendBuffer(maxVolume) {
            const float32Data = new Float32Array(this.audioBuffer);
            const pcm16Data = new Int16Array(float32Data.length);
            
            // Convert Float32 to PCM16
            for (let i = 0; i < float32Data.length; i++) {
                const sample = Math.max(-1, Math.min(1, float32Data[i]));
                pcm16Data[i] = sample < 0 ? sample * 32768 : sample * 32767;
            }
            
            // Send processed data
            this.port.postMessage([pcm16Data, maxVolume]);
            this.audioBuffer = []; // Clear buffer
        }
    }
    
    registerProcessor("raw-audio-processor", RawAudioProcessor);
`], { type: "application/javascript" });

const rawAudioProcessorUrl = URL.createObjectURL(RAW_AUDIO_PROCESSOR_BLOB);

// Audio Input Handler Class
class AudioInputHandler {
    audioContext: AudioContext;
    analyzerNode: AnalyserNode;
    processorNode: AudioWorkletNode;
    inputStream: MediaStream;
    static async create(targetSampleRate: number) {
        let audioContext = null;
        let audioStream = null;
        
        try {
            // Initialize audio context with desired sample rate if supported
            const supportsCustomSampleRate = navigator.mediaDevices
                .getSupportedConstraints().sampleRate;
                
            audioContext = new window.AudioContext(
                supportsCustomSampleRate ? { sampleRate: targetSampleRate } : {}
            );
            
            const analyzerNode = audioContext.createAnalyser();
            
            // Load necessary audio worklets
            if (!supportsCustomSampleRate) {
                await audioContext.audioWorklet.addModule(
                    "https://cdn.jsdelivr.net/npm/@alexanderolsen/libsamplerate-js@2.1.2/dist/libsamplerate.worklet.js"
                );
            }
            
            await audioContext.audioWorklet.addModule(rawAudioProcessorUrl);
            
            // Get microphone access
            audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: { ideal: targetSampleRate },
                    echoCancellation: { ideal: true }
                }
            });
            
            // Set up audio processing pipeline
            const sourceNode = audioContext.createMediaStreamSource(audioStream);
            const processorNode = new AudioWorkletNode(
                audioContext,
                "raw-audio-processor"
            );
            
            sourceNode.connect(analyzerNode);
            analyzerNode.connect(processorNode);
            
            return new AudioInputHandler(
                audioContext,
                analyzerNode,
                processorNode,
                audioStream
            );
            
        } catch (error) {
            // Clean up on error
            audioStream?.getTracks().forEach(track => track.stop());
            await audioContext?.close();
            throw error;
        }
    }
    
    constructor(audioContext: AudioContext, analyzerNode: AnalyserNode, processorNode: AudioWorkletNode, inputStream: MediaStream) {
        this.audioContext = audioContext;
        this.analyzerNode = analyzerNode;
        this.processorNode = processorNode;
        this.inputStream = inputStream;
    }
    
    async close() {
        this.inputStream.getTracks().forEach(track => track.stop());
        await this.audioContext.close();
    }
}

// Audio concatenation processor for handling output audio
const AUDIO_CONCAT_PROCESSOR_BLOB = new Blob([`
    class AudioConcatProcessor extends AudioWorkletProcessor {
        constructor() {
            super();
            this.audioBuffers = [];     // Queue of audio buffers to process
            this.currentPosition = 0;    // Current position in current buffer
            this.currentAudioBuffer = null;
            this.isInterrupted = false;
            this.isFinished = false;

            // Handle messages from main thread
            this.port.onmessage = ({ data }) => {
                switch (data.type) {
                    case "buffer":
                        this.handleNewBuffer(data.buffer);
                        break;
                    case "interrupt":
                        this.handleInterruption();
                        break;
                    case "clearInterrupted":
                        this.handleClearInterruption();
                        break;
                }
            };
        }

        handleNewBuffer(buffer) {
            this.isInterrupted = false;
            this.audioBuffers.push(new Int16Array(buffer));
        }

        handleInterruption() {
            this.isInterrupted = true;
        }

        handleClearInterruption() {
            if (this.isInterrupted) {
                this.isInterrupted = false;
                this.audioBuffers = [];
                this.currentAudioBuffer = null;
            }
        }

        process(_, outputs) {
            const isFinished = this.processAudioOutput(outputs[0][0]);
            
            // Notify state changes
            if (this.isFinished !== isFinished) {
                this.isFinished = isFinished;
                this.port.postMessage({ type: "process", finished: isFinished });
            }

            return true; // Keep processor active
        }

        processAudioOutput(output) {
            let isFinished = false;

            for (let i = 0; i < output.length; i++) {
                if (!this.currentAudioBuffer) {
                    if (this.audioBuffers.length === 0) {
                        isFinished = true;
                        break;
                    }
                    this.currentAudioBuffer = this.audioBuffers.shift();
                    this.currentPosition = 0;
                }

                // Convert from Int16 to Float32 range (-1 to 1)
                output[i] = this.currentAudioBuffer[this.currentPosition] / 32768;
                this.currentPosition++;

                if (this.currentPosition >= this.currentAudioBuffer.length) {
                    this.currentAudioBuffer = null;
                }
            }

            return isFinished;
        }
    }

    registerProcessor("audio-concat-processor", AudioConcatProcessor);
`], { type: "application/javascript" });

const audioConcatProcessorUrl = URL.createObjectURL(AUDIO_CONCAT_PROCESSOR_BLOB);

// Audio Output Handler Class
class AudioOutputHandler {
    audioContext: any;
    analyzerNode: any;
    gainNode: any;
    processorNode: any;
    static async create(targetSampleRate: number) {
        let audioContext = null;
        
        try {
            audioContext = new AudioContext({ sampleRate: targetSampleRate });
            
            // Create audio processing nodes
            const analyzerNode = audioContext.createAnalyser();
            const gainNode = audioContext.createGain();
            
            // Set up audio pipeline
            gainNode.connect(analyzerNode);
            analyzerNode.connect(audioContext.destination);
            
            // Initialize audio worklet
            await audioContext.audioWorklet.addModule(audioConcatProcessorUrl);
            const processorNode = new AudioWorkletNode(
                audioContext,
                "audio-concat-processor"
            );
            processorNode.connect(gainNode);
            
            return new AudioOutputHandler(
                audioContext,
                analyzerNode,
                gainNode,
                processorNode
            );
            
        } catch (error) {
            await audioContext?.close();
            throw error;
        }
    }

    constructor(audioContext: AudioContext, analyzerNode: AnalyserNode, gainNode: GainNode, processorNode: AudioWorkletNode) {
        this.audioContext = audioContext;
        this.analyzerNode = analyzerNode;
        this.gainNode = gainNode;
        this.processorNode = processorNode;
    }

    async close() {
        await this.audioContext.close();
    }
}

// Helper function to check if an object is an event type
function isEventType(obj: any) {
    return !!obj.type;
}

// WebSocket Connection Handler Class
class WebSocketHandler {
    socket: any;
    conversationId: any;
    sampleRate: any;
    static async create(config: ConversationConfig) {
        let webSocket = null;
        
        try {
            // Configure WebSocket connection
            const serverOrigin = process?.env?.ELEVENLABS_CONVAI_SERVER_ORIGIN || "wss://api.elevenlabs.io";
            const serverPath = process?.env?.ELEVENLABS_CONVAI_SERVER_PATHNAME || "/v1/convai/conversation?agent_id=";
            
            const wsUrl = config.signedUrl || `${serverOrigin}${serverPath}${config.agentId}`;
            webSocket = new WebSocket(wsUrl);

            // Wait for connection and initial metadata
            const metadata = await this.waitForMetadata(webSocket) as {
                conversation_id: string;
                agent_output_audio_format: string;
            };
            const conversationId = metadata.conversation_id;
            const sampleRate = parseInt(metadata.agent_output_audio_format.replace("pcm_", ""));

            return new WebSocketHandler(webSocket, conversationId, sampleRate);
        } catch (error) {
            webSocket?.close();
            throw error;
        }
    }

    static async waitForMetadata(webSocket: WebSocket) {
        return new Promise((resolve, reject) => {
            webSocket.addEventListener("error", reject);
            webSocket.addEventListener("close", reject);
            webSocket.addEventListener("message", (event: MessageEvent) => {
                const data = JSON.parse(event.data);
                if (isEventType(data)) {
                    if (data.type === "conversation_initiation_metadata") {
                        resolve(data.conversation_initiation_metadata_event);
                    } else {
                        console.warn("Unexpected first message type:", data.type);
                    }
                }
            }, { once: true });
        });
    }

    constructor(webSocket: WebSocket, conversationId: string, sampleRate: number) {
        this.socket = webSocket;
        this.conversationId = conversationId;
        this.sampleRate = sampleRate;
    }

    close() {
        this.socket.close();
    }
}

// Default event handlers
const DEFAULT_HANDLERS = {
    onConnect: () => {},
    onDisconnect: () => {},
    onError: () => {},
    onDebug: () => {},
    onMessage: () => {},
    onStatusChange: () => {},
    onModeChange: () => {}
};

/**
 * Main conversation manager class that handles audio I/O and WebSocket communication
 */
class ConversationManager {
    settings: any;
    connection: any;
    audioInput: any;
    audioOutput: any;
    lastInterruptTime: number;
    conversationMode: string;
    connectionStatus: string;
    audioVolume: number;
    inputFrequencyData: Uint8Array | null;
    outputFrequencyData: Uint8Array | null;
    static async startSession(config: ConversationConfig) {
        // Ensure we have all handlers by merging with defaults first
        const settings = mergeObjects<ConversationHandlers & ConversationConfig>(
            DEFAULT_HANDLERS,
            config || {}
        );
        // Now we can safely call handlers
        settings.onStatusChange?.({ status: "connecting" });

        let audioInput = null;
        let wsConnection = null;
        let audioOutput = null;

        try {
            audioInput = await AudioInputHandler.create(16000);
            wsConnection = await WebSocketHandler.create(config);
            audioOutput = await AudioOutputHandler.create(wsConnection.sampleRate);

            return new ConversationManager(settings as ConversationHandlers, wsConnection, audioInput, audioOutput);
        } catch (error) {
            settings.onStatusChange?.({ status: "disconnected" });
            wsConnection?.close();
            await audioInput?.close();
            await audioOutput?.close();
            throw error;
        }
    }

    constructor(settings: ConversationHandlers, wsConnection: WebSocketHandler, audioInput: AudioInputHandler, audioOutput: AudioOutputHandler) {
        this.settings = settings;
        this.connection = wsConnection;
        this.audioInput = audioInput;
        this.audioOutput = audioOutput;

        // State management
        this.lastInterruptTime = 0;
        this.conversationMode = "listening";  // "listening" or "speaking" or "interrupted"
        this.connectionStatus = "connecting"; // "connecting", "connected", "disconnecting", "disconnected"
        this.audioVolume = 1;

        // Frequency data buffers for visualizations
        this.inputFrequencyData = null;
        this.outputFrequencyData = null;

        // Initialize event listeners
        this.initializeEventListeners();
        this.updateConnectionStatus("connected");
    }

    /**
     * Set up all event listeners for WebSocket and audio processors
     */
    initializeEventListeners() {
        // WebSocket event handlers
        this.connection.socket.addEventListener("message", this.handleWebSocketMessage);
        this.connection.socket.addEventListener("error", this.handleWebSocketError);
        this.connection.socket.addEventListener("close", this.handleWebSocketClose);

        // Audio processor event handlers
        this.audioInput.processorNode.port.onmessage = this.handleInputAudioMessage;
        this.audioOutput.processorNode.port.onmessage = this.handleOutputAudioMessage;

        // Notify successful connection
        this.settings.onConnect({
            conversationId: this.connection.conversationId
        });
    }

    /**
     * Handles incoming WebSocket messages
     */
    handleWebSocketMessage = (event: MessageEvent) => {
        try {
            const data = JSON.parse(event.data);
            if (!isEventType(data)) return;

            switch (data.type) {
                case "interruption":
                    this.updateConversationMode("interrupted");
                    this.handleInterruption(data);
                    break;
                case "agent_response":
                    this.handleAgentResponse(data);
                    break;
                case "user_transcript":
                    this.handleUserTranscript(data);
                    break;
                case "internal_tentative_agent_response":
                    this.handleTentativeResponse(data);
                    break;
                case "audio":
                    this.handleIncomingAudio(data);
                    break;
                case "ping":
                    this.handlePing(data);
                    break;
                default:
                    this.settings.onDebug(data);
            }
        } catch (error) {
            this.handleError("Failed to parse WebSocket message", { event });
        }
    };

    /**
     * Handles different types of incoming messages
     */
    handleInterruption(data: any) {
        if (data.interruption_event) {
            this.lastInterruptTime = data.interruption_event.event_id;
        }
        this.fadeOutAudio();
    }

    handleAgentResponse(data: any) {
        this.settings.onMessage({
            source: "ai",
            message: data.agent_response_event.agent_response
        });
    }

    handleUserTranscript(data: any) {
        this.settings.onMessage({
            source: "user",
            message: data.user_transcription_event.user_transcript
        });
    }

    handleTentativeResponse(data: any) {
        this.settings.onDebug({
            type: "tentative_agent_response",
            response: data.tentative_agent_response_internal_event.tentative_agent_response
        });
    }

    handleIncomingAudio(data: any) {
        if (this.lastInterruptTime <= data.audio_event.event_id) {
            this.processIncomingAudio(data.audio_event.audio_base_64);
            this.updateConversationMode("speaking");
        }
    }

    handlePing(data: any) {
        this.connection.socket.send(JSON.stringify({
            type: "pong",
            event_id: data.ping_event.event_id
        }));
    }

    /**
     * Handles audio processing from input/output nodes
     */
    handleInputAudioMessage = (event: any) => {
        if (this.connectionStatus === "connected") {
            // Convert Int16Array to Uint8Array before sending
            const int16Data = event.data[0];
            const uint8Data = new Uint8Array(int16Data.buffer);
            
            const audioData = JSON.stringify({
                user_audio_chunk: arrayBufferToBase64(uint8Data.buffer)
            });
            this.connection.socket.send(audioData);
        }
    };

    handleOutputAudioMessage = ({ data }: { data: any }) => {
        if (data.type === "process") {
            this.updateConversationMode(data.finished ? "listening" : "speaking");
        }
    };

    /**
     * Audio processing methods
     */
    async processIncomingAudio(base64Audio: string) {
        const audioBuffer = base64ToArrayBuffer(base64Audio);
        
        // Call the new onAudioData handler with output audio only
        this.settings.onAudioData(new Uint8Array(audioBuffer));
        
        this.audioOutput.gainNode.gain.value = this.audioVolume;
        this.audioOutput.processorNode.port.postMessage({ type: "clearInterrupted" });
        this.audioOutput.processorNode.port.postMessage({
            type: "buffer",
            buffer: audioBuffer
        });
    }

    async fadeOutAudio() {
        this.updateConversationMode("listening");
        this.audioOutput.processorNode.port.postMessage({ type: "interrupt" });
        
        // Gradually fade out audio
        this.audioOutput.gainNode.gain.exponentialRampToValueAtTime(
            0.0001,
            this.audioOutput.audioContext.currentTime + 2
        );

        // Reset after fade
        setTimeout(() => {
            this.audioOutput.gainNode.gain.value = this.audioVolume;
            this.audioOutput.processorNode.port.postMessage({ type: "clearInterrupted" });
        }, 2000);
    }

    /**
     * State management methods
     */
    updateConversationMode(newMode: string) {
        if (newMode !== this.conversationMode) {
            this.conversationMode = newMode;
            this.settings.onModeChange({ mode: newMode });
        }
    }

    updateConnectionStatus(newStatus: string) {
        if (newStatus !== this.connectionStatus) {
            this.connectionStatus = newStatus;
            this.settings.onStatusChange({ status: newStatus });
        }
    }

    /**
     * Error handling
     */
    handleError(message: string, details: any) {
        console.error(message, details);
        this.settings.onError(message, details);
    }

    handleWebSocketError = (error: any) => {
        this.updateConnectionStatus("disconnected");
        this.handleError("WebSocket error", error);
    };

    handleWebSocketClose = () => {
        this.updateConnectionStatus("disconnected");
        this.settings.onDisconnect();
    };

    /**
     * Public API methods
     */
    async endSession() {
        if (this.connectionStatus === "connected") {
            this.updateConnectionStatus("disconnecting");
            this.connection.close();
            await this.audioInput.close();
            await this.audioOutput.close();
            this.updateConnectionStatus("disconnected");
        }
    }

    getConversationId() {
        return this.connection.conversationId;
    }

    setVolume(config: { volume: number }) {
        this.audioVolume = config.volume;
    }

        /**
     * Audio analysis methods for visualizations
     */
        getInputFrequencyData(): Uint8Array | null {
            if (!this.audioInput?.analyzerNode) {
                return null;
            }
            const frequencyData = new Uint8Array(this.audioInput.analyzerNode.frequencyBinCount);
            this.audioInput.analyzerNode.getByteFrequencyData(frequencyData);
            this.inputFrequencyData = frequencyData;
            return frequencyData;
        }
    
        getOutputFrequencyData(): Uint8Array | null {
            if (!this.audioOutput?.analyzerNode) {
                return null;
            }
            const frequencyData = new Uint8Array(this.audioOutput.analyzerNode.frequencyBinCount);
            this.audioOutput.analyzerNode.getByteFrequencyData(frequencyData);
            this.outputFrequencyData = frequencyData;
            return frequencyData;
        }

    calculateVolumeLevel(frequencyData: Uint8Array) {
        if (frequencyData.length === 0) return 0;
        
        const sum = frequencyData.reduce((acc, val) => acc + (val / 255), 0);
        const average = sum / frequencyData.length;
        
        return Math.max(0, Math.min(1, average));
    }
    getInputVolume() {
        const inputFrequencyData = this.getInputFrequencyData();
        if (inputFrequencyData === null) {
            return 0;
        }
        return this.calculateVolumeLevel(inputFrequencyData);
    }

    getOutputVolume() {
        const outputFrequencyData = this.getOutputFrequencyData();
        if (outputFrequencyData === null) {
            return 0;
        }
        return this.calculateVolumeLevel(outputFrequencyData);
    }
}

// Export the main conversation manager
export { ConversationManager as Conversation };
