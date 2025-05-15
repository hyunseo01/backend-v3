import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from './entities/chats.entity';
import { Trainer } from '../trainer/entities/trainer.entity';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { Message } from '../messages/entities/messages.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Chat, Trainer, Message])],
  controllers: [ChatsController],
  providers: [ChatsService],
})
export class ChatsModule {}
