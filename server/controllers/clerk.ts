import { verifyWebhook } from '@clerk/express/webhooks';
import { Request, Response } from 'express';
import { prisma } from '../configs/prisma.js';
import * as Sentry from "@sentry/node";

const clerkWebhooks = async (req: Request, res: Response) => {
  try {
    const evt: any = await verifyWebhook(req);
    const { data, type } = evt;

    switch (type) {

      case "user.created": {
        await prisma.user.create({
          data: {
            id: data.id,
            email: data?.email_addresses[0]?.email_address,
            name: data?.first_name + " " + data?.last_name,
            image: data?.profile_image_url,
          }
        });
        break;
      }

      case "user.updated": {
        await prisma.user.update({
          where: { id: data.id },
          data: {
            email: data?.email_addresses[0]?.email_address,
            name: data?.first_name + " " + data?.last_name,
            image: data?.profile_image_url,
          }
        });
        break;
      }

      case "user.deleted": {
        await prisma.user.delete({
          where: { id: data.id }
        });
        break;
      }

      case "subscription.updated": {
        const credits: Record<string, number> = {
          "free_user": 20,
          "pro": 80,
          "premium": 300
        };

        const clerkUserId = data?.payer?.user_id;
        const activeItem = data?.items?.find((item: any) => item.status === "upcoming")
                        || data?.items?.find((item: any) => item.status === "active");
        const planId = activeItem?.plan?.slug;

        if (!planId || !(planId in credits)) break;

        await prisma.user.update({
          where: { id: clerkUserId },
          data: {
            plan: planId,
            credits: { increment: credits[planId] }
          }
        });
        break;
      }

      default:
        break;
    }

    res.json({ message: "Webhook received : " + type });

  } catch (error: any) {
    Sentry.captureException(error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ message: errorMessage });
  }
};

export default clerkWebhooks;