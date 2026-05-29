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

      if (eventCode !== 'AUTHORISATION' || !success) {
        continue;
      }

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

      const customerPostcode =
        additionalData.customerPostcode ||
        additionalData['metadata.customerPostcode'] ||
        '';

      const customerNote =
        additionalData.customerNote ||
        additionalData['metadata.customerNote'] ||
        '';

      const deliveryMethod =
        additionalData.deliveryMethod ||
        additionalData['metadata.deliveryMethod'] ||
        '';

      const orderItems =
        additionalData.orderItems ||
        additionalData['metadata.orderItems'] ||
        '';

      const sender = 'Todo Mate <hello@todomate.com.au>';

      // 1. Email to you / store owner
      const ownerSubject = `New Todo Mate order paid - ${formattedAmount}`;

      const ownerHtml = `
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
          <p><strong>Postcode:</strong> ${customerPostcode || 'Not provided'}</p>
          <p><strong>Delivery method:</strong> ${deliveryMethod || 'Not provided'}</p>
          <p><strong>Customer note:</strong> ${customerNote || 'Not provided'}</p>

          <h3>Order items</h3>
          <p>${orderItems || 'Order item details not available in webhook metadata.'}</p>

          <p style="margin-top: 24px; color: #5f6f67;">
            You can also check this transaction in the Adyen dashboard.
          </p>
        </div>
      `;

      const ownerEmailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: sender,
          to: [orderNotificationEmail],
          subject: ownerSubject,
          html: ownerHtml
        })
      });

      const ownerEmailResult = await ownerEmailResponse.json();

      if (!ownerEmailResponse.ok) {
        console.error('Owner email failed:', ownerEmailResult);
      } else {
        console.log('Owner order email sent:', ownerEmailResult);
      }

      // 2. Email to customer
      if (customerEmail) {
        const customerSubject = 'Your Todo Mate order is confirmed';

        const customerHtml = `
          <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #003f25; max-width: 640px; margin: 0 auto;">
            <div style="background: #eaf4e8; border: 1px solid #c9ddcf; padding: 24px; text-align: center;">
              <h2 style="margin: 0 0 12px; color: #003f25;">Payment received</h2>
              <p style="margin: 0; color: #5f6f67;">
                Thank you for your order. We’re preparing your mate ritual with care.
              </p>
            </div>

            <div style="padding: 24px 0;">
              <p>Hi ${customerName},</p>

              <p>
                We’ve received your Todo Mate order and payment successfully.
                We will confirm your pickup or delivery details shortly.
              </p>

              <div style="background: #f6f8f3; border: 1px solid #d8e3d7; padding: 16px; margin: 20px 0;">
                <p><strong>Order:</strong> ${orderItems || 'Todo Mate order'}</p>
                <p><strong>Total paid:</strong> ${formattedAmount}</p>
                <p><strong>Pickup / Delivery:</strong> ${customerAddress || 'We will confirm details shortly.'}</p>
                <p><strong>Reference:</strong> ${merchantReference}</p>
              </div>

              <p>
                If you have any questions, simply reply to this email.
              </p>

              <p style="margin-top: 28px;">
                Warmly,<br>
                Todo Mate
              </p>

              <hr style="border: none; border-top: 1px solid #d8e3d7; margin: 28px 0;">

              <p style="font-size: 13px; color: #5f6f67;">
                Know someone who would enjoy mate? Share Todo Mate with a friend and invite them into the ritual.
              </p>
            </div>
          </div>
        `;

        const customerEmailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: sender,
            to: [customerEmail],
            subject: customerSubject,
            html: customerHtml
          })
        });

        const customerEmailResult = await customerEmailResponse.json();

        if (!customerEmailResponse.ok) {
          console.error('Customer email failed:', customerEmailResult);
        } else {
          console.log('Customer confirmation email sent:', customerEmailResult);
        }
      } else {
        console.log('No customer email found. Customer confirmation email skipped.');
      }
    }

    return res.status(200).send('[accepted]');
  } catch (error) {
    console.error('Adyen webhook error:', error);

    // Always accept webhook so Adyen does not keep retrying while we debug email issues.
    return res.status(200).send('[accepted]');
  }
}
