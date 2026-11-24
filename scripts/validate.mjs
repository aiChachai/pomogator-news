import { fileURLToPath } from 'node:url';
import { readNews } from './news-validation.mjs';

const entries = readNews(fileURLToPath(new URL('../news/', import.meta.url)));
console.log(`Validated ${entries.length} news entries`);
