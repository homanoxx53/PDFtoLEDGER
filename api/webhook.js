const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Vercel: disable body parsing so we get the raw body for signature verification
export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle events
  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object;
      const plan = session.metadata?.plan;
      const customerId = session.customer;
      const subscriptionId = session.subscription;
      console.log(`New subscription: plan=${plan}, customer=${customerId}, subscription=${subscriptionId}`);
      // TODO: create/update user record in your database
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      console.log(`Subscription updated: ${subscription.id}, status=${subscription.status}`);
      // TODO: update user plan/status in your database
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      console.log(`Subscription cancelled: ${subscription.id}`);
      // TODO: downgrade user to free plan in your database
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      console.log(`Payment succeeded: invoice=${invoice.id}, customer=${invoice.customer}`);
      // TODO: extend access period, send receipt email, etc.
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.warn(`Payment failed: invoice=${invoice.id}, customer=${invoice.customer}`);
      // TODO: notify user, retry logic, etc.
      break;
    }

    default:
      // Unhandled event type — safe to ignore
      break;
  }

  return res.status(200).json({ received: true });
};
