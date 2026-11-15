// Foto -> ilustración de pictograma, siempre con el mismo estilo (el del cuaderno de Camilo).
// La IA dibuja SOLO la ilustración: el marco de color y el texto los pone la app,
// así todas las tarjetas quedan iguales y sin errores de ortografía.
export const config = { maxDuration: 60 };

const ESTILO = `
STYLE (must be identical for every image of this series):
- Clean pictogram illustration for an autism communication notebook, like a high-quality printed sticker.
- Flat vector look: smooth uniform outlines, bright saturated colors, soft minimal shading, no gradients, no shadows, no textures.
- Pure white background, subject centered and filling about 80% of the frame, nothing else in the scene.
- ABSOLUTELY NO text, letters, numbers, captions, frames, borders or watermarks added by you.`;

const PROMPTS = {
  yo: `Redraw the child in the photo as a friendly semi-realistic cartoon character (illustrated portrait style, like a pictogram of a real person). Keep the real likeness: face shape, skin tone, hair color and haircut, expression, and the clothes and their colors. Show the same pose or action as the photo, upper body or full body as needed. Clean illustrated look, not a photograph.`,
  persona: `Redraw the person in the photo as a friendly semi-realistic cartoon character (illustrated pictogram of a real person). Keep the likeness: face, skin tone, hair, clothes and colors, and the same pose or action. Clean illustrated look, not a photograph.`,
  objeto: `Redraw the main object of the photo as a clean illustrated cut-out that looks EXACTLY like the real object: same shape, colors, details, and any logo or packaging design. Show only the object, isolated, no hands, no background, no people.`,
  comida: `Redraw the food or food product of the photo as a clean illustrated cut-out that looks EXACTLY like the real one: same packaging, colors and logo if it is a product, or the real appearance of the dish. Show only the food or product, isolated, no hands, no table, no people.`,
  accion: `Redraw the scene of the photo as a simple illustrated pictogram of the action, keeping the real colors of clothes and objects. Show only the essential elements of the action, no background.`,
  alerta: `Redraw the main subject of the photo as a clean illustrated pictogram keeping its real colors and shape, showing only what is essential, no background.`,
  no: `Redraw the main subject or action of the photo as a clean illustrated pictogram keeping real colors, showing the behavior clearly. Do NOT draw any red cross, prohibition sign or X: the app adds it later.`
};
const TIPOS = Object.keys(PROMPTS);

function dataUrlToBlob(dataUrl) {
  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(dataUrl || '');
  if (!m) throw new Error('Imagen inválida');
  return new Blob([Buffer.from(m[2], 'base64')], { type: m[1] });
}

async function openai(path, body, json = true) {
  const r = await fetch('https://api.openai.com/v1/' + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...(json ? { 'Content-Type': 'application/json' } : {}) },
    body: json ? JSON.stringify(body) : body
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'Error de OpenAI');
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { imagen, tipo: tipoPedido, nombre: nombrePedido } = req.body || {};
  if (typeof imagen !== 'string' || imagen.length > 6000000) return res.status(400).json({ error: 'Imagen inválida o muy grande' });
  if (!imagen) return res.status(400).json({ error: 'Falta la imagen' });

  try {
    // 1) Nombre corto y tipo sugerido
    let nombre = String(nombrePedido || '').trim().slice(0, 30);
    let tipo = TIPOS.includes(tipoPedido) ? tipoPedido : '';
    if (!nombre || !tipo) {
      const c = await openai('chat/completions', {
        model: 'gpt-4o-mini', max_tokens: 60, response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: imagen, detail: 'low' } },
          { type: 'text', text: `Para un cuaderno de pictogramas de un niño con autismo (español rioplatense). Respondé SOLO JSON: {"nombre":"1 a 3 palabras que nombran lo principal de la foto","tipo":"uno de: yo, persona, objeto, comida, accion, alerta, no"}. "yo" si es el propio niño; "comida" si es alimento; "no" solo si muestra una conducta que se quiere evitar.` }
        ] }]
      });
      try {
        const j = JSON.parse(c.choices[0].message.content);
        if (!nombre) nombre = String(j.nombre || '').trim().slice(0, 30);
        if (!tipo) tipo = TIPOS.includes(j.tipo) ? j.tipo : 'objeto';
      } catch (e) { if (!tipo) tipo = 'objeto'; }
    }

    // 2) Ilustración con el estilo fijo. gpt-image-1 conserva el parecido con la foto.
    const prompt = PROMPTS[tipo] + '\n' + ESTILO;
    let ilustracion = null, motor = 'gpt-image-1';
    try {
      const fd = new FormData();
      fd.append('model', 'gpt-image-1');
      fd.append('image', dataUrlToBlob(imagen), 'foto.png');
      fd.append('prompt', prompt);
      fd.append('size', '1024x1024');
      fd.append('quality', 'medium');
      const d = await openai('images/edits', fd, false);
      ilustracion = 'data:image/png;base64,' + d.data[0].b64_json;
    } catch (e1) {
      // Respaldo: descripción + DALL-E 3 (sirve para objetos; no puede copiar una cara)
      if (tipo === 'yo' || tipo === 'persona') {
        return res.status(502).json({ error: 'Para parecerse a la persona hace falta el modelo de imágenes gpt-image-1 (requiere verificar la organización en OpenAI). Detalle: ' + e1.message });
      }
      motor = 'dall-e-3';
      const v = await openai('chat/completions', {
        model: 'gpt-4o', max_tokens: 300,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: imagen, detail: 'high' } },
          { type: 'text', text: 'Describí en inglés, con colores exactos, forma y detalles distintivos, solo el objeto principal de la imagen, para recrearlo como ilustración.' }
        ] }]
      });
      const d = await openai('images/generations', {
        model: 'dall-e-3', size: '1024x1024', quality: 'hd', response_format: 'b64_json', n: 1,
        prompt: `${PROMPTS[tipo].split('.')[0]}.\nSubject: ${v.choices[0].message.content}\n${ESTILO}`
      });
      ilustracion = 'data:image/png;base64,' + d.data[0].b64_json;
    }

    return res.status(200).json({ nombre, tipo, ilustracion, motor });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
