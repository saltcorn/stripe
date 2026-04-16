const Workflow = require("@saltcorn/data/models/workflow");
const Form = require("@saltcorn/data/models/form");
const Page = require("@saltcorn/data/models/page");
const Table = require("@saltcorn/data/models/table");

const User = require("@saltcorn/data/models/user");
const { getState } = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");
const { trailSlash } = require("./common");

const one_time_configuration_workflow = (config, stripe) => () => {
  return new Workflow({
    steps: [
      {
        name: "Stripe one-time payment configuration",
        form: async () => {
          const cfg_base_url = getState().getConfig("base_url");
          const roles = await User.get_roles();
          console.log(await stripe.prices)
          const prices = await stripe.prices.list({ limit: 30 });
          const price_opts = (prices.data || [])
            .filter((p) => !p.recurring)
            .map((p) => ({
              value: p.id,
              label: `${
                p.nickname ? `${p.nickname}: ` : ""
              }${p.currency.toUpperCase()} ${Math.floor(
                p.unit_amount / 100
              )}.${String(p.unit_amount % 100).padStart(2, "0")}`,
            }));
          const pages = await Page.find();
          const page_opts = pages.map((p) => ({
            value: p.name,
            label: p.name,
          }));
          const jsonFields = Table.findOne("users").fields.filter(
            (f) => f.type.name === "JSON"
          );
          return new Form({
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
                sublabel:
                  "Create one-time prices in the Stripe dashboard. Only non-recurring prices are listed.",
              },
              {
                name: "role_id",
                label: "Role ID to elevate user to",
                input_type: "select",
                options: [
                  { value: "", label: "— no role change —" },
                  ...roles.map((r) => ({ value: r.id, label: r.role })),
                ],
                sublabel:
                  "Optionally grant the user a role after a successful payment",
              },
              {
                name: "response_field",
                label: "Response field",
                sublabel:
                  "A JSON field on the users table which will be set to the raw Stripe response",
                type: "String",
                attributes: { options: jsonFields.map((f) => f.name) },
              },
              {
                name: "success_page",
                label: "Success page",
                input_type: "select",
                options: page_opts,
                sublabel:
                  "Redirect to this page when the payment is successful",
              },
              {
                name: "cancel_page",
                label: "Cancel page",
                input_type: "select",
                options: page_opts,
                sublabel:
                  "Redirect to this page when the user does not proceed with payment",
              },
              {
                name: "link_label",
                label: "Button label",
                type: "String",
              },
            ],
          });
        },
      },
    ],
  });
};

const run_one_time =
  (plug_config, stripe) =>
  async (table_id, viewname, config, state, extraArgs) => {
    const priceId = config.price_id;
    return `<script src="https://js.stripe.com/v3/"></script>
    <button class="btn btn-primary" id="${viewname}_checkout">${
      config.link_label || "Pay"
    }</button>
    <script>
    var createCheckoutSession = function(priceId) {
      return fetch("/view/${viewname}/create_checkout_session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CSRF-Token": _sc_globalCsrf,
        },
        body: JSON.stringify({ priceId: priceId })
      }).then(function(result) {
        return result.json();
      });
    };
    var handleResult = function(result) {
      if (result.error) {
        notifyAlert({type: "danger", text: result.error.message});
      }
    };
    document
      .getElementById("${viewname}_checkout")
      .addEventListener("click", function(evt) {
        createCheckoutSession('${priceId}').then(function(data) {
          var stripe = Stripe('${plug_config.public_api_key}');
          stripe
            .redirectToCheckout({ sessionId: data.sessionId })
            .then(handleResult);
        });
      });
    </script>`;
  };

const create_one_time_checkout_session =
  (plug_config, stripe) =>
  async (table_id, viewname, config, body, { req }) => {
    const { priceId } = req.body;
    const base_url = getState().getConfig("base_url");
    const user_id = req.user && req.user.id;
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url:
          trailSlash(base_url) +
          "page/" +
          config.success_page +
          "?stripe_session_id={CHECKOUT_SESSION_ID}",
        cancel_url: trailSlash(base_url) + "page/" + config.cancel_page,
      });

      if (user_id) {
        const user = await User.findOne({ id: user_id });
        await user.update({
          _attributes: {
            ...user._attributes,
            stripe_sessions: {
              ...(user._attributes.stripe_sessions || {}),
              [session.id]: {
                onsuccess: {
                  ...(config.role_id
                    ? { elevate_user_role: +config.role_id }
                    : {}),
                  response_field: config.response_field,
                },
                created: new Date(),
              },
            },
          },
        });
      }

      return { json: { sessionId: session.id } };
    } catch (e) {
      db.sql_log(e);
      return {
        status: 400,
        json: { error: { message: e.message } },
      };
    }
  };

const one_time = (config, stripe) => {
  return {
    name: "Stripe checkout payment",
    description:
      "Show a button that directs the user to a one-time payment checkout with Stripe",
    display_state_form: false,
    tableless: true,
    get_state_fields: () => [],
    run: run_one_time(config, stripe),
    configuration_workflow: one_time_configuration_workflow(config, stripe),
    routes: {
      create_checkout_session: create_one_time_checkout_session(config, stripe),
    },
  };
};

module.exports = one_time;
