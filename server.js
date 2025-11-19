import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Load API endpoints
const loadApiEndpoint = async (path) => {
  try {
    const module = await import(join(__dirname, 'api', path));
    return module.default;
  } catch (error) {
    console.error(`Failed to load API endpoint ${path}:`, error);
    return (req, res) => res.status(500).json({ error: 'Internal server error' });
  }
};

// API routes
app.all('/api/inschrijvingen', async (req, res) => {
  const handler = await loadApiEndpoint('inschrijvingen.js');
  return handler(req, res);
});

app.all('/api/contact', async (req, res) => {
  const handler = await loadApiEndpoint('contact.js');
  return handler(req, res);
});

app.all('/api/notifyOrganisator', async (req, res) => {
  const handler = await loadApiEndpoint('notifyOrganisator.js');
  return handler(req, res);
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});