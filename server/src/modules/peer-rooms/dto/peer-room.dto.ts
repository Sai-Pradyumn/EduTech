import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRoomDto {
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsString() @MinLength(2) @MaxLength(120) topic!: string;
}

export class JoinRoomDto {
  @IsString() @MinLength(4) @MaxLength(12) code!: string;
}

export class PostMessageDto {
  @IsString() @MinLength(1) @MaxLength(2000) text!: string;
}
