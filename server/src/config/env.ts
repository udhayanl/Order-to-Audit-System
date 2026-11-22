import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('5000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters for cryptographic safety'),
  CLIENT_ORIGIN: z.string().default('*'),
});

export const validateEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Environment configuration validation failed:');
    result.error.errors.forEach((err) => {
      console.error(`   - ${err.path.join('.')}: ${err.message}`);
    });
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
  return result.success ? result.data : null;
};

export const env = validateEnv() || {
  NODE_ENV: (process.env.NODE_ENV as any) || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'factoryflow_super_secret_jwt_key_2026_nit_trichy',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || '*',
};

export default env;
