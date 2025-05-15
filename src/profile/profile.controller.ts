import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Patch,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateProfileDto } from './dto/create-profile.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@Req() req: RequestWithUser) {
    return this.profileService.getProfile(req.user.userId);
  }

  @Post()
  createProfile(@Req() req: RequestWithUser, @Body() dto: CreateProfileDto) {
    return this.profileService.createProfile(req.user.userId, dto);
  }

  @Patch()
  updateProfile(@Req() req: RequestWithUser, @Body() dto: CreateProfileDto) {
    return this.profileService.updateProfile(req.user.userId, dto);
  }

  @Put('photo')
  @UseInterceptors(FileInterceptor('file'))
  updatePhoto(
    @Req() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.profileService.updatePhoto(req.user.userId, file);
  }
}
