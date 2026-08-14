import type { TenantScopedRequest } from '../core';
import type { AuthenticatedUser } from './auth.types';

export interface AuthenticatedRequest extends TenantScopedRequest {
  user?: AuthenticatedUser;
}
