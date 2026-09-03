import type { GeminiResponse } from './types'

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-chat`

const headers = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
}

export async function sendChatMessage(
  prompt: string,
  history: Array<{ role: string; content: string }>,
  options: { useSearch: boolean; thinkingLevel: 'low' | 'medium' | 'high' },
): Promise<GeminiResponse> {
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt,
      history,
      useSearch: options.useSearch,
      thinkingLevel: options.thinkingLevel,
    }),
  })

  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`
    try {
      const errorData = await response.json()
      if (errorData.error) {
        errorMessage = errorData.error
      }
    } catch {
      // keep default
    }
    throw new Error(errorMessage)
  }

  const data: GeminiResponse = await response.json()

  if (!data.text && !data.thoughts) {
    throw new Error('Received an empty response from the model. Try rephrasing your prompt.')
  }

  return data
}
