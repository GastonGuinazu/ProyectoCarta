import { NotFoundException } from '@nestjs/common';

export class SettingsBranchNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: 'BRANCH_NOT_FOUND',
      message: 'Este restaurante todavía no tiene una sucursal.',
    });
  }
}
