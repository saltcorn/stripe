const upgrade_with_session_id = async ({
  user,
  session_id,
  customer,
  req,
  response,
}) => {
  const session = user._attributes.stripe_sessions[session_id];
  if (session && session.onsuccess && session.onsuccess.elevate_user_role) {
    const new_role_id = Math.min(
      user.role_id,
      session.onsuccess.elevate_user_role
    );
    const upd = {
      role_id: new_role_id,
      _attributes: {
        ...user._attributes,
        ...(customer ? { stripe_customer: customer } : {}),
      },
    };
    if (session.onsuccess.response_field && response)
      upd[session.onsuccess.response_field] = response;
    await user.update(upd);
    user.role_id = new_role_id;
    if (user.relogin && req) user.relogin(req);
  }
};
const trailSlash = (s) => (s[s.length - 1] === "/" ? s : `${s}/`);

module.exports = { upgrade_with_session_id, trailSlash };
