import 'dotenv/config';
import { prisma } from './configs/prisma.js';

async function main() {
    try {
        const project = await prisma.project.findUnique({
            where: { id: 'test', userId: 'test' }
        });
        console.log('Success');
    } catch(e: any) {
        console.log('Error:', e.message);
    }
}
main().catch(console.error).finally(() => process.exit(0));
