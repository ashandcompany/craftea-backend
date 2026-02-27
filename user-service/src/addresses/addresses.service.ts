import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from './entities/address.entity.js';
import { CreateAddressDto } from './dto/create-address.dto.js';
import { UpdateAddressDto } from './dto/update-address.dto.js';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address) private addressesRepo: Repository<Address>,
  ) {}

  async findByUser(userId: number) {
    return this.addressesRepo.find({ where: { user_id: userId } });
  }

  async create(dto: CreateAddressDto, userId: number) {
    const address = this.addressesRepo.create({ ...dto, user_id: userId });
    return this.addressesRepo.save(address);
  }

  async update(id: number, dto: UpdateAddressDto, userId: number) {
    const address = await this.addressesRepo.findOne({
      where: { id, user_id: userId },
    });
    if (!address) throw new NotFoundException('Adresse introuvable');

    Object.assign(address, dto);
    return this.addressesRepo.save(address);
  }

  async remove(id: number, userId: number) {
    const result = await this.addressesRepo.delete({ id, user_id: userId });
    if (result.affected === 0) throw new NotFoundException('Adresse introuvable');
    return { message: 'Adresse supprimée' };
  }
}
