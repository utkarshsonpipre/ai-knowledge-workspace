import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.users.findById(userId);
  }

  @Patch('me')
  update(@CurrentUser('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.users.update(userId, dto);
  }

  @Get('me/dashboard')
  dashboard(@CurrentUser('id') userId: string) {
    return this.users.dashboard(userId);
  }
}
