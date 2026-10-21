import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Icônes PNG (Android, iOS, favicon.ico) générées depuis public/logo-assga.png :
// le logo du site assga-escalade.com, en blanc sur fond vert foncé.
// Même fond vert pour les marges ajoutées (maskable, Apple).
const background = '#005030';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background } },
    // iOS arrondit seulement les coins : une marge faible suffit.
    apple: { ...minimal2023Preset.apple, padding: 0.1, resizeOptions: { background } },
  },
  images: ['public/logo-assga.png'],
});
