import { IsEmail, IsString, MinLength } from 'class-validator';

export class SigninDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(4)
  password: string;
}
