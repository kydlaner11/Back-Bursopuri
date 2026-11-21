
const dotenv = require('dotenv');
const path = require('path');

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = ['prod', 'production'].includes(nodeEnv);

// Di production, gunakan environment variables dari platform hosting.
// Di development, muat file .env lokal.
if (!isProduction) {
  const envFile = path.resolve(
    process.cwd(),
    `.env.${nodeEnv === 'development' ? 'dev' : nodeEnv}`
  );

  dotenv.config({ path: envFile });

  // Fallback jika file .env.<environment> tidak tersedia.
  if (!process.env.JWT_SECRET) {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  }
}

const requiredVariables = [
  'JWT_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    throw new Error(`Missing required environment variable: ${variable}`);
  }
}

module.exports = {
  PORT: process.env.PORT || 3002,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_TTL: process.env.JWT_TTL || '1d',
  NODE_ENV: isProduction ? 'production' : nodeEnv,
};
