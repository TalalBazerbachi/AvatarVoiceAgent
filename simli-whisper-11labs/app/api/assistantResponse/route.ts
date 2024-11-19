import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY, // Ensure this environment variable is set
});

const systemInstructions = `you are a helpful assistant`;

export async function POST(request: NextRequest) {
  try {
    const { userInput } = await request.json();

    if (!userInput) {
      return NextResponse.json(
        { error: 'Missing userInput' },
        { status: 400 }
      );
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // You can choose the model you prefer
      messages: [
        { role: 'system', content: systemInstructions },
        { role: 'user', content: userInput },
      ],
      max_tokens: 150, // Adjust based on your needs
      temperature: 0.7, // Adjust based on your needs
    });

    const assistantMessage = response.choices[0].message?.content;

    return NextResponse.json({
      choices: [{ message: { content: assistantMessage } }],
    });
  } catch (error: any) {
    console.error('Error processing assistant response:', error);

    const errorMessage = error.response?.data?.error?.message || error.message;
    const statusCode = error.response?.status || 500;

    return NextResponse.json(
      { error: 'Assistant response failed', details: errorMessage },
      { status: statusCode }
    );
  }
}