import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { rateLimit } from './common/rate-limit';
async function bootstrap() { const app = await NestFactory.create(AppModule); app.enableCors({ origin: process.env.APP_ORIGIN?.split(',') ?? true }); app.use(rateLimit); app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true })); await app.listen(process.env.PORT || 3000); }
bootstrap();
