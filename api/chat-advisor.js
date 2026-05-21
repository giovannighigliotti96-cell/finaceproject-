export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY non configurata nelle Environment Variables di Vercel.' });
  }

  try {
    const { systemInstruction, contents } = req.body;

    if (!systemInstruction || !contents) {
      return res.status(400).json({ error: 'Missing systemInstruction or contents array' });
    }

    // Chiamata REST diretta all'API di Gemini usando il proxy sicuro
    // Utilizziamo gemini-2.5-flash
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    const geminiResponse = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: contents,
        generationConfig: {
          temperature: 0.2,
        }
      })
    });

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error('Gemini API error:', JSON.stringify(data));
      return res.status(500).json({ error: data?.error?.message || 'Gemini API Error' });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Nessuna risposta generata.';
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
