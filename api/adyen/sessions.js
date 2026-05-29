export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed. Use POST.'
    });
  }

  try {
    const apiKey =
      process.env.ADYEN_API_KEY ||
      process.env.ADYEN_PAYMENT_API_KEY;

    const merchantAccount = process.env.ADYEN_MERCHANT_ACCOUNT;

    if (!apiKey || !merchantAccount) {
      return res.status(500).json({
        error: 'Missing Adyen environment variables',
        hasApiKey: Boolean(apiKey),
        hasMerchantAccount: Boolean(merchantAccount)
      });
    }

    const body = req.body || {};

    const currency = body.currency || 'AUD';
    const orderTotal = Number(body.orderTotal || 0);
    const deliveryMethod = body.deliveryMethod || 'ship';
    const customer = body.customer || {};
    const items = Array.isArray(body.items) ? body.items : [];

    if (!orderTotal || orderTotal <= 0) {
      return res.status(400).json({
        error: 'Invalid order total'
      });
    }

    // Adyen expects minor units.
    // AUD has 2 decimals, so A$118.00 becomes 11800.
    const amountValue = Math.round(orderTotal * 100);

    const reference =
      'TodoMate-' +
      Date.now() +
      '-' +
      Math.random().toString(36).slice(2, 8).toUpperCase();

    const origin =
      req.headers.origin ||
      'https://todomate.com.au';

    const returnUrl =
      body.returnUrl ||
      `${origin}/?paymentResult=return`;

    const requestBody = {
      merchantAccount,

      amount: {
        currency,
        value: amountValue
      },

      reference,
      returnUrl,

      // Important for web checkout
      channel: 'Web',
      shopperInteraction: 'Ecommerce',

      countryCode: 'AU',
      shopperLocale: 'en-AU',

      // Card payment
      allowedPaymentMethods: ['scheme'],

      // Shopper details
      shopperEmail: customer.email || undefined,
      shopperReference: customer.email
        ? customer.email.replace(/[^a-zA-Z0-9_-]/g, '_')
        : undefined,

      // Helpful order metadata for later debugging
      metadata: {
        source: 'Todo Mate Website',
        deliveryMethod,
        customerName: customer.name || '',
        customerPhone: customer.phone || '',
        customerEmail: customer.email || '',
        customerAddress: customer.address || '',
        customerPostcode: customer.postcode || '',
        customerNote: customer.note || '',
        orderItems: items
          .map((item) => `${item.name || item.id} x ${item.qty}`)
          .join(', ')
          .slice(0, 500)
      }
    };

    // Remove undefined fields before sending to Adyen
    Object.keys(requestBody).forEach((key) => {
      if (requestBody[key] === undefined) {
        delete requestBody[key];
      }
    });

    const adyenResponse = await fetch(
      'https://checkout-test.adyen.com/v71/sessions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify(requestBody)
      }
    );

    const data = await adyenResponse.json();

    if (!adyenResponse.ok) {
      console.error('Adyen session creation failed:', {
        status: adyenResponse.status,
        data
      });

      return res.status(adyenResponse.status).json({
        error: 'Adyen session creation failed',
        status: adyenResponse.status,
        details: data
      });
    }

    // Return the raw Adyen session response.
    // Frontend needs id + sessionData directly.
    return res.status(200).json(data);
  } catch (error) {
    console.error('Todo Mate sessions.js error:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || String(error)
    });
  }
}
