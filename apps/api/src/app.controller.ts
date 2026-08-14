import { Controller, Get } from '@nestjs/common';
import { Public, SkipTenantResolution } from './core';
import { AppService } from './app.service';

@Public()
@SkipTenantResolution()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): { status: 'ok' } {
    return this.appService.getHealth();
  }
}
