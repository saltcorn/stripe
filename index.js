const Workflow = require("@saltcorn/data/models/workflow");
const Form = require("@saltcorn/data/models/form");
const User = require("@saltcorn/data/models/user");
const Stripe = require("stripe");
const { getState } = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");
const success = require("./success");
const subscribe = require("./subscribe");

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
              {
                name: "webhook_signing_secret",
                label: "Webhook signing secret",
                sublabel: `Enable a 'stripe_webhook' as an 'API call' action.`,
                type: "String",
                required: true,
              },
            ],
          }),
      },
    ],
  });
};

// user subscribe action
const actions = ({ api_key, webhook_signing_secret }) => {
  const stripe = Stripe(api_key);
  return {
    stripe_webhook: {
      run: async ({ req, body }) => {
        let event;
        if (webhook_signing_secret) {
          const sig = req.headers["stripe-signature"];
          event = stripe.webhooks.constructEvent(
            req.rawBody,
            sig,
            webhook_signing_secret
          );
        } else {
          event = body;
        }
        db.sql_log(event);
        switch (event.type) {
          case "checkout.session.completed":
            const session_id = event.data.object.id;
            const schemaPrefix = db.getTenantSchemaPrefix();

            const result = await db.query(
              `select * from ${schemaPrefix}users where _attributes->'stripe_sessions'->'${db.sqlsanitize(
                session_id
              )}' is not null`
            );
            db.sql_log(result);

            const user = result.rows[0];
            if (user) {
              const session = user._attributes.stripe_sessions[session_id];
              if (
                session &&
                session.onsuccess &&
                session.onsuccess.elevate_user_role
              )
                await new User(user).update({
                  role_id: Math.min(
                    user.role_id,
                    +session.onsuccess.elevate_user_role
                  ),
                });
            } else {
              db.sql_log(`user not found`);
            }
            break;
          default:
            console.log(`Unhandled event type ${event.type}`);
        }
        return { received: true };
      },
    },
  };
};

const viewtemplates = (config) => {
  const stripe = Stripe(config.api_key);

  return [subscribe(config, stripe), success(config, stripe)];
};

module.exports = {
  sc_plugin_api_version: 1,
  configuration_workflow,
  actions,
  viewtemplates,
};

/*todo:


-webhook option
-billing portal
-success/cancel urls by dropdown
-renewals?
-rm db.sql_log calls
*/
