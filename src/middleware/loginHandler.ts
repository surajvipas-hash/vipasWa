import fs from 'fs/promises';
import path from 'path';
import { Request, Response } from 'express';
import { asyncHandler, CustomError } from './errorHandler';
import logger from '../utils/logger';
import { SESSIONS_DIR, BASE_DIR } from '../utils/paths';

const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const device = (req as any).device;
  const proxyResponse = (req as any).proxyResponse;

  if (!device || !proxyResponse) {
    throw new CustomError(
      'Device or proxy response not found',
      500,
      'INVALID_MIDDLEWARE_STATE'
    );
  }

  const deviceHash = device.deviceHash;
  const responseData = proxyResponse.data;

  try {
    const qrLink = responseData?.results?.qr_link;

    if (qrLink && qrLink.includes('/statics/')) {
      const qrFileName = path.basename(new URL(qrLink).pathname);

      logger.info(`QR code detected for device ${deviceHash}`);

      // Possible QR image locations
      const qrPaths = [
        path.join(SESSIONS_DIR, deviceHash, 'statics', 'images', 'qrcode', qrFileName),
        path.join(BASE_DIR, 'statics', 'images', 'qrcode', qrFileName),
        path.join(BASE_DIR, 'statics', 'qrcode', qrFileName),
        path.join(process.cwd(), 'statics', 'images', 'qrcode', qrFileName)
      ];

      await new Promise(resolve => setTimeout(resolve, 1000));

      let qrBuffer: Buffer | null = null;

      for (const qrPath of [...new Set(qrPaths)]) {
        try {
          qrBuffer = await fs.readFile(qrPath);
          logger.info(`QR image found: ${qrPath}`);
          break;
        } catch {
          logger.debug(`QR image not found: ${qrPath}`);
        }
      }

      if (qrBuffer) {
        responseData.results.qr_code =
          `data:image/png;base64,${qrBuffer.toString('base64')}`;

        delete responseData.results.qr_link;

        logger.info(`QR image converted to Base64 for ${deviceHash}`);
      } else {
        logger.warn(`QR image file not found for device ${deviceHash}`);
      }
    }

    res.status(proxyResponse.status).json(responseData);

  } catch (error) {
    logger.error(`QR processing failed for ${deviceHash}:`, error);
    res.status(proxyResponse.status).json(proxyResponse.data);
  }
});

export default loginHandler;