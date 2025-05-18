import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import {
  TokenExpiredError,
  JsonWebTokenError,
  NotBeforeError,
} from 'jsonwebtoken';
import { UnauthorizedException } from '@nestjs/common';

export interface SocketUserPayload {
  accountId: number;
  role: 'user' | 'trainer' | 'admin';
}

export function extractUserFromSocket(
  client: Socket,
  jwtService: JwtService,
): SocketUserPayload {
  const authHeader = client.handshake.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    throw new UnauthorizedException('Authorization 헤더가 없습니다.');
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw new UnauthorizedException('JWT 토큰이 존재하지 않습니다.');
  }

  try {
    const payload = jwtService.verify<{ sub: number; role: string }>(token);

    if (typeof payload.sub !== 'number' || typeof payload.role !== 'string') {
      throw new UnauthorizedException('JWT 페이로드가 유효하지 않습니다.');
    }

    const userRole = payload.role;
    if (userRole !== 'user' && userRole !== 'trainer' && userRole !== 'admin') {
      throw new UnauthorizedException('허용되지 않은 사용자 역할입니다.');
    }

    return {
      accountId: payload.sub,
      role: userRole,
    };
  } catch (err: unknown) {
    if (err instanceof TokenExpiredError) {
      throw new UnauthorizedException('토큰이 만료되었습니다.');
    }
    if (err instanceof JsonWebTokenError) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }
    if (err instanceof NotBeforeError) {
      throw new UnauthorizedException('토큰 사용 가능 시간이 아닙니다.');
    }
    if (err instanceof Error) {
      console.error('소켓 인증 에러:', err.message);
    }
    throw new UnauthorizedException('WebSocket 인증에 실패했습니다.');
  }
}
