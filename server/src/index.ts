import express from 'express';
import cors from 'cors';
import portfolioRoutes from './routes/portfolios.js';
import transactionRoutes from './routes/transactions.js';
import marketRoutes from './routes/market.js';
import performanceRoutes from './routes/performance.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/portfolios', portfolioRoutes);
app.use('/api', transactionRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/performance', performanceRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
