import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(join(__dirname, '..', 'public'));

  // app.enableCors();

  await app.listen(3000, '0.0.0.0');
  const server = app.getHttpServer();
  const address = server.address();
  console.log('🚀 Server running at:', address);
}
bootstrap();