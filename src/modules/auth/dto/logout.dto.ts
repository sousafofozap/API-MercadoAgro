import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsJWT, IsString, ValidateIf } from 'class-validator';

function validateRefreshToken(object: LogoutDto) {
  return (
    object.refreshToken !== undefined || object.refresh_token === undefined
  );
}

function validateRefreshTokenAlias(object: LogoutDto) {
  return (
    object.refresh_token !== undefined || object.refreshToken === undefined
  );
}

export class LogoutDto {
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
