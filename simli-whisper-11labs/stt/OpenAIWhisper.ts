export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  try {
    const formData = new FormData();
    
    // Add the file with explicit MIME type
    formData.append('file', audioBlob, 'audio.webm');

    // Log the form data for debugging
    console.log('Sending file:', audioBlob.type, audioBlob.size);

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Transcription response:', data.transcription);
      return data.transcription;
    } else {
      const errorText = await response.text();
      console.error('Error transcribing audio:', errorText);
      throw new Error(`Transcription failed: ${errorText}`);
    }
  } catch (error) {
    console.error('Network error during transcription:', error);
    throw error;
  }
} 