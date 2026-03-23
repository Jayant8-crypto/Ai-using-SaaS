"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const projectController_1 = require("../controllers/projectController");
const auth_1 = require("../middlewares/auth");
const multer_1 = __importDefault(require("../configs/multer"));
const projectRouter = express_1.default.Router();
projectRouter.post('/create', multer_1.default.array('images', 2), auth_1.protect, projectController_1.createProject);
projectRouter.post('/video', auth_1.protect, projectController_1.createVideo);
projectRouter.get('/published', projectController_1.getAllPublishedProjects);
projectRouter.delete('/:projectId', auth_1.protect, projectController_1.deleteProject);
exports.default = projectRouter;
