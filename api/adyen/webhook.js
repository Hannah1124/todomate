export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed. Use POST.'
    });
  }

  try {
    const body = req.body || {};

    console.log('Adyen webhook received:', JSON.stringify(body, null, 2));

    const resendApiKey = process.env.RESEND_API_KEY;
    const orderNotificationEmail = process.env.ORDER_NOTIFICATION_EMAIL;

    if (!resendApiKey || !orderNotificationEmail) {
      console.error('Missing email environment variables', {
        hasResendApiKey: Boolean(resendApiKey),
        hasOrderNotificationEmail: Boolean(orderNotificationEmail)
      });

      return res.status(200).send('[accepted]');
    }

    const notificationItems = Array.isArray(body.notificationItems)
      ? body.notificationItems
      : [];

    for (const item of notificationItems) {
      const notification = item.NotificationRequestItem || item;

      const eventCode = notification.eventCode;
      const success = String(notification.success) === 'true';
      const merchantReference = notification.merchantReference || '';
      const pspReference = notification.pspReference || '';
      const merchantAccountCode = notification.merchantAccountCode || '';
      const amount = notification.amount || {};
      const additionalData = notification.additionalData || {};

      const currency = amount.currency || 'AUD';
      const value = amount.value ? Number(amount.value) / 100 : 0;
      const formattedAmount = `${currency} ${value.toFixed(2)}`;

      const customerName =
        additionalData.customerName ||
        additionalData['metadata.customerName'] ||
        'Customer';

      const customerEmail =
        additionalData.customerEmail ||
        additionalData['metadata.customerEmail'] ||
        '';

      const customerPhone =
        additionalData.customerPhone ||
        additionalData['metadata.customerPhone'] ||
        '';

      const customerAddress =
        additionalData.customerAddress ||
        additionalData['metadata.customerAddress'] ||
        '';

      const deliveryMethod =
        additionalData.deliveryMethod ||
        additionalData['metadata.deliveryMethod'] ||
        '';

      const orderItems =
        additionalData.orderItems ||
        additionalData['metadata.orderItems'] ||
        '';

      if (eventCode === 'AUTHORISATION' && success) {
        const subject = `New Todo Mate order paid - ${formattedAmount}`;

        const html = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #003f25;">
            <h2 style="color: #003f25;">New Todo Mate order paid</h2>

            <p>A new payment has been authorised successfully.</p>

            <div style="background: #eaf4e8; border: 1px solid #c9ddcf; padding: 16px; margin: 18px 0;">
              <p><strong>Amount:</strong> ${formattedAmount}</p>
              <p><strong>Merchant reference:</strong> ${merchantReference}</p>
              <p><strong>PSP reference:</strong> ${pspReference}</p>
              <p><strong>Merchant account:</strong> ${merchantAccountCode}</p>
            </div>

            <h3>Customer details</h3>
            <p><strong>Name:</strong> ${customerName}</p>
            <p><strong>Email:</strong> ${customerEmail || 'Not provided'}</p>
            <p><strong>Phone:</strong> ${customerPhone || 'Not provided'}</p>
            <p><strong>Address / Pickup:</strong> ${customerAddress || 'Not provided'}</p>
            <p><strong>Delivery method:</strong> ${deliveryMethod || 'Not provided'}</p>

            <h3>Order items</h3>
            <p>${orderItems || 'Order item details not available in webhook metadata.'}</p>

            <p style="margin-top: 24px; color: #5f6f67;">
              You can also check this transaction in the Adyen dashboard.
            </p>
          </div>
        `;

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Todo Mate <onboarding@resend.dev>',
            to: [orderNotificationEmail],
            subject,
            html
          })
        });

        const emailResult = await emailResponse.json();

        if (!emailResponse.ok) {
          console.error('Resend email failed:', emailResult);
        } else {
          console.log('Order notification email sent:', emailResult);
        }
      }
    }

    return res.status(200).send('[accepted]');
  } catch (error) {
    console.error('Adyen webhook error:', error);

    return res.status(200).send('[accepted]');
  }
}
