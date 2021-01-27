const Workflow = require("@saltcorn/data/models/workflow");
const User = require("@saltcorn/data/models/user");
const { getState } = require("@saltcorn/data/db/state");

const db = require("@saltcorn/data/db");
const { upgrade_with_session_id } = require("./common");

const portal = (config, stripe) => {
  return {
    name: "Stripe customer portal",
    display_state_form: false,
    configuration_workflow: () => new Workflow({ steps: [] }),
    get_state_fields: () => [],
    run: async (table_id, viewname, view_cfg, state, { req }) => {
      const user_id = req.user && req.user.id;
      const user = await User.findOne({ id: user_id });
      const customer = user._attributes.stripe_customer;

      if (customer) {
        const portalsession = await stripe.billingPortal.sessions.create({
          customer,
        });
        return `Redirecting...<script>window.location.href="${portalsession.url}"</script>`;
      } else {
        return "Not found";
      }
    },
  };
};

module.exports = portal;
