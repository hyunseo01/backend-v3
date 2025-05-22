import { BadRequestException, Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class RecordImageService {
  private readonly s3: S3Client;

  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION ?? '',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
    });
  }

  async uploadRecordImage(
    accountId: number,
    file: Express.Multer.File,
    type: 'meal' | 'exercise',
  ): Promise<string> {
    if (!file || !file.buffer || !file.originalname || !file.mimetype) {
      throw new BadRequestException(
        '파일이 존재하지 않거나 형식이 잘못되었습니다.',
      );
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException(
        '허용되지 않는 이미지 형식입니다. (jpg, png, webp만 가능)',
      );
    }

    const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSizeInBytes) {
      throw new BadRequestException('이미지 파일은 5MB를 초과할 수 없습니다.');
    }

    const ext = file.originalname.split('.').pop() ?? 'jpg';
    const key = `${type}-records/${accountId}-${Date.now()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET ?? '',
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await this.s3.send(command);

    return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }
}
