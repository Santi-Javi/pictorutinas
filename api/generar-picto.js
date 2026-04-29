export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { imagen } = req.body;
  if (!imagen) return res.status(400).json({ error: 'Falta la imagen' });

  const CATEGORIAS = {
    higiene: { color: '#3B82F6', label: 'Higiene', keywords: ['baño', 'ducha', 'dientes', 'manos', 'jabón', 'cepillo', 'peine', 'toalla', 'inodoro', 'lavabo', 'pasta', 'dental', 'shampoo', 'champú'] },
    comida: { color: '#10B981', label: 'Comida', keywords: ['comida', 'comer', 'bebida', 'tomar', 'desayuno', 'almuerzo', 'merienda', 'cena', 'vaso', 'taza', 'plato', 'cubiertos', 'fruta', 'pan', 'mate', 'leche', 'jugo'] },
    escuela: { color: '#F59E0B', label: 'Escuela', keywords: ['jardín', 'escuela', 'mochila', 'libro', 'lápiz', 'cuaderno', 'clase', 'tarea', 'colegio', 'cartuchera', 'tijera', 'regla'] },
    descanso: { color: '#EF4444', label: 'Descanso', keywords: ['dormir', 'cama', 'siesta', 'descanso', 'almohada', 'pijama', 'noche', 'sábana', 'colchón'] },
    juego: { color: '#8B5CF6', label: 'Juego', keywords: ['jugar', 'juguete', 'pelota', 'juego', 'dibujar', 'pintar', 'música', 'tiempo libre', 'parque', 'auto', 'muñeca', 'lego', 'tablet', 'spiderman', 'superhéroe'] },
    ropa: { color: '#F97316', label: 'Ropa', keywords: ['ropa', 'vestir', 'zapato', 'camisa', 'pantalón', 'medias', 'abrigo', 'remera', 'zapatilla', 'buzo', 'campera'] }
  };

  try {
    // Paso 1: análisis visual MUY detallado con GPT-4o
    const visionRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imagen, detail: 'high' } },
            { type: 'text', text: `Analizá esta imagen con el máximo detalle visual posible. Describí:
1. QUÉ objeto o cosa es exactamente
2. COLORES exactos que tiene (primario, secundario, detalles)
3. FORMA y características visuales distintivas
4. MATERIALES o texturas visibles
5. Cualquier texto, marca, dibujo o decoración visible en el objeto

Respondé en español, en formato de lista. Sé muy específico con los colores y detalles. Esta descripción se usará para recrear el objeto como ilustración.` }
          ]
        }]
      })
    });

    const visionData = await visionRes.json();
    if (!visionRes.ok) throw new Error(visionData?.error?.message || 'Error Vision API');
    const descripcionDetallada = visionData.choices[0].message.content.trim();

    // Paso 2: nombre corto para el pictograma
    const nombreRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 20,
        messages: [{ role: 'user', content: `Basándote en esta descripción, dame un nombre muy corto (1-3 palabras máximo) en español para identificar este objeto como pictograma. Solo el nombre, sin puntuación ni explicaciones:\n\n${descripcionDetallada}` }]
      })
    });
    const nombreData = await nombreRes.json();
    const nombre = nombreData.choices[0].message.content.trim();

    // Paso 3: detectar categoría
    const descLower = descripcionDetallada.toLowerCase();
    let categoria = 'juego';
    let maxMatches = 0;
    for (const [key, val] of Object.entries(CATEGORIAS)) {
      const matches = val.keywords.filter(k => descLower.includes(k)).length;
      if (matches > maxMatches) { maxMatches = matches; categoria = key; }
    }
    const catInfo = CATEGORIAS[categoria];

    // Paso 4: generar pictograma con DALL-E 3 usando descripción ultra-detallada
    const prompt = `Create a clean pictogram illustration for autism communication that looks EXACTLY like this real object:

${descripcionDetallada}

CRITICAL REQUIREMENTS:
- The illustration must match the exact colors, shape and distinctive features described above
- Style: clean flat illustration, like a high-quality sticker
- Pure white background
- The object must be centered and fill most of the frame
- Keep all distinctive visual features: colors, decorations, text/logos if present
- Child-friendly, clear, no shadows, no gradients
- No people, no faces, no text added by you
- The result should be immediately recognizable as THIS specific object`;

    const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'hd',
        response_format: 'url'
      })
    });

    const dalleData = await dalleRes.json();
    if (!dalleRes.ok) throw new Error(dalleData?.error?.message || 'Error DALL-E');
    const imageUrl = dalleData.data[0].url;

    return res.status(200).json({
      nombre,
      descripcion: descripcionDetallada,
      categoria,
      color: catInfo.color,
      colorLabel: catInfo.label,
      imageUrl
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
