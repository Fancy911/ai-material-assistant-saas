import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { SessionGuard } from './auth/auth';
import { CanxiangProvider, MockProvider } from './resolve/providers';
import { ResolveService } from './resolve/resolve.service';
import { ResolveController } from './resolve/resolve.controller';
import { HealthController } from './health.controller';
import { AuthController } from './auth/auth.controller';
import { MediaController } from './media/media.controller';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }), JwtModule.register({ global: true, secret: process.env.JWT_SECRET || 'development-only-change-me' })], controllers: [HealthController, ResolveController, AuthController, MediaController], providers: [PrismaService, SessionGuard, MockProvider, CanxiangProvider, ResolveService] })
export class AppModule {}
