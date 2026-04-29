export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { imagen } = req.body;
  if (!imagen) return res.status(400).json({ error: 'Falta la imagen' });

  const CATEGORIAS = {
    higiene: { color: '#3B82F6', label: 'Higiene', keywords: ['baño', 'ducha', 'dientes', 'manos', 'jabón', 'cepillo', 'peine', 'toalla', 'inodoro', 'lavabo'] },
    comida: { color: '#10B981', label: 'Comida', keywords: ['comida', 'comer', 'bebida', 'tomar', 'desayuno', 'almuerzo', 'merienda', 'cena', 'vaso', 'plato', 'cubiertos', 'fruta', 'pan'] },
    escuela: { color: '#F59E0B', label: 'Escuela', keywords: ['jardín', 'escuela', 'mochila', 'libro', 'lápiz', 'cuaderno', 'clase', 'tarea', 'colegio'] },
    descanso: { color: '#EF4444', label: 'Descanso', keywords: ['dormir', 'cama', 'siesta', 'descanso', 'almohada', 'pijama', 'noche'] },
    juego: { color: '#8B5CF6', label: 'Juego', keywords: ['jugar', 'juguete', 'pelota', 'juego', 'dibujar', 'pintar', 'música', 'tiempo libre', 'parque'] },
    ropa: { color: '#F97316', label: 'Ropa', keywords: ['ropa', 'vestir', 'zapato', 'camisa', 'pantalón', 'medias', 'abrigo', 'remera'] }
  };

  try {
    // Paso 1: analizar la imagen con GPT-4o Vision
    const visionRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imagen, detail: 'low' } },
            { type: 'text', text: 'Describí brevemente qué objeto o acción se ve en esta imagen en español. Sé muy específico y concreto. Máximo 20 palabras. Solo la descripción, sin explicaciones.' }
          ]
        }]
      })
    });

    const visionData = await visionRes.json();
    if (!visionRes.ok) throw new Error(visionData?.error?.message || 'Error Vision API');
    const descripcion = visionData.choices[0].message.content.trim();

    // Paso 2: detectar categoría automáticamente
    const descLower = descripcion.toLowerCase();
    let categoria = 'juego'; // default
    let maxMatches = 0;
    for (const [key, val] of Object.entries(CATEGORIAS)) {
      const matches = val.keywords.filter(k => descLower.includes(k)).length;
      if (matches > maxMatches) { maxMatches = matches; categoria = key; }
    }
    const catInfo = CATEGORIAS[categoria];

    // Paso 3: generar nombre corto para el pictograma
    const nombreRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 20,
        messages: [{ role: 'user', content: `Dame un nombre muy corto (1-3 palabras máximo) en español para un pictograma que muestra: "${descripcion}". Solo el nombre, sin puntuación.` }]
      })
    });
    const nombreData = await nombreRes.json();
    const nombre = nombreData.choices[0].message.content.trim();

    // Paso 4: generar imagen con DALL-E 3
    const prompt = `A clean, realistic illustration for an autism communication pictogram showing: ${descripcion}. Simple composition, white background, bright and clear colors, child-friendly style, no text, no people faces, just the object or action clearly depicted. High contrast, flat illustration style.`;

    const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024', quality: 'standard', response_format: 'url' })
    });

    const dalleData = await dalleRes.json();
    if (!dalleRes.ok) throw new Error(dalleData?.error?.message || 'Error DALL-E');
    const imageUrl = dalleData.data[0].url;

    return res.status(200).json({ nombre, descripcion, categoria, color: catInfo.color, colorLabel: catInfo.label, imageUrl });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
