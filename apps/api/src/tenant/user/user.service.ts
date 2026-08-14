import { Injectable } from '@nestjs/common';
import { UserRepository, type AuthUserRecord } from './user.repository';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  findByEmailForLogin(email: string): Promise<AuthUserRecord | null> {
    return this.userRepository.findByEmailForLogin(email);
  }

  findByIdForSession(userId: string): Promise<AuthUserRecord | null> {
    return this.userRepository.findByIdForSession(userId);
  }

  touchLastLogin(userId: string): Promise<void> {
    return this.userRepository.touchLastLogin(userId);
  }

  updatePasswordHash(input: {
    readonly userId: string;
    readonly tenantId: string | null;
    readonly passwordHash: string;
  }): Promise<boolean> {
    return this.userRepository.updatePasswordHash(input);
  }
}
