export function allowedOrigin(
  origin: string | null,
  requestUrl: string,
  appUrl = process.env.APP_URL,
  production = process.env.NODE_ENV === 'production',
) {
  if (!origin) return false;
  try {
    if (appUrl) return new URL(appUrl).origin === origin;
    if (production) return false; // Public deployments must declare their canonical origin.
    const request = new URL(requestUrl);
    const port = request.port ? `:${request.port}` : '';
    return (
      origin === `http://127.0.0.1${port}` ||
      origin === `http://localhost${port}` ||
      origin === `http://[::1]${port}`
    );
  } catch {
    return false;
  }
}
