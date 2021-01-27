const Workflow = require("@saltcorn/data/models/workflow");
const Form = require("@saltcorn/data/models/form");
const User = require("@saltcorn/data/models/user");
const Stripe = require("stripe");
const { getState } = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");

const configuration_workflow = () => {
  const cfg_base_url = getState().getConfig("base_url");

  return new Workflow({
    steps: [
      {
        name: "Stripe configuration",
        form: () =>
          new Form({
            labelCols: 3,
            blurb: !cfg_base_url
              ? "You should set the 'Base URL' configration property. "
              : "",
            fields: [
              {
                name: "public_api_key",
                label: "Publishable API key",
                type: "String",
                required: true,
              },
              {
                name: "api_key",
                label: "Secret API key",
                type: "String",
                required: true,
              },
            ],
          }),
      },
    ],
  });
};
const subscribe_configuration_workflow = (config, stripe) => async () => {
  const cfg_base_url = getState().getConfig("base_url");
  const roles = await User.get_roles();
  const prices = await stripe.prices.list({
    limit: 30,
  });
  db.sql_log(prices);
  const price_opts = (prices.data || []).map((p) => ({
    value: p.id,
    label: `${
      p.nickname ? `${p.nickname}: ` : ""
    }${p.currency.toUpperCase()} ${Math.floor(p.unit_amount / 100)}.${
      p.unit_amount % 100
    }${p.recurring ? `/${p.recurring.interval}` : ""}`,
  }));
  return new Workflow({
    steps: [
      {
        name: "Stripe subscribe configuration",
        form: () =>
          new Form({
            labelCols: 3,
            blurb: [
              !cfg_base_url
                ? "You should set the 'Base URL' configration property. "
                : "",
              !config || !config.api_key
                ? "You should set the Stripe API key in the stripe plugin configuration "
                : "",
            ],
            fields: [
              {
                name: "price_id",
                label: "Stripe price ID",
                input_type: "select",
                required: true,
                options: price_opts,
                sublabel: "Create prices in the Stripe dashboard",
              },
              {
                name: "role_id",
                label: "Role ID to elevate subscribers to",
                input_type: "select",
                required: true,
                options: roles.map((r) => ({ value: r.id, label: r.role })),
              },
              {
                name: "success_url",
                label: "Success url",
                type: "String",
              },
              {
                name: "cancel_url",
                label: "Cancel url",
                type: "String",
              },
            ],
          }),
      },
    ],
  });
};

// user subscribe action
const actions = ({ api_key }) => {
  const stripe = Stripe(api_key);
  return {
    check_stripe_subscriptions: { run: async () => {} },
  };
};

const run_subscribe = (plug_config, stripe) => async (
  table_id,
  viewname,
  config,
  state,
  extraArgs
) => {
  //check we are logged in
  const priceId = config.price_id;
  return `<script src="https://js.stripe.com/v3/"></script>
  <button id="${viewname}_checkout">Subscribe</button>
  <script>
  var createCheckoutSession = function(priceId) {
    return fetch("/view/${viewname}/create_checkout_session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CSRF-Token": _sc_globalCsrf,
      },
      body: JSON.stringify({
        priceId: priceId
      })
    }).then(function(result) {
      return result.json();
    });
  };
  var handleResult = function(result) {
    if (result.error) {
      notifyAlert({type: "danger", text:result.error.message})
    }
  };
  document
  .getElementById("${viewname}_checkout")
  .addEventListener("click", function(evt) {
    createCheckoutSession('${priceId}').then(function(data) {
      // Call Stripe.js method to redirect to the new Checkout page
      var stripe = Stripe('${plug_config.public_api_key}');
      stripe
        .redirectToCheckout({
          sessionId: data.sessionId
        })
        .then(handleResult);
    });
  });
  </script>`;
};
const trailSlash = (s) => (s[s.length - 1] === "/" ? s : `${s}/`);
const create_checkout_session = (plug_config, stripe) => async (
  table_id,
  viewname,
  config,
  body,
  { req }
) => {
  const { priceId } = req.body;
  db.sql_log({ priceId, config });
  const base_url = getState().getConfig("base_url");
  const user_id = req.user.id;
  // See https://stripe.com/docs/api/checkout/sessions/create
  // for additional parameters to pass.
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          // For metered billing, do not pass quantity
          quantity: 1,
        },
      ],
      // {CHECKOUT_SESSION_ID} is a string literal; do not change it!
      // the actual Session ID is returned in the query parameter when your customer
      // is redirected to the success page.
      success_url:
        trailSlash(base_url) +
        config.success_url +
        "?stripe_session_id={CHECKOUT_SESSION_ID}",
      cancel_url: trailSlash(base_url) + config.cancel_url,
    });
    db.sql_log(session);

    const user = await User.findOne({ id: user_id });
    await user.update({
      _attributes: {
        ...user._attributes,
        stripe_sessions: {
          ...(user._attributes.stripe_sessions || {}),
          [session.id]: {
            onsuccess: { elevate_user_role: +config.role_id },
            created: new Date(),
          },
        },
      },
    });
    return {
      json: {
        sessionId: session.id,
      },
    };
  } catch (e) {
    db.sql_log(e);

    return {
      status: 400,
      json: {
        error: {
          message: e.message,
        },
      },
    };
  }
};

const viewtemplates = (config) => {
  const stripe = Stripe(config.api_key);

  return [subscribe(config, stripe), success(config, stripe)];
};

const subscribe = (config, stripe) => {
  return {
    name: "Subscribe with Stripe",
    display_state_form: false,
    get_state_fields: () => [],
    run: run_subscribe(config, stripe),
    configuration_workflow: subscribe_configuration_workflow(config, stripe),
    routes: {
      create_checkout_session: create_checkout_session(config, stripe),
    },
  };
};
const success = (config, stripe) => {
  return {
    name: "Stripe success view",
    display_state_form: false,
    configuration_workflow: () => new Workflow({ steps: [] }),
    get_state_fields: () => [],
    run: async (table_id, viewname, view_cfg, state, { req }) => {
      const session_id = state.stripe_session_id;
      const user_id = req.user && req.user.id;
      if (session_id && user_id) {
        // TODO: check session is completed
        const stripe_session = await stripe.checkout.sessions.retrieve(
          session_id
        );
        db.sql_log(stripe_session);
        if (!stripe_session) return "No session";
        if (stripe_session.payment_status === "unpaid")
          return "Payment not processed";

        //elevate user
        const user = await User.findOne({ id: user_id });
        const session = user._attributes.stripe_sessions[session_id];
        if (session && session.onsuccess && session.onsuccess.elevate_user_role)
          await user.update({ role_id: session.onsuccess.elevate_user_role });
        //say something nice
        return "You're subscribed!";
      } else {
        return "No session";
      }
    },
  };
};
module.exports = {
  sc_plugin_api_version: 1,
  configuration_workflow,
  actions,
  viewtemplates,
};

/*todo:

-price ids from dropdown-webhook option
-pick pages from dropdown
-renewals?
-rm db.sql_log calls
*/
