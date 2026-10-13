import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  test: {
    globals: true,
    environment: 'node',
    // اختبارات القاعدة (نسخ من مرآة الإنتاج + إعادة توليد حقيقية) بتاخد ~٣٠٠ms لحالها،
    // بس تحت حمل الطقم الكامل (١٢٠٠+ اختبار بالتوازي) بتوصل لثواني — الـ٥ ثواني
    // الافتراضية كانت تفشّل اختبارات صحيحة بالتوقيت لا بالمنطق.
    testTimeout: 20_000,
    // نفس الشي لـbeforeAll يلي بينسخ القاعدة ويولّد دلوين: الـ١٠ ثواني الافتراضية كانت
    // تفشّل ملفات كاملة تحت الحمل (وتقفل نسخة القاعدة فما بتنمحي) وهي بتمرق لحالها.
    hookTimeout: 30_000,
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/_legacy/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
