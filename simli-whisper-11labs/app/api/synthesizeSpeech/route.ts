import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    // Ensure you have set your ElevenLabs API key in the environment variables
    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey || !voiceId) {
      return NextResponse.json(
        { error: 'ElevenLabs API key or Voice ID not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75,
        },
        output_format: "pcm_16000"
      }),
    });

    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      return new Response(arrayBuffer, {
        headers: {
          'Content-Type': 'audio/L16; rate=16000; channels=1',
        },
      });
    } else {
      const errorText = await response.text();
      console.error('Error from ElevenLabs API:', errorText);
      return NextResponse.json(
        { error: 'Speech synthesis failed', details: errorText },
        { status: response.status }
      );
    }
  } catch (error: any) {
    console.error('Error in synthesizeSpeech handler:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}