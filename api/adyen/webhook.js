export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed. Use POST.'
    });
  }

  try {
    console.log('Adyen webhook received:', JSON.stringify(req.body, null, 2));

    return res.status(200).send('[accepted]');
  } catch (error) {
    console.error('Adyen webhook error:', error);

    return res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message || String(error)
    });
  }
}
