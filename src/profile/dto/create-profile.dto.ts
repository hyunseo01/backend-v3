import {
  IsInt,
  IsOptional,
  Min,
  Max,
  IsNumber,
  IsString,
} from 'class-validator';

export class CreateProfileDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  age: number;

  @IsOptional()
  @IsString()
  gender: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300)
  height: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  weight: number;

  @IsOptional()
  @IsString()
  memo: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
