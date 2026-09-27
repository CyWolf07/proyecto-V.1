const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const exampleValues = ['admin@example.com', 'replace-with-a-long-unique-password'];

function required(env, name) {
  const value = String(env[name] || '').trim();
  if (!value) throw new Error(`${name} es obligatoria`);
  return value;
}

function positiveInteger(value, name, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} debe ser un entero positivo`);
  }
  return parsed;
}

export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const databaseUrl = required(env, 'DATABASE_URL');
  let database;
  try {
    database = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL debe ser una URL válida de PostgreSQL');
  }
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname) {
    throw new Error('DATABASE_URL debe usar postgres:// o postgresql:// e incluir un host');
  }
  if (/^(USER|PASSWORD|HOST)$/i.test(database.username) || /^(USER|PASSWORD|HOST)$/i.test(database.password) || database.hostname.toUpperCase() === 'HOST') {
    throw new Error('DATABASE_URL todavía contiene valores de ejemplo; configure la conexión PostgreSQL real');
  }

  const adminEmail = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = String(env.ADMIN_PASSWORD || '');
  if (production) {
    required(env, 'ADMIN_EMAIL');
    required(env, 'ADMIN_PASSWORD');
    if (!emailPattern.test(adminEmail) || exampleValues.includes(adminEmail)) {
      throw new Error('ADMIN_EMAIL debe ser un correo válido y no puede ser el valor de ejemplo');
    }
    if (adminPassword.length < 16 || exampleValues.includes(adminPassword)) {
      throw new Error('ADMIN_PASSWORD debe tener al menos 16 caracteres y no puede ser el valor de ejemplo');
    }
    if (adminPassword.toLowerCase().includes(adminEmail.split('@')[0])) {
      throw new Error('ADMIN_PASSWORD no debe contener el nombre del correo administrativo');
    }
  }

  return {
    production,
    databaseUrl,
    adminEmail,
    adminPassword,
    port: positiveInteger(env.PORT, 'PORT', 4173),
    dbPoolMax: positiveInteger(env.DB_POOL_MAX, 'DB_POOL_MAX', 5),
  };
}

