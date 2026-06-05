export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { situacion, nombre, genero } = req.body;
  if (!situacion) return res.status(400).json({ error: 'Falta describir la situación' });

  const nombreTexto = nombre ? `. El protagonista se llama ${nombre}` : '';

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Sos un especialista en terapia conductual para Trastorno del Espectro Autista (TEA).
Creás historias sociales según el método de Carol Gray para ayudar a niños con TEA a comprender y anticipar situaciones sociales.

Respondé ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "titulo": "Título corto y claro de la historia",
  "situacion": "nombre corto de la situación",
  "paneles": [
    {
      "numero": 1,
      "tipo": "descriptivo",
      "titulo": "título corto del panel (máx 5 palabras)",
      "texto": "oración simple, clara y positiva (máx 15 palabras)",
      "emoji": "emoji representativo"
    }
  ]
}

Tipos de paneles:
- "descriptivo": describe QUÉ pasa, dónde, cuándo, quiénes
- "perspectiva": describe cómo se sienten los demás o el protagonista
- "directivo": dice qué puede HACER el protagonista (usar "voy a intentar...")
- "afirmativo": expresa un valor positivo o palabras de aliento

Reglas:
- 5 a 7 paneles en total
- Mayoría descriptivos (3-4), 1 perspectiva, 1 directivo, 1 afirmativo al final
- Primera persona cuando corresponde ("Yo voy...", "Cuando llego...")
- Frases simples, concretas, predecibles
- Sin negaciones complejas (no usar "no debes", usar alternativas positivas)
- Lenguaje en español rioplatense
- El afirmativo siempre va al final y debe ser reconfortante`
          },
          {
            role: 'user',
            content: `Creá una historia social para esta situación: "${situacion}"${nombreTexto}`
          }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Error de API');

    const resultado = JSON.parse(data.choices[0].message.content);
    return res.status(200).json(resultado);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
