import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schedule } from '../schedules/entities/schedules.entity';
import { Reservation } from './entities/reservation.entity';
import { User } from '../users/entities/users.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Schedule, Reservation, User])],
  controllers: [ReservationsController],
  providers: [ReservationsService],
})
export class ReservationsModule {}
