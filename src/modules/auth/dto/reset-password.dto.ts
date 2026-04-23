import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token recebido por e-mail' })
  @IsString()
  @IsUUID('4')
  token!: string;

  @ApiProperty({
    example: 'NovaSenha@123',
    description: 'Minimo de 8 caracteres com letra maiuscula, minuscula e numero.',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'A senha deve conter ao menos uma letra minuscula, uma maiuscula e um numero.',
  })
  password!: string;
}
