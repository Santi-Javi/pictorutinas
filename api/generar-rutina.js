export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { rutina } = req.body;
  if (!rutina) return res.status(400).json({ error: 'Falta el nombre de la rutina' });

  const COLORES = {
    higiene: '#3B82F6',
    comida: '#10B981',
    escuela: '#F59E0B',
    descanso: '#EF4444',
    juego: '#8B5CF6',
    ropa: '#F97316'
  };

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 600,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Sos un experto en comunicación para personas con Trastorno del Espectro Autista (TEA). 
Generás rutinas visuales en pasos simples y concretos.
Respondé ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "titulo": "nombre claro de la rutina",
  "pasos": [
    {
      "numero": 1,
      "nombre": "nombre corto del paso (máximo 3 palabras)",
      "descripcion": "descripción simple de la acción",
      "categoria": "una de: higiene, comida, escuela, descanso, juego, ropa",
      "emoji": "un emoji que represente el paso"
    }
  ]
}
Reglas:
- Entre 3 y 7 pasos por rutina
- Nombres muy cortos y concretos
- Orden lógico y predecible
- Lenguaje en español rioplatense
- Categorías: higiene (baño/dientes/manos), comida (comer/beber), escuela (mochila/jardín/tarea), descanso (dormir/siesta), juego (tiempo libre/juguetes), ropa (vestirse/cambiarse)`
          },
          { role: 'user', content: `Generá la rutina para: "${rutina}"` }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Error API');

    const resultado = JSON.parse(data.choices[0].message.content);
    
    // agregar color a cada paso
    resultado.pasos = resultado.pasos.map(p => ({
      ...p,
      color: COLORES[p.categoria] || '#8B5CF6'
    }));

    return res.status(200).json(resultado);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
