import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsJWT, IsString, ValidateIf } from 'class-validator';

function validateRefreshToken(object: RefreshTokenDto) {
  return (
    object.refreshToken !== undefined || object.refresh_token === undefined
  );
}

function validateRefreshTokenAlias(object: RefreshTokenDto) {
  return (
    object.refresh_token !== undefined || object.refreshToken === undefined
  );
}

export class RefreshTokenDto {
  @ApiProperty()
  @ValidateIf(validateRefreshToken)
  @IsString()
  @IsJWT()
  refreshToken?: string;

  @ApiPropertyOptional({ description: 'Alias snake_case para refreshToken' })
  @ValidateIf(validateRefreshTokenAlias)
  @IsString()
  @IsJWT()
  refresh_token?: string;
}
