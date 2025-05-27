import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Chat } from './entities/chats.entity';
import { Repository, DataSource } from 'typeorm';
import { ChatRoomDto } from './dto/chat-room.dto';
import { Trainer } from '../trainer/entities/trainer.entity';
import { Message } from '../messages/entities/messages.entity';
import { formatDateForChat } from '../common/utils/formatDateForChat';
import { ChatMessageDto } from './dto/chat-message.dto';
import { User } from '../users/entities/users.entity';

@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,

    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,

    @InjectRepository(Trainer)
    private readonly trainerRepository: Repository<Trainer>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly dataSource: DataSource,
  ) {}

  async saveMessage(params: {
    chatId: number;
    content: string;
    senderId: number;
    isSystem?: boolean;
  }): Promise<Message> {
    const { chatId, content, senderId, isSystem = false } = params;

    return await this.dataSource.transaction(async (manager) => {
      const chat = await manager.findOne(Chat, { where: { id: chatId } });
      if (!chat) {
        throw new NotFoundException('채팅방을 찾을 수 없습니다.');
      }

      const message = manager.create(Message, {
        chatId,
        content,
        senderId,
        isSystem,
        isRead: false,
      });

      const saved = await manager.save(Message, message);
      await manager.update(Chat, { id: chatId }, { updatedAt: new Date() });

      return saved;
    });
  }

  async markMessagesAsRead(params: {
    chatId: number;
    accountId: number;
    lastReadMessageId: number;
  }): Promise<{ affectedMessages: number }> {
    const { chatId, accountId, lastReadMessageId } = params;

    const result = await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true })
      .where('chatId = :chatId', { chatId })
      .andWhere('senderId != :accountId', { accountId })
      .andWhere('id <= :lastReadMessageId', { lastReadMessageId })
      .andWhere('isRead = false')
      .execute();

    return { affectedMessages: result.affected || 0 };
  }

  async getChatWithUsers(chatId: number): Promise<Chat> {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['user', 'user.account', 'trainer', 'trainer.account'],
      cache: true,
    });

    if (!chat) {
      throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    }

    return chat;
  }

  async getChatRoomsForTrainer(accountId: number): Promise<ChatRoomDto[]> {
    const trainer = await this.trainerRepository.findOne({
      where: { accountId },
      cache: true,
    });

    if (!trainer) {
      throw new NotFoundException('트레이너 정보를 찾을 수 없습니다.');
    }

    const chatRooms = await this.chatRepository
      .createQueryBuilder('chat')
      .select(['chat.id', 'user.id', 'account.id', 'account.name'])
      .leftJoin('chat.user', 'user')
      .leftJoin('user.account', 'account')
      .where('chat.trainerId = :trainerId', { trainerId: trainer.id })
      .orderBy('chat.updatedAt', 'DESC')
      .getMany();

    const chatIds = chatRooms.map((chat) => chat.id);
    if (chatIds.length === 0) return [];

    const raw = await this.messageRepository
      .createQueryBuilder('message')
      .select('message.chatId', 'chatId')
      .addSelect('MAX(message.id)', 'lastMessageId')
      .where('message.chatId IN (:...chatIds)', { chatIds })
      .groupBy('message.chatId')
      .getRawMany();

    const lastMessagesQuery = raw as {
      chatId: number;
      lastMessageId: number;
    }[];

    const lastMessageIds = lastMessagesQuery.map((row) => row.lastMessageId);

    if (lastMessageIds.length === 0) {
      return chatRooms.map((chat) => ({
        chatId: chat.id,
        userId: chat.user?.id ?? 0,
        userName: chat.user?.account?.name ?? '알 수 없음',
        lastMessage: null,
        lastMessageAt: null,
        unreadCount: 0,
      }));
    }

    const lastMessages = await this.messageRepository
      .createQueryBuilder('message')
      .select([
        'message.id',
        'message.chatId',
        'message.content',
        'message.createdAt',
      ])
      .where('message.id IN (:...lastMessageIds)', { lastMessageIds })
      .getMany();

    const rawUnreadCounts = await this.messageRepository
      .createQueryBuilder('message')
      .select('message.chatId', 'chatId')
      .addSelect('COUNT(*)', 'unreadCount')
      .where('message.chatId IN (:...chatIds)', { chatIds })
      .andWhere('message.isRead = false')
      .andWhere('message.senderId != :accountId', { accountId })
      .groupBy('message.chatId')
      .getRawMany();

    const unreadCountsQuery = rawUnreadCounts as {
      chatId: string;
      unreadCount: string;
    }[];

    return chatRooms.map((chat) => {
      const lastMessage = lastMessages.find((msg) => msg.chatId === chat.id);
      const unreadItem = unreadCountsQuery.find(
        (item) => Number(item.chatId) === chat.id,
      );

      return {
        chatId: chat.id,
        userId: chat.user?.id ?? 0,
        userName: chat.user?.account?.name ?? '알 수 없음',
        lastMessage: lastMessage?.content ?? null,
        lastMessageAt: lastMessage
          ? formatDateForChat(lastMessage.createdAt)
          : null,
        unreadCount: unreadItem ? Number(unreadItem.unreadCount) : 0,
      };
    });
  }

  async getChatRoomForUser(accountId: number) {
    const user = await this.userRepository.findOne({
      where: { accountId },
    });

    if (!user) {
      throw new NotFoundException('해당 계정의 유저를 찾을 수 없습니다.');
    }

    const chat = await this.chatRepository.findOne({
      where: { userId: user.id },
      order: { updatedAt: 'DESC' }, // 혹시 여러 개 있을 경우 대비
    });

    if (!chat) {
      throw new NotFoundException('채팅방이 존재하지 않습니다.');
    }

    return {
      success: true,
      message: '유저 채팅방 조회 성공',
      data: { chatId: chat.id },
    };
  }

  async getMessages(params: {
    roomId: number;
    accountId: number;
    role: 'user' | 'trainer';
    cursor?: number;
    limit: number;
  }): Promise<ChatMessageDto[]> {
    const { roomId, accountId, role, cursor, limit } = params;

    const chat = await this.chatRepository.findOne({ where: { id: roomId } });
    if (!chat) throw new NotFoundException('채팅방이 존재하지 않습니다.');

    const user = await this.userRepository.findOne({
      where: { accountId },
    });

    const isParticipant =
      (role === 'user' && chat.userId === user?.id) ||
      (role === 'trainer' && chat.trainerId === accountId);

    if (!isParticipant) {
      throw new ForbiddenException('이 채팅방에 접근할 수 없습니다.');
    }

    const query = this.messageRepository
      .createQueryBuilder('message')
      .where('message.chatId = :roomId', { roomId })
      .orderBy('message.id', 'DESC')
      .limit(limit);

    if (cursor) {
      query.andWhere('message.id < :cursor', { cursor });
    }

    const messages = await query.getMany();

    return messages.map((m) => ({
      messageId: m.id,
      chatId: m.chatId,
      senderId: m.senderId,
      senderRole:
        m.senderId === chat.user?.accountId
          ? 'user'
          : m.senderId === chat.trainer?.accountId
            ? 'trainer'
            : 'user',
      content: m.content,
      createdAt: m.createdAt,
    }));
  }
}
