const asyncHandler = require('../middleware/asyncHandler');

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_CANDIDATES = [
  'openrouter/auto',
  'meta-llama/llama-3.3-70b-instruct:free',
];

exports.queryAgent = asyncHandler(async (req, res) => {
  try {
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY is not configured' });
    }

    const { messages, tools = [] } = req.body || {};

    if (!Array.isArray(messages)) {
      return res.status(500).json({ error: 'messages array is required' });
    }

    let lastErrorMessage = 'OpenRouter request failed';

    for (const model of MODEL_CANDIDATES) {
      const response = await fetch(OPENROUTER_BASE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          'HTTP-Referer': 'Lesio Patient App',
          'X-Title': 'DermApp Patient Agent',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          tools,
          max_tokens: 1024,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }

      try {
        const errorData = await response.json();
        lastErrorMessage = errorData?.error?.message || errorData?.message || lastErrorMessage;
      } catch (_error) {
        // Non-JSON upstream error bodies are ignored.
      }

      // Try the next model candidate before failing the request.
    }

    return res.status(500).json({ error: lastErrorMessage });
  } catch (error) {
    console.error('Agent request error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to process agent request' });
  }
});
