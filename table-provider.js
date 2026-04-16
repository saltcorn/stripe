const Workflow = require("@saltcorn/data/models/workflow");
const Form = require("@saltcorn/data/models/form");
const Stripe = require("stripe");

const ENTITY_TYPES = [
  "Charges",
  "Customers",
  "Events",
  "Payouts",
  "Refunds",
  "Payment Intents",
  "Products",
  "Subscriptions",
  "Invoices",
  "Prices",
  "Balance Transactions",
  "Disputes",
];

const FIELDS = {
  Charges: [
    { name: "id", type: "String", label: "ID", primary_key: true },
    { name: "amount", type: "Integer", label: "Amount (cents)" },
    {
      name: "amount_captured",
      type: "Integer",
      label: "Amount Captured (cents)",
    },
    {
      name: "amount_refunded",
      type: "Integer",
      label: "Amount Refunded (cents)",
    },
    { name: "currency", type: "String", label: "Currency" },
    { name: "status", type: "String", label: "Status" },
    { name: "paid", type: "Bool", label: "Paid" },
    { name: "refunded", type: "Bool", label: "Refunded" },
    { name: "captured", type: "Bool", label: "Captured" },
    { name: "livemode", type: "Bool", label: "Live Mode" },
    { name: "description", type: "String", label: "Description" },
    { name: "customer", type: "String", label: "Customer ID" },
    { name: "payment_intent", type: "String", label: "Payment Intent ID" },
    { name: "payment_method", type: "String", label: "Payment Method ID" },
    { name: "receipt_email", type: "String", label: "Receipt Email" },
    { name: "receipt_number", type: "String", label: "Receipt Number" },
    { name: "receipt_url", type: "String", label: "Receipt URL" },
    { name: "failure_code", type: "String", label: "Failure Code" },
    { name: "failure_message", type: "String", label: "Failure Message" },
    { name: "created", type: "Date", label: "Created" },
  ],
  Customers: [
    { name: "id", type: "String", label: "ID", primary_key: true },
    { name: "email", type: "String", label: "Email" },
    { name: "name", type: "String", label: "Name" },
    { name: "phone", type: "String", label: "Phone" },
    { name: "description", type: "String", label: "Description" },
    { name: "currency", type: "String", label: "Currency" },
    { name: "balance", type: "Integer", label: "Balance (cents)" },
    { name: "livemode", type: "Bool", label: "Live Mode" },
    { name: "delinquent", type: "Bool", label: "Delinquent" },
    { name: "created", type: "Date", label: "Created" },
  ],
  Events: [
    { name: "id", type: "String", label: "ID", primary_key: true },
    { name: "type", type: "String", label: "Type" },
    { name: "api_version", type: "String", label: "API Version" },
    { name: "livemode", type: "Bool", label: "Live Mode" },
    { name: "pending_webhooks", type: "Integer", label: "Pending Webhooks" },
    { name: "created", type: "Date", label: "Created" },
  ],
  Payouts: [
    { name: "id", type: "String", label: "ID", primary_key: true },
    { name: "amount", type: "Integer", label: "Amount (cents)" },
    { name: "currency", type: "String", label: "Currency" },
    { name: "status", type: "String", label: "Status" },
    { name: "livemode", type: "Bool", label: "Live Mode" },
    { name: "automatic", type: "Bool", label: "Automatic" },
    { name: "method", type: "String", label: "Method" },
    { name: "source_type", type: "String", label: "Source Type" },
    { name: "type", type: "String", label: "Type" },
    { name: "description", type: "String", label: "Description" },
    {
      name: "statement_descriptor",
      type: "String",
      label: "Statement Descriptor",
    },
    { name: "failure_code", type: "String", label: "Failure Code" },
    { name: "failure_message", type: "String", label: "Failure Message" },
    { name: "arrival_date", type: "Date", label: "Arrival Date" },
    { name: "created", type: "Date", label: "Created" },
  ],
  Refunds: [
    { name: "id", type: "String", label: "ID", primary_key: true },
    { name: "amount", type: "Integer", label: "Amount (cents)" },
    { name: "currency", type: "String", label: "Currency" },
    { name: "status", type: "String", label: "Status" },
    { name: "charge", type: "String", label: "Charge ID" },
    { name: "payment_intent", type: "String", label: "Payment Intent ID" },
    { name: "reason", type: "String", label: "Reason" },
    { name: "failure_reason", type: "String", label: "Failure Reason" },
    { name: "created", type: "Date", label: "Created" },
  ],
  "Payment Intents": [
    { name: "id", type: "String", label: "ID", primary_key: true },
    { name: "amount", type: "Integer", label: "Amount (cents)" },
    {
      name: "amount_capturable",
      type: "Integer",
      label: "Amount Capturable (cents)",
    },
    {
      name: "amount_received",
      type: "Integer",
      label: "Amount Received (cents)",
    },
    { name: "currency", type: "String", label: "Currency" },
    { name: "status", type: "String", label: "Status" },
    { name: "customer", type: "String", label: "Customer ID" },
    { name: "description", type: "String", label: "Description" },
    { name: "payment_method", type: "String", label: "Payment Method ID" },
    { name: "receipt_email", type: "String", label: "Receipt Email" },
    {
      name: "statement_descriptor",
      type: "String",
      label: "Statement Descriptor",
    },
    { name: "capture_method", type: "String", label: "Capture Method" },
    {
      name: "confirmation_method",
      type: "String",
      label: "Confirmation Method",
    },
    { name: "created", type: "Date", label: "Created" },
  ],
  Products: [
    { name: "id", type: "String", label: "ID", primary_key: true },
    { name: "name", type: "String", label: "Name" },
    { name: "description", type: "String", label: "Description" },
    { name: "active", type: "Bool", label: "Active" },
    { name: "url", type: "String", label: "URL" },
    { name: "livemode", type: "Bool", label: "Live Mode" },
    {
      name: "statement_descriptor",
      type: "String",
      label: "Statement Descriptor",
    },
    { name: "unit_label", type: "String", label: "Unit Label" },
    { name: "created", type: "Date", label: "Created" },
    { name: "updated", type: "Date", label: "Updated" },
  ],
  Subscriptions: [
    { name: "id", type: "String", label: "ID", primary_key: true },
    { name: "customer", type: "String", label: "Customer ID" },
    { name: "status", type: "String", label: "Status" },
    { name: "currency", type: "String", label: "Currency" },
    { name: "description", type: "String", label: "Description" },
    {
      name: "cancel_at_period_end",
      type: "Bool",
      label: "Cancel at Period End",
    },
    { name: "collection_method", type: "String", label: "Collection Method" },
    {
      name: "current_period_start",
      type: "Date",
      label: "Current Period Start",
    },
    { name: "current_period_end", type: "Date", label: "Current Period End" },
    { name: "trial_start", type: "Date", label: "Trial Start" },
    { name: "trial_end", type: "Date", label: "Trial End" },
    { name: "canceled_at", type: "Date", label: "Canceled At" },
    { name: "ended_at", type: "Date", label: "Ended At" },
    { name: "created", type: "Date", label: "Created" },
  ],
  Invoices: [
    { name: "id", type: "String", label: "ID", primary_key: true },
    { name: "number", type: "String", label: "Invoice Number" },
    { name: "customer", type: "String", label: "Customer ID" },
    { name: "subscription", type: "String", label: "Subscription ID" },
    { name: "livemode", type: "Bool", label: "Live Mode" },
    { name: "amount_due", type: "Integer", label: "Amount Due (cents)" },
    { name: "amount_paid", type: "Integer", label: "Amount Paid (cents)" },
    {
      name: "amount_remaining",
      type: "Integer",
      label: "Amount Remaining (cents)",
    },
    { name: "subtotal", type: "Integer", label: "Subtotal (cents)" },
    { name: "total", type: "Integer", label: "Total (cents)" },
    { name: "currency", type: "String", label: "Currency" },
    { name: "status", type: "String", label: "Status" },
    { name: "paid", type: "Bool", label: "Paid" },
    { name: "attempted", type: "Bool", label: "Attempted" },
    { name: "attempt_count", type: "Integer", label: "Attempt Count" },
    { name: "description", type: "String", label: "Description" },
    { name: "customer_email", type: "String", label: "Customer Email" },
    { name: "customer_name", type: "String", label: "Customer Name" },
    { name: "due_date", type: "Date", label: "Due Date" },
    { name: "period_start", type: "Date", label: "Period Start" },
    { name: "period_end", type: "Date", label: "Period End" },
    { name: "created", type: "Date", label: "Created" },
  ],
  Prices: [
    { name: "id", type: "String", label: "ID", primary_key: true },
    { name: "product", type: "String", label: "Product ID" },
    { name: "currency", type: "String", label: "Currency" },
    { name: "unit_amount", type: "Integer", label: "Unit Amount (cents)" },
    { name: "type", type: "String", label: "Type" },
    { name: "nickname", type: "String", label: "Nickname" },
    { name: "active", type: "Bool", label: "Active" },
    { name: "billing_scheme", type: "String", label: "Billing Scheme" },
    { name: "recurring_interval", type: "String", label: "Recurring Interval" },
    {
      name: "recurring_interval_count",
      type: "Integer",
      label: "Recurring Interval Count",
    },
    { name: "created", type: "Date", label: "Created" },
  ],
  "Balance Transactions": [
    { name: "id", type: "String", label: "ID", primary_key: true },
    { name: "amount", type: "Integer", label: "Amount (cents)" },
    { name: "fee", type: "Integer", label: "Fee (cents)" },
    { name: "net", type: "Integer", label: "Net (cents)" },
    { name: "currency", type: "String", label: "Currency" },
    { name: "type", type: "String", label: "Type" },
    { name: "status", type: "String", label: "Status" },
    { name: "description", type: "String", label: "Description" },
    { name: "source", type: "String", label: "Source ID" },
    { name: "reporting_category", type: "String", label: "Reporting Category" },
    { name: "available_on", type: "Date", label: "Available On" },
    { name: "created", type: "Date", label: "Created" },
  ],
  Disputes: [
    { name: "id", type: "String", label: "ID", primary_key: true },
    { name: "amount", type: "Integer", label: "Amount (cents)" },
    { name: "currency", type: "String", label: "Currency" },
    { name: "status", type: "String", label: "Status" },
    { name: "reason", type: "String", label: "Reason" },
    { name: "charge", type: "String", label: "Charge ID" },
    { name: "payment_intent", type: "String", label: "Payment Intent ID" },
    { name: "livemode", type: "Bool", label: "Live Mode" },
    { name: "is_charge_refundable", type: "Bool", label: "Charge Refundable" },
    { name: "created", type: "Date", label: "Created" },
  ],
};

const DATE_FIELDS = {
  Charges: ["created"],
  Customers: ["created"],
  Events: ["created"],
  Payouts: ["created", "arrival_date"],
  Refunds: ["created"],
  "Payment Intents": ["created"],
  Products: ["created", "updated"],
  Subscriptions: [
    "created",
    "current_period_start",
    "current_period_end",
    "trial_start",
    "trial_end",
    "canceled_at",
    "ended_at",
  ],
  Invoices: ["created", "due_date", "period_start", "period_end"],
  Prices: ["created"],
  "Balance Transactions": ["created", "available_on"],
  Disputes: ["created"],
};

const toDate = (ts) => (ts ? new Date(ts * 1000) : null);

const normalizeRow = (entity_type, obj) => {
  const dateFields = new Set(DATE_FIELDS[entity_type] || []);
  const row = {};
  for (const field of FIELDS[entity_type] || []) {
    const { name } = field;
    let val;

    // Special case: Prices has nested recurring object
    if (entity_type === "Prices" && name === "recurring_interval") {
      val = obj.recurring ? obj.recurring.interval : "-";
    } else if (
      entity_type === "Prices" &&
      name === "recurring_interval_count"
    ) {
      val = obj.recurring ? obj.recurring.interval_count : "-";
    } else {
      val = obj[name];
    }

    row[name] = dateFields.has(name) ? toDate(val) : (val ?? null);
  }
  return row;
};

// Fetch rows from Stripe

const fetchRows = async (stripe, entity_type, limit) => {
  const params = { limit: Math.min(limit, 100) };

  let items;
  switch (entity_type) {
    case "Charges":
      items = await stripe.charges.list(params).autoPagingToArray({ limit });
      break;
    case "Customers":
      items = await stripe.customers.list(params).autoPagingToArray({ limit });
      break;
    case "Events":
      items = await stripe.events.list(params).autoPagingToArray({ limit });
      break;
    case "Payouts":
      items = await stripe.payouts.list(params).autoPagingToArray({ limit });
      break;
    case "Refunds":
      items = await stripe.refunds.list(params).autoPagingToArray({ limit });
      break;
    case "Payment Intents":
      items = await stripe.paymentIntents
        .list(params)
        .autoPagingToArray({ limit });
      break;
    case "Products":
      items = await stripe.products.list(params).autoPagingToArray({ limit });
      break;
    case "Subscriptions":
      items = await stripe.subscriptions
        .list({ ...params, status: "all" })
        .autoPagingToArray({ limit });
      break;
    case "Invoices":
      items = await stripe.invoices.list(params).autoPagingToArray({ limit });
      break;
    case "Prices":
      items = await stripe.prices.list(params).autoPagingToArray({ limit });
      break;
    case "Balance Transactions":
      items = await stripe.balanceTransactions
        .list(params)
        .autoPagingToArray({ limit });
      break;
    case "Disputes":
      items = await stripe.disputes.list(params).autoPagingToArray({ limit });
      break;
    default:
      items = [];
  }

  return (items || []).map((obj) => normalizeRow(entity_type, obj));
};

// Cache

const cache = {};
const cacheTime = {};
const CACHE_TTL_MS = 60 * 1000;

const cacheKey = (entity_type, limit) => `${entity_type}::${limit}`;

const isFresh = (key) => {
  if (!cacheTime[key]) return false;
  return Date.now() - cacheTime[key] < CACHE_TTL_MS;
};

const getRows = async (stripe, entity_type, limit) => {
  const key = cacheKey(entity_type, limit);
  console.log("***", cache);
  if (!isFresh(key)) {
    cache[key] = await fetchRows(stripe, entity_type, limit);
    cacheTime[key] = Date.now();
  }
  return cache[key];
};

// Configuration workflow

const configuration_workflow = () => () =>
  new Workflow({
    steps: [
      {
        name: "Stripe data",
        form: async () =>
          new Form({
            fields: [
              {
                name: "entity_type",
                label: "Entity type",
                type: "String",
                required: true,
                attributes: { options: ENTITY_TYPES },
              },
              {
                name: "limit",
                label: "Max records",
                type: "Integer",
                sublabel:
                  "Maximum number of records to fetch from Stripe (default 100). Large values will auto-paginate.",
                default: 100,
              },
            ],
          }),
      },
    ],
  });

module.exports = (modcfg) => ({
  "Stripe data": {
    configuration_workflow: configuration_workflow(modcfg),

    fields: (cfgTable) => {
      const entity_type = cfgTable?.entity_type;
      return (
        FIELDS[entity_type] || [
          { name: "id", type: "String", label: "ID", primary_key: true },
        ]
      );
    },

    get_table: (cfgTable) => {
      const stripe = Stripe(modcfg.api_key);
      const entity_type = cfgTable?.entity_type;
      const limit = cfgTable?.limit || 100;

      return {
        getRows: async (_where, _opts) => {
          return await getRows(stripe, entity_type, limit);
        },
      };
    },
  },
});
