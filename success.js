const Workflow = require("@saltcorn/data/models/workflow");
const User = require("@saltcorn/data/models/user");

const db = require("@saltcorn/data/db");
const { upgrade_with_session_id } = require("./common");

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
        await upgrade_with_session_id({
          user,
          req,
          session_id,
          customer: stripe_session.customer,
        });
        //say something nice
        return "You're subscribed!";
      } else {
        return "No session";
      }
    },
  };
};

module.exports = success;
