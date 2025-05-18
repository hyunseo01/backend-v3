import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from './entities/profile.entity';
import { CreateProfileDto } from './dto/create-profile.dto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function createS3Client(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION ?? '',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    },
  });
}

@Injectable()
export class ProfileService {
  private readonly s3: S3Client;

  constructor(
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
  ) {
    this.s3 = createS3Client();
  }

  async getProfile(userId: number): Promise<Profile> {
    const profile = await this.profileRepo.findOneBy({ userId });
    if (!profile) throw new NotFoundException('프로필이 없습니다.');
    return profile;
  }

  async createProfile(userId: number, dto: CreateProfileDto): Promise<Profile> {
    const exists = await this.profileRepo.findOneBy({ userId });
    if (exists) throw new ConflictException('이미 등록된 프로필이 있습니다.');
    const profile = this.profileRepo.create({ ...dto, userId });
    return this.profileRepo.save(profile);
  }

  async updateProfile(userId: number, dto: CreateProfileDto): Promise<Profile> {
    const profile = await this.profileRepo.findOneBy({ userId });
    if (!profile) throw new NotFoundException('프로필이 없습니다.');
    Object.assign(profile, dto);
    return this.profileRepo.save(profile);
  }

  async updatePhoto(userId: number, rawFile: unknown): Promise<Profile> {
    if (
      !rawFile ||
      typeof rawFile !== 'object' ||
      !('buffer' in rawFile) ||
      !('originalname' in rawFile) ||
      !('mimetype' in rawFile)
    ) {
      throw new BadRequestException(
        '파일이 존재하지 않거나 형식이 잘못되었습니다.',
      );
    }

    const file = rawFile as {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
    };

    const timestamp = Date.now();
    const ext = file.originalname.split('.').pop() ?? 'jpg';
    const key = `profiles/${userId}-${timestamp}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET ?? '',
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }) as unknown as PutObjectCommand;

    await this.uploadToS3(command);

    const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    const profile = await this.profileRepo.findOneBy({ userId });
    if (!profile) throw new NotFoundException('프로필이 없습니다.');

    profile.photoUrl = url;
    return this.profileRepo.save(profile);
  }

  private async uploadToS3(command: PutObjectCommand): Promise<void> {
    try {
      await this.s3.send(command as unknown as PutObjectCommand);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('S3 업로드 실패:', err.message);
      } else {
        console.error('S3 업로드 실패: 알 수 없는 오류');
      }
      throw new BadRequestException('이미지 업로드 중 오류 발생');
    }
  }
}
