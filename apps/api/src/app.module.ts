import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { SessionGuard } from './auth/auth';
import { CanxiangProvider, MockProvider, ZhilingProvider } from './resolve/providers';
import { ResolveService } from './resolve/resolve.service';
import { ResolveController } from './resolve/resolve.controller';
import { HealthController } from './health.controller';
import { AuthController } from './auth/auth.controller';
import { MediaController } from './media/media.controller';
import { AdminProviderController } from './admin/admin.controller';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }), JwtModule.registerAsync({ global: true, inject: [ConfigService], useFactory: (config: ConfigService) => ({ secret: config.get<string>('JWT_SECRET') || 'development-only-change-me', signOptions: { expiresIn: '1h' } }) })], controllers: [HealthController, ResolveController, AuthController, MediaController, AdminProviderController], providers: [PrismaService, SessionGuard, MockProvider, CanxiangProvider, ZhilingProvider, ResolveService] })
export class AppModule {}
