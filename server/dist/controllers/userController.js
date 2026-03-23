"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleProjectPublic = exports.getProjectById = exports.getAllProjects = exports.getUserCredits = void 0;
const Sentry = __importStar(require("@sentry/node"));
const prisma_1 = require("../configs/prisma");
// Get User Credits
const getUserCredits = async (req, res) => {
    try {
        const { userId } = req.auth();
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId }
        });
        res.json({ credits: user?.credits });
    }
    catch (error) {
        Sentry.captureException(error);
        res.status(500).json({ message: error.code || error.message });
    }
};
exports.getUserCredits = getUserCredits;
// const get all user projects
const getAllProjects = async (req, res) => {
    try {
        const { userId } = req.auth();
        const projects = await prisma_1.prisma.project.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ projects });
    }
    catch (error) {
        Sentry.captureException(error);
        res.status(500).json({ message: error.code || error.message });
    }
};
exports.getAllProjects = getAllProjects;
// get project by id
const getProjectById = async (req, res) => {
    try {
        const { userId } = req.auth();
        const projectId = req.params.projectId;
        const project = await prisma_1.prisma.project.findFirst({
            where: { id: projectId, userId }
        });
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        res.json({ project });
    }
    catch (error) {
        Sentry.captureException(error);
        res.status(500).json({ message: error.code || error.message });
    }
};
exports.getProjectById = getProjectById;
// publish / unpublish project
const toggleProjectPublic = async (req, res) => {
    try {
        const { userId } = req.auth();
        const projectId = req.params.projectId;
        const project = await prisma_1.prisma.project.findFirst({
            where: { id: projectId, userId }
        });
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        if (!project?.generatedImage && !project?.generatedVideo) {
            return res.status(404).json({ message: 'image or video not generated' });
        }
        await prisma_1.prisma.project.update({
            where: { id: projectId },
            data: { isPublished: !project.isPublished }
        });
        res.json({ isPublished: !project.isPublished });
    }
    catch (error) {
        Sentry.captureException(error);
        res.status(500).json({ message: error.code || error.message });
    }
};
exports.toggleProjectPublic = toggleProjectPublic;
