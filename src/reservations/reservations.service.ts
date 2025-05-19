import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Reservation } from './entities/reservation.entity';
import { Repository } from 'typeorm';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { Schedule } from '../schedules/entities/schedules.entity';
import { User } from '../users/entities/users.entity';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateReservationDto, accountId: number): Promise<void> {
    const { date, time } = dto;
    const fullTime = time + ':00';

    //accountId -> user 엔티티 조회
    const user = await this.userRepository.findOne({
      where: { accountId },
    });

    if (!user) {
      throw new NotFoundException('유저 정보가 없습니다.');
    }

    const trainerId = user.trainerId;
    if (!trainerId) {
      throw new BadRequestException('트레이너가 배정되지 않았습니다.');
    }

    //Schedule 조회 or 생성
    let schedule = await this.scheduleRepository.findOne({
      where: { trainerId, date: new Date(date), startTime: fullTime },
    });

    if (!schedule) {
      schedule = this.scheduleRepository.create({
        trainerId,
        date: new Date(date),
        startTime: fullTime,
      });
      await this.scheduleRepository.save(schedule);
    }

    //중복 확인
    const existing = await this.reservationRepository.findOne({
      where: { scheduleId: schedule.id, userId: user.id },
    });

    if (existing) {
      throw new ConflictException('이미 예약이 존재합니다.');
    }

    //예약 저장
    const reservation = this.reservationRepository.create({
      scheduleId: schedule.id,
      userId: user.id,
      status: 'confirmed',
    });

    await this.reservationRepository.save(reservation);
  }
}
