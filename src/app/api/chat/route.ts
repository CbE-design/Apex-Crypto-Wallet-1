// Tells Next.js to completely skip static pre-rendering for this API route
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { chatFlow } from '@/ai/flows/chat-flow';

export async function POST(req: Request) {
  try {
    // 1. Extract the message history and mode from the request body
    const { messages, mode } = await req.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Messages are required." }, { status: 400 });
    }

    // 2. Separate the user's latest message from the chat history
    const lastMessage = messages[messages.length - 1];
    const history = messages.slice(0, -1);

    // 3. Call the unified chat flow with the correct inputs
    const aiResponse = await chatFlow({
      message: lastMessage.content,
      history: history,
      mode: mode || 'support', // Default to support mode if not specified
    });

    // 4. Return the AI's response as a JSON object
    return NextResponse.json({ text: aiResponse });

  } catch (error) {
    console.error("AI Assistant Route Error:", error);
    return NextResponse.json({ error: "Failed to process chat action." }, { status: 500 });
  }
}
