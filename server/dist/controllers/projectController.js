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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProject = exports.getAllPublishedProjects = exports.createVideo = exports.createProject = void 0;
const Sentry = __importStar(require("@sentry/node"));
const prisma_1 = require("../configs/prisma");
const cloudinary_1 = require("cloudinary");
const genai_1 = require("@google/genai");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ai_1 = __importDefault(require("../configs/ai"));
const axios_1 = __importDefault(require("axios"));
const loadImage = async (path, mimetype) => {
    return {
        inlineData: {
            data: fs_1.default.readFileSync(path).toString('base64'),
            mimetype
        }
    };
};
const createProject = async (req, res) => {
    let tempProjectId = 'string';
    const { userId } = req.auth();
    let isCreditDeducted = false;
    const { name = 'New Project', aspectRatio, userPrompt, productName, productDescription, targetLength = 5 } = req.body;
    const images = req.files;
    if (images.length < 2 || !productName) {
        return res.status(400).json({ message: 'Please upload at least 2 images' });
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId }
    });
    if (!user || user.credits < 5) {
        return res.status(401).json({ message: 'Insufficient credits' });
    }
    else {
        // Deduct credits
        await prisma_1.prisma.user.update({
            where: { id: userId },
            data: { credits: { decrement: 5 } }
        }).then(() => { isCreditDeducted = true; });
    }
    try {
        let uploadedImages = await Promise.all(images.map(async (item) => {
            let result = await cloudinary_1.v2.uploader.upload(item.path, { resource_type: 'image' });
            return result.secure_url;
        }));
        const project = await prisma_1.prisma.project.create({
            data: {
                name,
                userId,
                productName,
                productDescription,
                userPrompt,
                aspectRatio,
                targetLength: parseInt(targetLength),
                uploadedImages,
                isGenerating: true
            }
        });
        tempProjectId = project.id;
        const model = 'gemini-3-pro-image-preview';
        const generationConfig = {
            maxOutputTokens: 32768,
            temperature: 1,
            topP: 0.95,
            responseModalities: ['IMAGE'],
            imageConfig: {
                aspectRatio: aspectRatio || '9:16',
                imageSize: '1K',
            },
            safetySettings: [
                {
                    category: genai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: genai_1.HarmBlockThreshold.OFF,
                },
                {
                    category: genai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: genai_1.HarmBlockThreshold.OFF,
                },
                {
                    category: genai_1.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: genai_1.HarmBlockThreshold.OFF,
                },
                {
                    category: genai_1.HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: genai_1.HarmBlockThreshold.OFF,
                },
            ],
        };
        // image to base64 structure for ai model
        const img1base64 = await loadImage(images[0].path, images[0].mimetype);
        const img2base64 = await loadImage(images[1].path, images[1].mimetype);
        const prompt = {
            text: `Combine the person and product into a realistic photo.
        Make the person naturally hold or use the product.
        Match lighting, shadows, scale and perspective.
        Make the person stand in professional studio lighting.
        Output ecommerce-quality photo realistic imagery.
        ${userPrompt}`
        };
        // Generate the image using the ai model
        const response = await ai_1.default.models.generateContent({
            model,
            contents: [img1base64, img2base64, prompt],
            config: generationConfig,
        });
        // Check if the response is valid
        if (!response?.candidates?.[0]?.content?.parts) {
            throw new Error('Unexpected response');
        }
        const parts = response.candidates[0].content.parts;
        let finalBuffer = null;
        for (const part of parts) {
            if (part.inlineData) {
                finalBuffer = Buffer.from(part.inlineData.data, 'base64');
            }
        }
        if (!finalBuffer) {
            throw new Error('Failed to generate image');
        }
        const base64Image = `data:image/png;base64,${finalBuffer.toString('base64')}`;
        const uploadResult = await cloudinary_1.v2.uploader.upload(base64Image, { resource_type: 'image' });
        await prisma_1.prisma.project.update({
            where: { id: project.id },
            data: {
                generatedImage: uploadResult.secure_url,
                isGenerating: false
            }
        });
        res.json({ projectId: project.id });
    }
    catch (error) {
        if (tempProjectId) {
            await prisma_1.prisma.project.update({
                where: { id: tempProjectId },
                data: { isGenerating: false, error: error.message }
            });
        }
        if (isCreditDeducted) {
            // add credits back
            await prisma_1.prisma.user.update({
                where: { id: userId },
                data: { credits: { increment: 5 } }
            });
        }
        Sentry.captureException(error);
        res.status(500).json({ message: error.message });
    }
};
exports.createProject = createProject;
const createVideo = async (req, res) => {
    console.log('[createVideo] called body:', JSON.stringify(req.body));
    const { userId } = req.auth();
    const { projectId } = req.body;
    let isCreditDeducted = false;
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId }
    });
    if (!user || user.credits < 10) {
        return res.status(401).json({ message: 'Insufficient credits' });
    }
    try {
        const project = await prisma_1.prisma.project.findFirst({
            where: { id: projectId, userId },
            include: { user: true }
        });
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        // If video already exists, return it immediately
        if (project.generatedVideo && project.generatedVideo.length > 10) {
            console.log('[createVideo] video already exists:', project.generatedVideo);
            return res.json({ message: 'Video already generated', videoUrl: project.generatedVideo });
        }
        // Block if no source image yet
        if (!project.generatedImage) {
            return res.status(400).json({ message: 'Generate an image first before creating a video.' });
        }
        // Deduct credits only after all validation passes
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: { credits: { decrement: 10 } }
        });
        isCreditDeducted = true;
        await prisma_1.prisma.project.update({
            where: { id: projectId },
            data: { isGenerating: true }
        });
        const prompt = `make the person showcase the product which is ${project.productName} ${project.productDescription && `and Product Description: ${project.productDescription}`}`;
        const model = 'gemini-3-pro-video-preview';
        const image = await axios_1.default.get(project.generatedImage, { responseType: 'arraybuffer' });
        const imageBytes = Buffer.from(image.data);
        const TIMEOUT_MS = 180000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Video generation timed out after 3 minutes')), TIMEOUT_MS)
        );
        const generateVideoTask = async () => {
            let operation = await ai_1.default.models.generateVideos({
                model,
                prompt,
                image: {
                    imageBytes: imageBytes.toString('base64'),
                    mimeType: 'image/png'
                },
                config: {
                    aspectRatio: project.aspectRatio || '9:16',
                    numberOfVideos: 1,
                    resolution: '720p',
                }
            });
            while (!operation.done) {
                console.log('Waiting for video generation to complete...');
                await new Promise((resolve) => setTimeout(resolve, 10000));
                operation = await ai_1.default.operations.getVideosOperation({ operation });
            }
            return operation;
        };
        const operation = await Promise.race([generateVideoTask(), timeoutPromise]);
        const filename = `${userId}-${Date.now()}.mp4`;
        const filePath = path_1.default.join('video', filename);
        fs_1.default.mkdirSync('video', { recursive: true });
        if (!operation.response.generatedVideos) {
            throw new Error('Video generation failed - content filtered');
        }
        await ai_1.default.files.download({
            file: operation.response.generatedVideos[0].video,
            downloadPath: filePath,
        });
        const uploadResult = await cloudinary_1.v2.uploader.upload(filePath, { resource_type: 'video' });
        await prisma_1.prisma.project.update({
            where: { id: projectId },
            data: { generatedVideo: uploadResult.secure_url, isGenerating: false }
        });
        fs_1.default.unlinkSync(filePath);
        res.json({ message: 'Video generated completed', videoUrl: uploadResult.secure_url });
    }
    catch (error) {
        console.error('[createVideo] error:', error.message);
        try {
            await prisma_1.prisma.project.update({
                where: { id: projectId },
                data: { isGenerating: false, error: error.message }
            });
        } catch(e) {}
        if (isCreditDeducted) {
            try {
                await prisma_1.prisma.user.update({
                    where: { id: userId },
                    data: { credits: { increment: 10 } }
                });
            } catch(e) {}
        }
        Sentry.captureException(error);
        if (!res.headersSent) res.status(500).json({ message: error.message });
    }
};
exports.createVideo = createVideo;
const getAllPublishedProjects = async (req, res) => {
    try {
        const projects = await prisma_1.prisma.project.findMany({
            where: { isPublished: true },
        });
        res.json(projects);
    }
    catch (error) {
        Sentry.captureException(error);
        res.status(500).json({ message: error.message });
    }
};
exports.getAllPublishedProjects = getAllPublishedProjects;
const deleteProject = async (req, res) => {
    try {
        const { userId } = req.auth();
        const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
        const project = await prisma_1.prisma.project.findUnique({
            where: { id: projectId, userId }
        });
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        await prisma_1.prisma.project.delete({
            where: { id: projectId }
        });
        res.json({ message: 'Project deleted' });
    }
    catch (error) {
        Sentry.captureException(error);
        res.status(500).json({ message: error.message });
    }
};
exports.deleteProject = deleteProject;
