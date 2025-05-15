import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Chat } from './entities/chats.entity';
import { Repository } from 'typeorm';
import { Trainer } from '../trainer/entities/trainer.entity';
import { ChatRoomDto } from './dto/chat-room.dto';
import { ChatMessageDto } from '../messages/dto/chat-message.dto';
import { Message } from '../messages/entities/messages.entity';
import { UserRole } from '../common/interfaces/user-role.type';
import { formatDateForChat } from '../common/utils/formatDateForChat';

type ChatWithExtras = Chat & {
  lastMessage?: Message;
  unreadCount?: number;
};

@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
    @InjectRepository(Trainer)
    private readonly trainerRepository: Repository<Trainer>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  // [REST] 트레이너 전용 채팅방 리스트 조회
  async getChatRoomsForTrainer(accountId: number): Promise<ChatRoomDto[]> {
    const trainer = await this.trainerRepository.findOne({
      where: { accountId },
    });

    if (!trainer) {
      throw new NotFoundException('트레이너 정보를 찾을 수 없습니다.');
    }

    // 모든 채팅방 조회 + 최신 메시지 + 안 읽은 메시지 수 계산 포함
    const chats = await this.chatRepository
      .createQueryBuilder('chat')
      .leftJoinAndSelect('chat.user', 'user')
      .leftJoinAndSelect('user.account', 'account')
      .leftJoin(
        (qb) =>
          qb
            .select('message.chatId', 'chatId')
            .addSelect('MAX(message.id)', 'lastMessageId')
            .from(Message, 'message')
            .groupBy('message.chatId'),
        'lastMessageSub',
        'lastMessageSub.chatId = chat.id',
      )
      .leftJoinAndSelect(
        Message,
        'lastMessage',
        'lastMessage.id = lastMessageSub.lastMessageId',
      )
      .loadRelationCountAndMap(
        'chat.unreadCount',
        'chat.messages',
        'unreadMessages',
        (qb) =>
          qb
            .where('unreadMessages.isRead = false')
            .andWhere('unreadMessages.senderId != :trainerAccountId', {
              trainerAccountId: accountId,
            }),
      )
      .where('chat.trainerId = :trainerId', { trainerId: trainer.id })
      .orderBy('chat.updatedAt', 'DESC')
      .getMany();

    return (chats as ChatWithExtras[]).map((chat) => ({
      chatId: chat.id,
      userId: chat.user?.id || 0,
      userName: chat.user?.account?.name || '알 수 없음',
      lastMessage: chat.lastMessage?.content || null,
      lastMessageAt: chat.lastMessage
        ? formatDateForChat(chat.lastMessage.createdAt)
        : null,
      unreadCount: chat.unreadCount ?? 0,
    }));
  }

  // [REST] 메시지 무한스크롤 조회
  async getMessages(params: {
    roomId: number;
    cursor?: number;
    limit: number;
    accountId: number;
    role: UserRole;
  }): Promise<ChatMessageDto[]> {
    const { roomId, cursor, limit, accountId, role } = params;

    const chat = await this.chatRepository.findOne({
      where: { id: roomId },
    });

    if (!chat) {
      throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    }

    if (
      (role === 'user' && chat.userId !== null && chat.userId !== accountId) ||
      (role === 'trainer' &&
        chat.trainerId !== null &&
        chat.trainerId !== accountId)
    ) {
      throw new ForbiddenException('해당 채팅방에 접근 권한이 없습니다.');
    }

    const query = this.messageRepository
      .createQueryBuilder('message')
      .where('message.chatId = :roomId', { roomId })
      .orderBy('message.id', 'DESC')
      .take(limit);

    if (cursor) {
      query.andWhere('message.id < :cursor', { cursor });
    }

    const messages = await query
      .leftJoinAndSelect('message.sender', 'sender')
      .getMany();

    return messages.map((msg) => {
      const role = msg.sender?.role;
      const safeRole = role === 'user' || role === 'trainer' ? role : 'user';

      return {
        messageId: msg.id,
        senderId: msg.senderId,
        senderRole: safeRole,
        content: msg.content,
        createdAt: msg.createdAt,
      };
    });
  }

  // [WebSocket] 메시지 저장 (message.send 이벤트용)
  async saveMessage(params: {
    chatId: number;
    content: string;
    senderId: number;
    isSystem?: boolean;
  }): Promise<Message> {
    const { chatId, content, senderId, isSystem = false } = params;

    const chat = await this.chatRepository.findOneBy({ id: chatId });
    if (!chat) throw new NotFoundException('채팅방을 찾을 수 없습니다.');

    const message = this.messageRepository.create({
      chatId,
      content,
      senderId,
      isSystem,
      isRead: false,
    });

    return await this.messageRepository.save(message);
  }

  // [WebSocket] 채팅방에 연결된 유저/트레이너 조회 (message 전송 시 대상 판단용)
  async getChatWithUsers(chatId: number): Promise<Chat> {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['user', 'user.account', 'trainer', 'trainer.account'],
    });

    if (!chat) throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    return chat;
  }

  //읽음 처리
  async markMessagesAsRead(params: {
    chatId: number;
    accountId: number;
    lastReadMessageId: number;
  }): Promise<void> {
    const { chatId, accountId, lastReadMessageId } = params;

    await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true })
      .where('chatId = :chatId', { chatId })
      .andWhere('senderId != :accountId', { accountId }) // 상대방이 보낸 메시지만
      .andWhere('id <= :lastReadMessageId', { lastReadMessageId })
      .andWhere('isRead = false')
      .execute();
  }
}
