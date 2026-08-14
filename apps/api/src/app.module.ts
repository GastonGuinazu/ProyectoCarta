import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { CoreModule } from './core';
import { validateEnv } from './core/config/env.validation';
import { MediaModule } from './media/media.module';
import { PublicMenuModule } from './public-menu/public-menu.module';
import { TenantModule } from './tenant/tenant.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { EngagementModule } from './engagement/engagement.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    CoreModule,
    AuthModule,
    TenantModule,
    CatalogModule,
    MediaModule,
    PublicMenuModule,
    EngagementModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
