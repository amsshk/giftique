export async function proxcRequest(
  method: string,
  path: string,
  body?: unknown
) {
  const PROXC_URL = process.env.PROXC_URL;
  const PROXC_API_KEY = process.env.PROXC_API_KEY;
  const PROXC_API_SECRET = process.env.PROXC_API_SECRET;
  if (!PROXC_URL || !PROXC_API_KEY || !PROXC_API_SECRET) {
    throw new Error("PROXC environment variables are not configured.");
  }
  const response = await fetch(`${PROXC_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `token ${PROXC_API_KEY}:${PROXC_API_SECRET}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const text = await response.text();

  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`PROXC API ${response.status}: ${text}`);
  }

  return data;
}
