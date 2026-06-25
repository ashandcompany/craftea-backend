import {
  Controller,
  Get,
  Put,
  Patch,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  ParseIntPipe,
  ForbiddenException,
  Headers,
  NotFoundException,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { ChangeRoleDto } from './dto/change-role.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get('public/:id')
  findPublicById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findPublicById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @Request() req,
  ) {
    return this.usersService.update(id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  updateAvatar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    return this.usersService.updateAvatar(id, file, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/toggle-active')
  toggleActive(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.usersService.toggleActive(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('deactivate-self')
  @HttpCode(200)
  async deactivateSelf(@Request() req) {
    await this.usersService.selfDeactivate(req.user.id);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/role')
  changeRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeRoleDto,
    @Request() req,
  ) {
    return this.usersService.changeRole(id, dto.role, req.user.id);
  }

  /** Service-to-service: returns id + email. Protected by INTERNAL_SERVICE_TOKEN. */
  @Get('internal/:id')
  async findInternalById(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-service-token') serviceToken: string,
  ) {
    const expected = this.configService.get<string>(
      'INTERNAL_SERVICE_TOKEN',
      '',
    );
    if (!expected || serviceToken !== expected) {
      throw new ForbiddenException('Invalid service token');
    }
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return {
      id: user.id,
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
    };
  }
}
