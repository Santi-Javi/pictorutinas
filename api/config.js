export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const country = req.headers['x-vercel-ip-country'] || '';
  const intlUrl = process.env.INTL_PAYMENT_URL || '';
  const hasMp = !!process.env.MERCADOPAGO_ACCESS_TOKEN;

  const isArgentina = country === 'AR';
  const isUnknown = !country;

  // AR → MP only | Non-AR + intl configured → Intl only | Unknown → both as fallback
  const showMp = hasMp && (isArgentina || !intlUrl || isUnknown);
  const showIntl = !!intlUrl && (!isArgentina || isUnknown);

  return res.status(200).json({ country, showMp, showIntl, intlUrl });
}
