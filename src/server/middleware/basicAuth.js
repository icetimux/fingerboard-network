export function basicAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
    return res.sendStatus(401);
  }
  const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS;
  if (!adminPass) {
    console.error('ADMIN_PASS env variable is not set');
    return res.sendStatus(500);
  }
  if (user === adminUser && pass === adminPass) {
    next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
    return res.sendStatus(401);
  }
}