import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import portfolioRoutes from './routes/portfolios.js';
import transactionRoutes from './routes/transactions.js';
import marketRoutes from './routes/market.js';
import performanceRoutes from './routes/performance.js';
import { AppError, errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());

// All API routers mount on apiRouter; its catch-all 404 must stay the last
// mount so unmatched /api routes get JSON instead of the SPA fallback.
const apiRouter = express.Router();
apiRouter.use('/portfolios', portfolioRoutes);
apiRouter.use('/', transactionRoutes);
apiRouter.use('/market', marketRoutes);
apiRouter.use('/performance', performanceRoutes);
apiRouter.use((_req, _res, next) => next(new AppError(404, 'Not found')));

app.use('/api', apiRouter);

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
