import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import portfolioRoutes from './routes/portfolios.js';
import transactionRoutes from './routes/transactions.js';
import marketRoutes from './routes/market.js';
import performanceRoutes from './routes/performance.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());

app.use('/api/portfolios', portfolioRoutes);
app.use('/api', transactionRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/performance', performanceRoutes);

if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.join(__dirname, '../../dist');
  app.use(express.static(distPath));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
