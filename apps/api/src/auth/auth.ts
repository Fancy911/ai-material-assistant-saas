import { CanActivate, createParamDecorator, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export type Session = { sub: string; tenantId?: string; role: 'USER' | 'TENANT_ADMIN' | 'SUPER_ADMIN' };
export const CurrentSession = createParamDecorator((_: unknown, context: ExecutionContext): Session => context.switchToHttp().getRequest().user);
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest(); const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing session');
    try { request.user = await this.jwt.verifyAsync<Session>(header.slice(7)); return true; } catch { throw new UnauthorizedException('Invalid session'); }
  }
}
export function requireRole(session: Session, ...roles: Session['role'][]) { if (!roles.includes(session.role)) throw new UnauthorizedException('Insufficient role'); }

