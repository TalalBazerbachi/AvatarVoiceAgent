export async function getAssistantResponse(
  userInput: string,
  initialPrompt: string
): Promise<string> {
  const response = await fetch('/api/assistantResponse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userInput,
      initialPrompt,
    }),
  });

  if (response.ok) {
    const data = await response.json();
    console.log('Assistant response:', data);
    return data.choices[0].message.content;
  } else {
    const errorText = await response.text();
    console.error('Error getting assistant response:', errorText);
    throw new Error(`Assistant response failed: ${errorText}`);
  }
} 