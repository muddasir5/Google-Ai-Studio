import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatRequest {
  prompt: string;
  history?: { role: string; content: string }[];
  useSearch?: boolean;
  thinkingLevel?: "low" | "medium" | "high";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { prompt, history = [], useSearch = true, thinkingLevel = "medium" } = await req.json() as ChatRequest;

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured. Add GEMINI_API_KEY as an edge function secret." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build contents array from history + current prompt
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const msg of history) {
      if (msg.role === "user" || msg.role === "model") {
        contents.push({
          role: msg.role,
          parts: [{ text: msg.content }],
        });
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: prompt }],
    });

    // Build generation config
    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: 65536,
      topP: 0.95,
      thinkingConfig: { thinkingBudget: thinkingLevel === "low" ? 0 : thinkingLevel === "high" ? 24 : 12 },
    };

    // Build tools
    const tools: Array<Record<string, unknown>> = [];
    if (useSearch) {
      tools.push({ google_search: {} });
    }

    const body: Record<string, unknown> = {
      contents,
      generationConfig,
    };
    if (tools.length > 0) {
      body.tools = tools;
    }

    const modelName = "gemini-2.5-flash";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const apiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      let errorMessage = `Gemini API error (${apiResponse.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // keep default
      }
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: apiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await apiResponse.json();

    // Extract text response
    let text = "";
    let thoughts = "";
    const candidates = data.candidates || [];
    if (candidates.length > 0) {
      const candidate = candidates[0];
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.text) {
          text += part.text;
        }
        if (part.thought === true && part.text) {
          thoughts += part.text;
        }
      }
    }

    // Extract search grounding metadata
    let groundingMetadata = null;
    if (candidates.length > 0 && candidates[0].groundingMetadata) {
      const gm = candidates[0].groundingMetadata;
      groundingMetadata = {
        searchEntryPoint: gm.searchEntryPoint || null,
        webSearchQueries: gm.webSearchQueries || [],
        groundingChunks: (gm.groundingChunks || []).map((chunk: { web?: { uri?: string; title?: string } }) => ({
          uri: chunk.web?.uri || null,
          title: chunk.web?.title || null,
        })),
        groundingSupports: (gm.groundingSupports || []).map((support: { groundingChunkIndices?: number[]; segment?: { text?: string } }) => ({
          indices: support.groundingChunkIndices || [],
          text: support.segment?.text || "",
        })),
      };
    }

    // Extract usage metadata
    const usageMetadata = data.usageMetadata || null;

    return new Response(
      JSON.stringify({
        text,
        thoughts,
        groundingMetadata,
        usageMetadata,
        model: modelName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
