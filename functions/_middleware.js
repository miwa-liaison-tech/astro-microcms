const USER_SECRET_NAME = "BASIC_AUTH_USER";
const PASSWORD_SECRET_NAME = "BASIC_AUTH_PASSWORD";
const REALM = "Astro microCMS test site";

function unauthorizedResponse() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
    },
  });
}

function configurationErrorResponse() {
  return new Response("Basic authentication is not configured", {
    status: 500,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function decodeCredentials(header) {
  const [scheme, encoded] = header.trim().split(/\s+/, 2);
  if (scheme !== "Basic" || !encoded) return null;

  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

async function digest(value) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function credentialsMatch(credentials, env) {
  const [actualUser, actualPassword, expectedUser, expectedPassword] = await Promise.all([
    digest(credentials.username),
    digest(credentials.password),
    digest(env[USER_SECRET_NAME]),
    digest(env[PASSWORD_SECRET_NAME]),
  ]);

  return (
    timingSafeEqual(actualUser, expectedUser) &&
    timingSafeEqual(actualPassword, expectedPassword)
  );
}

export async function onRequest(context) {
  const { request, env } = context;
  const expectedUser = env[USER_SECRET_NAME];
  const expectedPassword = env[PASSWORD_SECRET_NAME];

  if (!expectedUser || !expectedPassword) {
    return configurationErrorResponse();
  }

  const header = request.headers.get("Authorization");
  const credentials = header ? decodeCredentials(header) : null;

  if (!credentials || !(await credentialsMatch(credentials, env))) {
    return unauthorizedResponse();
  }

  return context.next();
}
