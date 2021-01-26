const Workflow = require("@saltcorn/data/models/workflow");
const Form = require("@saltcorn/data/models/form");
const User = require("@saltcorn/data/models/user");
const Stripe = require("stripe");
const { getState } = require("@saltcorn/data/db/state");

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
                name: "api_key",
                label: "API key",
                type: "String",
                required: true,
              },
              {
                name: "price_id",
                label: "Stripe price ID",
                type: "String",
              },
              {
                name: "role_id",
                label: "Role ID to elevate subscribers to",
                type: "Integer",
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

const run_subscribe = (config, stripe) => async (
  table_id,
  viewname,
  view_cfg,
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
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        priceId: ${priceId}
      })
    }).then(function(result) {
      return result.json();
    });
  };
  document
  .getElementById("${viewname}_checkout")
  .addEventListener("click", function(evt) {
    createCheckoutSession(${priceId}).then(function(data) {
      // Call Stripe.js method to redirect to the new Checkout page
      stripe
        .redirectToCheckout({
          sessionId: data.sessionId
        })
        .then(handleResult);
    });
  });
  </script>`;
};

const create_checkout_session = (config, stripe) => async (
  table_id,
  viewname,
  viewcfg,
  body,
  { req }
) => {
  const { priceId } = req.body;
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
        base_url + "/success.html?stripe_session_id={CHECKOUT_SESSION_ID}",
      cancel_url: base_url + "/canceled.html",
    });
    return {
      json: {
        sessionId: session.id,
      },
    };
  } catch (e) {
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
    //configuration_workflow: subscribe_configuration_workflow(config, stripe),
    routes: {
      create_checkout_session: create_checkout_session(config, stripe),
    },
  };
};
const success = (config, stripe) => {
  return {
    name: "Stripe success view",
    display_state_form: false,
    get_state_fields: () => [],
    run: async (table_id, viewname, view_cfg, state, { req }) => {
      const session_id = state.stripe_session_id;
      const user_id = req.user.id;
      // TODO: check session is completed

      //elevate user
      const user = await User.findOne({ id: user_id });
      await user.update({ role_id: config.role_id });
      //say something nice
      return "You're subscribed!";
    },
  };
};
module.exports = {
  sc_plugin_api_version: 1,
  configuration_workflow,
  actions,
  viewtemplates,
};
