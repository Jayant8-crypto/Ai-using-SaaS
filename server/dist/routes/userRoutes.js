"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middlewares/auth");
const userRouter = express_1.default.Router();
userRouter.get('/credits', auth_1.protect, userController_1.getUserCredits);
userRouter.get('/projects', auth_1.protect, userController_1.getAllProjects);
userRouter.get('/projects/:projectId', auth_1.protect, userController_1.getProjectById);
userRouter.get('/publish/:projectId', auth_1.protect, userController_1.toggleProjectPublic);
exports.default = userRouter;
