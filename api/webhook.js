const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Supabase client using the service role key (bypasses RLS — server-side only)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Map Stripe plan names → Supabase plan values
const PLAN_MAP = {
  starter:  'pro',       // £9/month  → stored as 'pro'
  pro:      'practice',  // £29/month → stored as 'practice'
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

  // Verify the request genuinely came from Stripe
  const sig     = req.headers['stripe-signature'];
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

  // Handle events — always return 200 so Stripe does not retry endlessly
  try {
    switch (event.type) {

      // ── New subscription created (trial started or paid) ──────────────────
      case 'checkout.session.completed': {
        const session    = event.data.object;
        const email      = session.customer_details?.email;
        const stripePlan = session.metadata?.plan;
        const plan       = PLAN_MAP[stripePlan] || 'pro';

        if (!email) {
          console.warn('checkout.session.completed: no email found in session');
          break;
        }

        // Fetch subscription to get period / trial end dates
        const sub = await stripe.subscriptions.retrieve(session.subscription);

        const { error } = await supabase.from('subscribers').upsert({
          site_id:                'pdftoledger',
          email,
          stripe_customer_id:     session.customer,
          stripe_subscription_id: session.subscription,
          plan,
          status:                 sub.status === 'trialing' ? 'trialing' : 'active',
          trial_ends_at:          sub.trial_end
                                    ? new Date(sub.trial_end * 1000).toISOString()
                                    : null,
          current_period_end:     new Date(sub.current_period_end * 1000).toISOString(),
        }, { onConflict: 'site_id,email' });

        if (error) console.error('Supabase upsert error:', error);
        else console.log(`Subscriber saved: ${email}, plan=${plan}`);
        break;
      }

      // ── Subscription renewed, upgraded, downgraded, or trial ended ────────
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const { error } = await supabase.from('subscribers')
          .update({
            status:             sub.status,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);

        if (error) console.error('Supabase update error (subscription.updated):', error);
        break;
      }

      // ── Subscription cancelled ────────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const { error } = await supabase.from('subscribers')
          .update({ status: 'cancelled', plan: 'free' })
          .eq('stripe_subscription_id', sub.id);

        if (error) console.error('Supabase update error (subscription.deleted):', error);
        break;
      }

      // ── Monthly renewal payment succeeded ─────────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription);
          const { error } = await supabase.from('subscribers')
            .update({
              status:             'active',
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            })
            .eq('stripe_subscription_id', invoice.subscription);

          if (error) console.error('Supabase update error (payment_succeeded):', error);
        }
        break;
      }

      // ── Payment failed (card declined / expired) ──────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const { error } = await supabase.from('subscribers')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', invoice.subscription);

          if (error) console.error('Supabase update error (payment_failed):', error);
        }
        break;
      }

      default:
        // Unhandled event type — safe to ignore
        break;
    }

  } catch (err) {
    // Log but still return 200 — prevents Stripe from retrying indefinitely
    console.error('Webhook handler error:', err.message);
  }

  return res.status(200).json({ received: true });
};

// Disable Vercel's automatic body parsing — we need the raw body
// so Stripe can verify the webhook signature
module.exports.config = {
  api: { bodyParser: false },
};
