import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core';
import { PublicMenuModule } from './public-menu/public-menu.module';

@Module({
  imports: [CoreModule, PublicMenuModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
