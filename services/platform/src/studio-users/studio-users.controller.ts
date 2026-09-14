import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/roles.decorator';
import { USER_ROLE } from '../auth/roles';
import { CreateStudioUserDto } from './dto/create-studio-user.dto';
import { UpdateStudioUserDto } from './dto/update-studio-user.dto';
import { StudioUsersService } from './studio-users.service';

@Controller('studio/users')
@Roles(USER_ROLE.ADMIN)
export class StudioUsersController {
  constructor(private readonly users: StudioUsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Get(':id/activity')
  activity(@Param('id') id: string) {
    return this.users.listActivity(id);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.users.get(id);
  }

  @Post()
  create(@Body() dto: CreateStudioUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudioUserDto,
    @CurrentUser() actor: JwtUser,
  ) {
    return this.users.update(id, dto, actor);
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string) {
    return this.users.resetPassword(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: JwtUser) {
    return this.users.remove(id, actor);
  }
}
