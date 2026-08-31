import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ScreenshotService {
  private readonly logger = new Logger(ScreenshotService.name);

  async capturePage(
    distIndexHtml: string,
    outputPath: string,
  ): Promise<string | null> {
    try {
      const playwright = await import('playwright');
      const browser = await playwright.chromium.launch({
        headless: true,
      });
      try {
        const page = await browser.newPage({
          viewport: { width: 1280, height: 1600 },
        });
        const url = `file://${distIndexHtml}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
        await new Promise((resolve) => setTimeout(resolve, 400));
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await page.screenshot({
          path: outputPath,
          type: 'jpeg',
          quality: 55,
          fullPage: true,
        });
        const stat = await fs.stat(outputPath);
        if (stat.size > 3.5 * 1024 * 1024) {
          await page.screenshot({
            path: outputPath,
            type: 'jpeg',
            quality: 40,
            fullPage: false,
          });
        }
        return outputPath;
      } finally {
        await browser.close();
      }
    } catch (error) {
      this.logger.warn(
        `Screenshot indisponível: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
