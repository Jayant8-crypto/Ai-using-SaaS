import { Request, Response } from 'express';
import * as Sentry from "@sentry/node";
import { prisma } from '../configs/prisma';
import { v2 as cloudinary } from 'cloudinary';
import { GenerateContentConfig, HarmBlockThreshold, HarmCategory } from '@google/genai';
import fs from 'fs';
import path from 'path';
import ai from '../configs/ai';
import axios from 'axios';

const loadImage = async (path: string, mimeType: string) => {
    return {
        inlineData: {
            data: fs.readFileSync(path).toString('base64'),
            mimeType
        }
    }
}

export const createProject = async (req: Request, res: Response) => {
    let tempProjectId = 'string';
    const {userId} = req.auth();
    let isCreditDeducted = false;

    const {name = 'New Project', aspectRatio, userPrompt, productName, 
    productDescription, targetLength = 5} = req.body;

    const images: any = req.files;

    console.log('[createProject] userId:', userId, '| images:', images?.length, '| productName:', productName);

    if(images.length < 2 || !productName){
        return res.status(400).json({ message: 'Please upload at least 2 images' })
    }

    const user = await prisma.user.findUnique({
        where: { id: userId }
    })
    
    if (!user || user.credits < 5) {
        return res.status(401).json({ message: 'Insufficient credits' })
    }
        
    try {

        // Deduct credits inside try block so catch can always refund
        await prisma.user.update({
            where: { id: userId },
            data: { credits: { decrement: 5 }}
        });
        isCreditDeducted = true;
        console.log('[createProject] Credits deducted');

        console.log('[createProject] Uploading images to Cloudinary...');
        let uploadedImages = await Promise.all(
            images.map(async(item: any) => {
                let result = await cloudinary.uploader.upload(item.path, 
                {resource_type: 'image'});
                return result.secure_url
            })
        )
        console.log('[createProject] Images uploaded:', uploadedImages.length);

        const project = await prisma.project.create({
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
        })

        tempProjectId = project.id;
        console.log('[createProject] Project created:', project.id);

        const model = 'gemini-3-pro-image-preview';

        const generationConfig: GenerateContentConfig = {
            temperature: 1,
            topP: 0.95,
            responseModalities: ['Text', 'Image'],
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.OFF },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.OFF },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.OFF },
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.OFF },
            ],
        }    
  
        // image to base64 structure for ai model
        console.log('[createProject] Loading images as base64...');
        const img1base64 = await loadImage(images[0].path, images[0].mimetype);
        const img2base64 = await loadImage(images[1].path, images[1].mimetype);

        const promptText = `Combine the person and product into a realistic photo.
        Make the person naturally hold or use the product.
        Match lighting, shadows, scale and perspective.
        Make the person stand in professional studio lighting.
        Output ecommerce-quality photo realistic imagery.
        ${userPrompt || ''}`

        console.log('[createProject] Calling Gemini API with model:', model);

        // Generate the image using the ai model (120s timeout)
        const TIMEOUT_MS = 120_000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Image generation timed out after 120 seconds')), TIMEOUT_MS)
        );
        const response: any = await Promise.race([
            ai.models.generateContent({
                model,
                contents: [{
                    role: 'user',
                    parts: [img1base64, img2base64, { text: promptText }]
                }],
                config: generationConfig,
            }),
            timeoutPromise
        ])

        console.log('[createProject] Gemini response received');

        // Check if the response is valid
        if(!response?.candidates?.[0]?.content?.parts){
            console.log('[createProject] Unexpected response:', JSON.stringify(response).slice(0, 500));
            throw new Error('Unexpected response from AI model')
        } 

        const parts = response.candidates[0].content.parts;
        console.log('[createProject] Response parts count:', parts.length);

        let finalBuffer: Buffer | null = null

        for(const part of parts){
            if(part.inlineData){
                finalBuffer = Buffer.from(part.inlineData.data, 'base64')
            }
        }

        if(!finalBuffer){
            throw new Error('Failed to generate image - no image data in response');
        }

        console.log('[createProject] Uploading generated image to Cloudinary...');
        const base64Image = `data:image/png;base64,${finalBuffer.toString('base64')}`

        const uploadResult = await cloudinary.uploader.upload(base64Image, {resource_type: 'image'});
        console.log('[createProject] Generated image uploaded:', uploadResult.secure_url);

        await prisma.project.update({
            where: {id: project.id},
            data: {
                generatedImage: uploadResult.secure_url,
                isGenerating: false
            }
        })
        
        console.log('[createProject] Done! Returning projectId:', project.id);
        res.json({projectId: project.id})

    } catch (error: any) {
        if(tempProjectId){
            try {
                await prisma.project.update({
                    where: {id: tempProjectId},
                    data: {isGenerating: false, error: error.message}
                })
            } catch(e) {}
        }

        if(isCreditDeducted){
            try {
                await prisma.user.update({
                    where: { id: userId },
                    data: { credits: { increment: 5 }}
                })
            } catch(e) {}
        }
        Sentry.captureException(error);
        if(!res.headersSent) res.status(500).json({ message: error.message });
    }
}
 
export const createVideo = async (req: Request, res: Response) => {
    console.log('[createVideo] called with body:', JSON.stringify(req.body))
    const {userId} = req.auth();
    const {projectId} = req.body;
    let isCreditDeducted = false;

    const user = await prisma.user.findUnique({
        where: { id: userId }
    })

    if (!user || user.credits < 10) {
        return res.status(401).json({ message: 'Insufficient credits' })
    }

    try {
        const project = await prisma.project.findFirst({
            where: { id: projectId, userId },
            include: {user: true}
        })

        if(!project){
            return res.status(404).json({ message: 'Project not found' });
        }

        // If video already exists, return it immediately (no re-generation needed)
        if(project.generatedVideo && project.generatedVideo.length > 10){
            console.log('Video already exists, returning existing URL:', project.generatedVideo);
            return res.json({ 
                message: 'Video already generated',
                videoUrl: project.generatedVideo 
            });
        }

        // Block if no source image yet
        if(!project.generatedImage){
            return res.status(400).json({ message: 'Generate an image first before creating a video.' });
        }

        // Deduct credits only after all validation passes
        await prisma.user.update({
            where: { id: user.id },
            data: { credits: { decrement: 10 }}
        });
        isCreditDeducted = true;

        await prisma.project.update({
            where: { id: projectId },
            data: { isGenerating: true }
        })

        const prompt = `make the person showcase the product which is ${project.
        productName} ${project.productDescription && `and Product Description: $
        {project.productDescription}`}`

        const model = 'veo-2.0-generate-001'

        // sanity-check (already checked above, but just in case)
        if(!project.generatedImage){
            throw new Error('Generated image not found');
        }

        const image = await axios.get(project.generatedImage, {responseType: 
        'arraybuffer'})

        const imageBytes: any = Buffer.from(image.data)

        const TIMEOUT_MS = 180_000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Video generation timed out after 3 minutes')), TIMEOUT_MS)
        );

        const generateVideoTask = async () => {
            let operation: any = await ai.models.generateVideos({
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
                operation = await ai.operations.getVideosOperation({
                    operation: operation,
                });
            }
            return operation;
        };

        const operation: any = await Promise.race([generateVideoTask(), timeoutPromise]);

        const filename = `${userId}-${Date.now()}.mp4`;
        const filePath = path.join('video', filename)

        // Create the images directory if it doesn't exist
        fs.mkdirSync('video', { recursive: true })

        if(!operation.response.generatedVideos){
            throw new Error('operation.response.raiMediaFilteredReasons[0]');
        }
    

        // Download the video
        await ai.files.download({
            file: operation.response.generatedVideos[0].video,
            downloadPath: filePath,
        })

        const uploadResult = await cloudinary.uploader.upload(filePath, { 
        resource_type: 'video'});

        await prisma.project.update({
            where: {id: projectId},
            data: {
                generatedVideo: uploadResult.secure_url,
                isGenerating: false
            }
        })

        // Remove video file from disk after upload
        fs.unlinkSync(filePath);
        res.json({message: 'Video generated completed', videoUrl: uploadResult.secure_url})



    } catch (error: any) {
        try {
            // Remove userId from where clause as it's not uniquely indexed
            await prisma.project.update({
                where: { id: projectId },
                data: { isGenerating: false, error: error.message || 'Video generation failed' }
            })
        } catch(e) { }

        if(isCreditDeducted){
            try {
                // add credits back
                await prisma.user.update({
                    where: { id: userId },
                    data: { credits: { increment: 10}}
                })
            } catch(e) { }
        }
        Sentry.captureException(error);
        if(!res.headersSent) {
            res.status(500).json({ message: error.message });
        }
    }
}

export const getAllPublishedProjects = async (req: Request, res: Response) => {
    try {
        const projects = await prisma.project.findMany({
            where: { isPublished: true },
        })
        res.json(projects);

    } catch (error: any) {
        Sentry.captureException(error);
        res.status(500).json({ message: error.message });
    }
}

export const deleteProject = async (req: Request, res: Response) => {
    try {
        const {userId} = req.auth();
        const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;

        const project = await prisma.project.findFirst({
            where: {id: projectId, userId }
        })
        if(!project){
            return res.status(404).json({ message: 'Project not found' });
        }
        await prisma.project.delete({
            where: { id: projectId }
        })
        res.json({ message: 'Project deleted' });

    } catch (error: any) {
        Sentry.captureException(error);
        res.status(500).json({ message: error.message });
    }
}