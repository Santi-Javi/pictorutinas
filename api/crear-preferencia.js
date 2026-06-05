export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: 'Pagos no configurados' });

  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  try {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        items: [{
          title: 'PictoRutinas Pro',
          description: 'Acceso ilimitado · sin límites diarios',
          unit_price: 5,
          quantity: 1,
          currency_id: 'USD'
        }],
        back_urls: {
          success: `${baseUrl}/?pago=ok`,
          failure: `${baseUrl}/?pago=error`,
          pending: `${baseUrl}/?pago=pendiente`
        },
        auto_return: 'approved',
        statement_descriptor: 'PICTORUTINAS PRO',
        payment_methods: { installments: 1 }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Error MercadoPago');

    return res.status(200).json({ init_point: data.init_point });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
