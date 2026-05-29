const PRODUCT_CATALOG = {
  playadito: { name: 'Playadito Yerba Mate 500g', priceCents: 1290 },
  baldo: { name: 'Baldo Yerba Mate 1kg', priceCents: 1350 },
  canarias: { name: 'Canarias Yerba Mate 1kg', priceCents: 1450 },

  kitTorpedo: { name: 'Mate Kit | Starter', priceCents: 5900 },
  kitPro: { name: 'Mate Kit | Pro', priceCents: 11000 },
  kitAdvanced: { name: 'Mate Kit | Advanced', priceCents: 7800 },

  packagePlayadito3kg: { name: '3kg Mate Package | Playadito', priceCents: 4800 },
  packageBaldo3kg: { name: '3kg Mate Package | Baldo', priceCents: 4800 },
  packageLaTranquera3kg: { name: '3kg Mate Package | La Tranquera', priceCents: 4800 },
  laTranquera500g: { name: 'La Tranquera | Tradicional | 500g', priceCents: 900 },

  cupTruckyArgentina: { name: 'MATE CUP | Trucky Argentina Flag', priceCents: 5000 },
  cupImperial: { name: 'MATE CUP | Imperial', priceCents: 8000 },
  gourdHandmadeNatural: { name: 'Mate Gourd Set | Handmade Natural', priceCents: 4900 },
  bombillaParrotBeak: { name: 'STRAW Bombilla | Stainless Steel Parrot Beak', priceCents: 1800 },

  teeluxTeaBags50: { name: 'TeeLux Yerba Mate Tea Bags | 50 bags', priceCents: 3500 },
  ecoteasTeaBags24: { name: 'EcoTeas Yerba Mate Tea Bags | 24 bags', priceCents: 1800 },
  playaditoMateCocido: { name: 'Playadito Mate Cocido Tea Bags | 60 bags', priceCents: 1500 }
};

function normaliseQty(qty) {
  const number = Number(qty);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(20, Math.floor(number)));
}

function buildOrder(items = [], deliveryMethod = 'ship') {
  const orderItems = [];

  for (const item of items) {
    const product = PRODUCT_CATALOG[item.id];
    const qty = normaliseQty(item.qty);

    if (!product || qty <= 0) continue;

    orderItems.push({
      id: item.id,
      name: product.name,
      qty,
      unitPriceCents: product.priceCents,
      lineTotalCents: product.priceCents * qty
    });
  }

  const productSubtotalCents = orderItems.reduce(
    (sum, item) => sum + item.lineTotalCents,
    0
  );

  if (!orderItems.length || productSubtotalCents <= 0) {
    throw new Error('Cart is empty or invalid.');
  }

  const isPickup = deliveryMethod === 'pickup';
  const shippingCents = isPickup ? 0 : productSubtotalCents >= 5900 ? 0 : 900;
  const orderTotalCents = productSubtotalCents + shippingCents;

  return {
    orderItems,
    productSubtotalCents,
    shippingCents,
    orderTotalCents,
    deliveryMethod: isPickup ? 'pickup' : 'ship'
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.ADYEN_API_KEY || process.env.ADYEN_PAYMENT_API_KEY;
    const merchantAccount = process.env.ADYEN_MERCHANT_ACCOUNT;

    if (!apiKey || !merchantAccount) {
  return res.status(500).json({
    error: 'Missing Adyen environment variables',
    hasApiKey: Boolean(apiKey),
    hasMerchantAccount: Boolean(merchantAccount)
  });
}

    const {
      items,
      deliveryMethod,
      customer = {},
      returnUrl
    } = req.body || {};

    const order = buildOrder(items, deliveryMethod);
    const orderReference = `TODOMATE-${Date.now()}`;

    const customerName = String(customer.name || '').trim();
    const customerEmail = String(customer.email || '').trim();
    const customerPhone = String(customer.phone || '').trim();
    const customerAddress = String(customer.address || '').trim();
    const customerPostcode = String(customer.postcode || '').trim();
    const customerNote = String(customer.note || '').trim();

    const requestBody = {
      merchantAccount,
      amount: {
        currency: 'AUD',
        value: order.orderTotalCents
      },
      reference: orderReference,
      returnUrl: returnUrl || 'https://todomate.com.au/?paymentResult=return',
      countryCode: 'AU',
      shopperLocale: 'en-AU',
      shopperEmail: customerEmail || undefined,
      telephoneNumber: customerPhone || undefined,
      metadata: {
        orderReference,
        deliveryMethod: order.deliveryMethod,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        customerPostcode,
        customerNote,
        productSubtotalAUD: (order.productSubtotalCents / 100).toFixed(2),
        shippingAUD: (order.shippingCents / 100).toFixed(2),
        orderTotalAUD: (order.orderTotalCents / 100).toFixed(2),
        items: order.orderItems.map(item => `${item.qty} x ${item.name}`).join(' | ')
      }
    };

    if (customerName) {
      requestBody.shopperName = {
        firstName: customerName,
        lastName: ' '
      };
    }

    const adyenResponse = await fetch('https://checkout-test.adyen.com/v71/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    });

    const data = await adyenResponse.json();

    if (!adyenResponse.ok) {
      return res.status(adyenResponse.status).json({
        error: 'Adyen session creation failed',
        details: data
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(400).json({
      error: error.message || 'Unable to create Adyen session.'
    });
  }
}
