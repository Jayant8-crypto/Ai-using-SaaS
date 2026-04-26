import './configs/instrument.mjs';
import 'dotenv/config'
import express, { Request, Response } from 'express';
import cors from 'cors'
import { clerkMiddleware } from '@clerk/express'
import clerkWebhooks from './controllers/clerk';
import * as Sentry from "@sentry/node";
import userRouter from './routes/userRoutes';
import projectRouter from './routes/projectRoutes';

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

//Middleware
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}))

app.post('/api/clerk', express.raw({ type: 'application/json' }), clerkWebhooks);

app.use(express.json())
app.use(clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
}))

app.get('/', (req: Request, res: Response) => { res.send('Server is Live!'); });
app.use('/api/user', userRouter)
app.use('/api/project', projectRouter)

Sentry.setupExpressErrorHandler(app);

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});