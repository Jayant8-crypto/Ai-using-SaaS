import { Request, Response, NextFunction } from 'express'
import * as Sentry from "@sentry/node";

export const protect = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = req.auth()
        console.log(`[AUTH] ${req.method} ${req.path} userId=${userId}`)

        if (!userId) {
            console.log('[AUTH] Rejected - no userId')
            return res.status(401).json({ message: 'Unauthorized' })
        }  
        next()
    } catch (error: any) {
        console.log('[AUTH] Exception:', error.message)
        Sentry.captureException(error)
        res.status(401).json({ message: error.code || error.message })
    }
}