import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not configured in environment variables');
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    );
  }

  const openai = new OpenAI({
    apiKey: apiKey,
    maxRetries: 3,
  });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    console.log('Received file:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Convert the File object to a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create a proper File object that OpenAI can process
    const properFile = new File([buffer], 'audio.wav', { 
      type: 'audio/wav'
    });

    console.log('Sending file for transcription:', {
      name: properFile.name,
      type: properFile.type,
      size: properFile.size
    });

    const transcription = await openai.audio.transcriptions.create({
      file: properFile,
      model: 'whisper-1',
      response_format: 'json'
    });

    return NextResponse.json({ transcription: transcription.text });
  } catch (error: any) {
    console.error('Error transcribing audio:', error);
    
    const errorMessage = error.response?.data?.error?.message || error.message;
    const statusCode = error.response?.status || 500;
    
    return NextResponse.json(
      { error: 'Transcription failed', details: errorMessage },
      { status: statusCode }
    );
  }
} 