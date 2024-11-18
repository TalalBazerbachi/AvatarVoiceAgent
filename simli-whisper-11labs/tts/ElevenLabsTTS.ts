export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  const response = await fetch('/api/synthesizeSpeech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (response.ok) {
    return await response.arrayBuffer();
  } else {
    const errorText = await response.text();
    console.error('Error synthesizing speech:', errorText);
    throw new Error(`Speech synthesis failed: ${errorText}`);
  }
} 