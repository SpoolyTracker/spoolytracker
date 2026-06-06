import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { resolve, extname } from 'path';
import { Response } from 'express';
import * as fs from 'fs';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.gcode': 'text/plain',
  '.stl': 'application/octet-stream',
  '.obj': 'application/octet-stream',
  '.3mf': 'application/octet-stream',
};

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  @Get('clients/:filename')
  getClientFile(@Param('filename') filename: string, @Res() res: Response) {
    const relativePath = `clients/${filename}`;
    console.log(`[UploadsController] Serving public client file: "${relativePath}"`);
    return this.serveFile(relativePath, res);
  }

  @Get(':filename')
  @UseGuards(JwtAuthGuard)
  getFile(@Param('filename') filename: string, @Res() res: Response) {
    console.log(`[UploadsController] Serving file: "${filename}"`);
    return this.serveFile(filename, res);
  }

  @Get(':subdir/:filename')
  @UseGuards(JwtAuthGuard)
  getNestedFile(
    @Param('subdir') subdir: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const relativePath = `${subdir}/${filename}`;
    console.log(`[UploadsController] Serving nested file: "${relativePath}"`);
    return this.serveFile(relativePath, res);
  }

  private serveFile(relativePath: string, res: Response) {
    const apiUploadsRoot = resolve(process.cwd(), 'uploads');
    const webUploadsRoot = resolve(
      process.cwd(),
      '..',
      'web',
      'public',
      'uploads',
    );

    const candidates: string[] = [
      resolve(apiUploadsRoot, relativePath),
      resolve(webUploadsRoot, relativePath),
    ];

    for (const candidate of candidates) {
      // Security: prevent path traversal
      if (
        !candidate.startsWith(apiUploadsRoot) &&
        !candidate.startsWith(webUploadsRoot)
      ) {
        throw new ForbiddenException('Forbidden Path');
      }
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        console.log(`[UploadsController] Found and streaming: ${candidate}`);
        const ext = extname(candidate).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', fs.statSync(candidate).size);
        const stream = fs.createReadStream(candidate);
        stream.pipe(res);
        return;
      }
    }

    console.log(`[UploadsController] NOT FOUND. Tried:`, candidates);
    throw new NotFoundException('File not found');
  }
}
