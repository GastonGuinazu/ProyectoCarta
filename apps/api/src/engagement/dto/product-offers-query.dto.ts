import { IsUuidLike } from '../../core';

export class ProductOffersQueryDto {
  @IsUuidLike()
  productId!: string;
}
