import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Reservation } from './entities/reservation.entity';
import { DataSource, Repository } from 'typeorm';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { Schedule } from '../schedules/entities/schedules.entity';
import { User } from '../users/entities/users.entity';
import { Account } from '../account/entities/account.entity';
import {
  GetMyReservationsResponseDto,
  ReservationInfoDto,
} from './dto/get-my-reservations-response.dto';
import { TrainerReservationDto } from './dto/get-trainer-reservations-response.dto';
import { Trainer } from '../trainer/entities/trainer.entity';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Trainer)
    private readonly trainerRepository: Repository<Trainer>,
  ) {}

  async createReservation(
    dto: CreateReservationDto,
    accountId: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const scheduleRepo = manager.getRepository(Schedule);
      const reservationRepo = manager.getRepository(Reservation);

      const user = await userRepo.findOne({ where: { accountId } });
      if (!user) throw new NotFoundException('유저 정보가 없습니다.');
      if (!user.trainerId)
        throw new BadRequestException('트레이너가 배정되지 않았습니다.');
      if (user.ptCount <= 0)
        throw new BadRequestException('보유한 PT권이 없습니다.');

      const fullTime = dto.time + ':00';

      let schedule = await scheduleRepo.findOne({
        where: {
          trainerId: user.trainerId,
          date: new Date(dto.date),
          startTime: fullTime,
        },
      });

      if (!schedule) {
        schedule = scheduleRepo.create({
          trainerId: user.trainerId,
          date: new Date(dto.date),
          startTime: fullTime,
        });
        await scheduleRepo.save(schedule);
      }

      const existing = await reservationRepo.findOne({
        where: { scheduleId: schedule.id, userId: user.id },
      });

      if (existing) throw new ConflictException('이미 예약이 존재합니다.');

      const reservation = reservationRepo.create({
        scheduleId: schedule.id,
        userId: user.id,
        status: 'confirmed',
      });

      user.ptCount -= 1;

      await reservationRepo.save(reservation);
      await userRepo.save(user);
    });
  }

  async cancelReservation(
    reservationId: number,
    userId: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const reservationRepo = manager.getRepository(Reservation);
      const userRepo = manager.getRepository(User);

      const user = await userRepo.findOneBy({ accountId: userId });
      if (!user) throw new NotFoundException('회원 정보를 찾을 수 없습니다.');

      const reservation = await reservationRepo.findOne({
        where: { id: reservationId },
        relations: ['user', 'schedule'],
      });

      if (!reservation) {
        console.error('예약이 존재하지 않습니다.');
        throw new NotFoundException('예약을 찾을 수 없습니다.');
      }

      if (!reservation.user) {
        console.error('예약에 user가 연결되어 있지 않습니다.');
        throw new BadRequestException('예약 정보에 유저 정보가 없습니다.');
      }

      if (!reservation.schedule) {
        console.error('예약에 schedule이 연결되어 있지 않습니다.');
        throw new BadRequestException('예약 정보에 스케줄 정보가 없습니다.');
      }

      console.log('예약 user.id:', reservation.user.id);
      console.log('요청자 userId:', user.id);

      if (reservation.user.id !== user.id) {
        throw new ForbiddenException('자신의 예약만 취소할 수 있습니다.');
      }

      if (reservation.status !== 'confirmed') {
        throw new BadRequestException('이미 취소되었거나 완료된 예약입니다.');
      }

      const now = new Date();
      const dateStr = String(reservation.schedule.date);
      const timeStr = reservation.schedule.startTime;
      const reservationDateTime = new Date(`${dateStr}T${timeStr}`);

      const hoursDiff =
        (reservationDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursDiff < 24) {
        throw new BadRequestException(
          '예약 24시간 이전까지만 취소가 가능합니다.',
        );
      }

      reservation.status = 'cancelled';
      reservation.user.ptCount += 1;

      await reservationRepo.save(reservation);
      await userRepo.save(reservation.user);
    });
  }

  async getMyReservations(
    accountId: number,
  ): Promise<GetMyReservationsResponseDto> {
    const user = await this.userRepository.findOneBy({ accountId });
    if (!user) throw new NotFoundException('회원 정보를 찾을 수 없습니다.');

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // 'YYYY-MM-DD'

    const reservations = await this.reservationRepository.find({
      where: {
        userId: user.id,
        status: 'confirmed',
      },
      relations: ['schedule', 'schedule.trainer'],
      order: { schedule: { date: 'ASC', startTime: 'ASC' } },
    });

    const todayList = [];
    const upcomingList = [];

    for (const res of reservations) {
      const scheduleDate = String(res.schedule.date); // 문자열 변환
      const isToday = scheduleDate === dateStr;
      const todayList: ReservationInfoDto[] = [];
      const upcomingList: ReservationInfoDto[] = [];

      const item: ReservationInfoDto = {
        reservationId: res.id,
        trainerName: res.schedule.trainer?.account?.name || '알 수 없음',
        date: String(res.schedule.date),
        time: res.schedule.startTime.slice(0, 5),
        duration: 60,
      };

      if (isToday) {
        todayList.push(item);
      } else if (scheduleDate > dateStr) {
        upcomingList.push(item);
      }
    }

    return {
      today: todayList,
      upcoming: upcomingList,
    };
  }

  async getTrainerReservations(
    accountId: number,
    date: string,
  ): Promise<TrainerReservationDto[]> {
    const trainer = await this.trainerRepository.findOneBy({ accountId });
    if (!trainer)
      throw new NotFoundException('트레이너 정보를 찾을 수 없습니다.');

    const reservations = await this.reservationRepository.find({
      where: {
        status: 'confirmed',
        schedule: {
          date: new Date(date), // 🔧 정확한 날짜 필터링
          trainerId: trainer.id,
        },
      },
      relations: ['schedule', 'user', 'user.account'],
      order: { schedule: { startTime: 'ASC' } },
    });

    return reservations.map((res) => ({
      reservationId: res.id,
      userName: res.user?.account?.name || '알 수 없음',
      time: res.schedule.startTime.slice(0, 5),
      duration: 60,
    }));
  }
}
