export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thoughts?: string
  grounding?: GroundingMetadata | null
  usage?: UsageMetadata | null
  model?: string
  timestamp: number
}

export interface GroundingMetadata {
  searchEntryPoint: string | null
  webSearchQueries: string[]
  groundingChunks: Array<{ uri: string | null; title: string | null }>
  groundingSupports: Array<{ indices: number[]; text: string }>
}

export interface UsageMetadata {
  promptTokenCount?: number
  candidatesTokenCount?: number
  totalTokenCount?: number
  thoughtsTokenCount?: number
}

export interface GeminiResponse {
  text: string
  thoughts: string
  groundingMetadata: GroundingMetadata | null
  usageMetadata: UsageMetadata | null
  model: string
}
