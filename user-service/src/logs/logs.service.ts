import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Log } from './entities/log.entity.js';

@Injectable()
export class LogsService {
  constructor(
    @InjectRepository(Log) private logsRepo: Repository<Log>,
  ) {}

  async create(data: Partial<Log>) {
    const log = this.logsRepo.create(data);
    return this.logsRepo.save(log);
  }

  async findByUser(userId: number) {
    return this.logsRepo.find({ where: { user_id: userId } });
  }
}
