const upgrade_with_session_id = async ({ user, session_id, customer, req }) => {
  const session = user._attributes.stripe_sessions[session_id];
  if (session && session.onsuccess && session.onsuccess.elevate_user_role) {
    const new_role_id = Math.min(
      user.role_id,
      session.onsuccess.elevate_user_role
    );
    await user.update({
      role_id: new_role_id,
      _attributes: {
        ...user._attributes,
        ...(customer ? { stripe_customer: customer } : {}),
      },
    });
    user.role_id = new_role_id;
    if (user.relogin && req) user.relogin(req);
  }
};

module.exports = { upgrade_with_session_id };
