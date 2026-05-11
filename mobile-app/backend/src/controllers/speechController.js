const fs = require('fs');
const path = require('path');

async function transcribeWithOpenAI(filePath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('model', 'whisper-1');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => null);
    throw new Error(`OpenAI transcription failed: ${res.status} ${txt || ''}`);
  }

  const data = await res.json();
  return data;
}

exports.transcribe = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

    const filePath = req.file.path;

    try {
      const result = await transcribeWithOpenAI(filePath);
      // cleanup
      try { fs.unlinkSync(filePath); } catch (_e) {}
      return res.json({ ok: true, transcription: result.text, raw: result });
    } catch (err) {
      try { fs.unlinkSync(filePath); } catch (_e) {}
      return res.status(500).json({ error: err.message || 'Transcription failed' });
    }
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Server error' });
  }
};
