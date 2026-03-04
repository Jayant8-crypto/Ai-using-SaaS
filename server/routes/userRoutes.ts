import express from 'express';
import { getAllProjects, getProjectById, getUserCredits, toggleProjectPublic } from '../controllers/userController';
import { protect } from '../middlewares/auth';

const userRouter = express.Router();    

userRouter.get('/credits', protect, getUserCredits)
userRouter.get('/projects', protect, getAllProjects)
userRouter.get('/projects/:projectId', protect, getProjectById)
userRouter.get('/publish/:projectId', protect, toggleProjectPublic)

export default userRouter;