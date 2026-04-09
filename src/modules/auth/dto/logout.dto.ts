import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString } from 'class-validator';

export class LogoutDto {
  @ApiProperty()
  @IsString()
  @IsJWT()
  refreshToken!: string;
}
