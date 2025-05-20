import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from './entities/profile.entity';
import { User } from '../users/entities/users.entity';
import { Trainer } from '../trainer/entities/trainer.entity';
import { ProfileInfoDto } from './dto/profile-info.dto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

//임시 기본 프로필이미지 저작권떔에 추후 직접 만들어서 사용
const DEFAULT_PROFILE_IMAGE =
  'https://i.pinimg.com/236x/f4/4c/b9/f44cb9b5f64a60d95b78b3187f459ccd.jpg';

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
    private readonly profileRepository: Repository<Profile>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Trainer)
    private readonly trainerRepository: Repository<Trainer>,
  ) {
    this.s3 = createS3Client();
  }

  //유저 홈 정보
  async getUserHome(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId, isDeleted: false },
    });
    if (!user) throw new NotFoundException('유저가 존재하지 않습니다.');

    const profile = await this.profileRepository.findOne({ where: { userId } });

    const createdAt = user.account.createdAt;
    const today = new Date();
    const joinedDays = Math.floor(
      (today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      name: user.account.name,
      height: profile?.height ?? null,
      weight: profile?.weight ?? null,
      photoUrl: profile?.photoUrl ?? DEFAULT_PROFILE_IMAGE,
      ptCount: user.ptCount,
      joinedDays,
    };
  }

  //프로필 테이블 조회
  async getProfileInfo(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId, isDeleted: false },
      relations: ['account'],
    });
    if (!user) throw new NotFoundException('유저가 존재하지 않습니다.');

    const profile = await this.profileRepository.findOne({ where: { userId } });

    return {
      name: user.account.name,
      age: profile?.age ?? null,
      gender: profile?.gender ?? null,
      height: profile?.height ?? null,
      weight: profile?.weight ?? null,
      memo: profile?.memo ?? null,
    };
  }

  //프로필 최초 생성
  async createProfile(userId: number, dto: ProfileInfoDto): Promise<Profile> {
    const exists = await this.profileRepository.findOneBy({ userId });
    if (exists) throw new ConflictException('이미 등록된 프로필이 있습니다.');
    const profile = this.profileRepository.create({ ...dto, userId });
    return this.profileRepository.save(profile);
  }

  //이름, 키, 몸무게 수정
  async updateProfile(userId: number, dto: ProfileInfoDto): Promise<Profile> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isDeleted: false },
      relations: ['account'],
    });
    if (!user) throw new NotFoundException('유저가 존재하지 않습니다.');

    if (dto.name) {
      user.account.name = dto.name;
      await this.userRepository.save(user);
    }

    const profile = await this.profileRepository.findOneBy({ userId });
    if (!profile) throw new NotFoundException('프로필이 없습니다.');

    Object.assign(profile, dto);
    return this.profileRepository.save(profile);
  }

  //사진 업로드 또는 삭제
  async updatePhoto(userId: number, rawFile: unknown): Promise<Profile> {
    const profile = await this.profileRepository.findOneBy({ userId });
    if (!profile) throw new NotFoundException('프로필이 없습니다.');

    if (!rawFile) {
      profile.photoUrl = null;
      return this.profileRepository.save(profile);
    }

    if (
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
    });

    await this.uploadToS3(command);

    const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    profile.photoUrl = url;
    return this.profileRepository.save(profile);
  }

  //트레이너 간단 정보 (기본 이미지 사용)
  async getTrainerInfo(trainerId: number) {
    const trainer = await this.trainerRepository.findOne({
      where: { id: trainerId },
      relations: ['account'],
    });
    if (!trainer) throw new NotFoundException('트레이너가 존재하지 않습니다.');

    return {
      name: trainer.account.name,
      photoUrl: DEFAULT_PROFILE_IMAGE,
    };
  }

  private async uploadToS3(command: PutObjectCommand): Promise<void> {
    try {
      await this.s3.send(command);
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
