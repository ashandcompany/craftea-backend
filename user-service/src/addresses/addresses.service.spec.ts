import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AddressesService } from './addresses.service';
import { Address } from './entities/address.entity';

describe('AddressesService', () => {
  let service: AddressesService;
  let addressesRepo: jest.Mocked<Repository<Address>>;

  const mockAddress: Address = {
    id: 1,
    user_id: 100,
    label: 'Maison',
    street: '10 rue de la Paix',
    city: 'Paris',
    postal_code: '75001',
    country: 'France',
    user: {} as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressesService,
        {
          provide: getRepositoryToken(Address),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AddressesService>(AddressesService);
    addressesRepo = module.get(getRepositoryToken(Address)) as jest.Mocked<Repository<Address>>;
  });

  describe('findByUser', () => {
    it('should return addresses for a user', async () => {
      addressesRepo.find.mockResolvedValue([mockAddress]);

      const result = await service.findByUser(100);

      expect(addressesRepo.find).toHaveBeenCalledWith({ where: { user_id: 100 } });
      expect(result).toEqual([mockAddress]);
    });
  });

  describe('create', () => {
    it('should create an address', async () => {
      const dto = {
        label: 'Maison',
        street: '10 rue de la Paix',
        city: 'Paris',
        postal_code: '75001',
        country: 'France',
      };
      addressesRepo.create.mockReturnValue(mockAddress);
      addressesRepo.save.mockResolvedValue(mockAddress);

      const result = await service.create(dto, 100);

      expect(addressesRepo.create).toHaveBeenCalledWith({ ...dto, user_id: 100 });
      expect(addressesRepo.save).toHaveBeenCalledWith(mockAddress);
      expect(result).toEqual(mockAddress);
    });
  });

  describe('update', () => {
    it('should update an address', async () => {
      const dto = { city: 'Lyon' };
      const updated = { ...mockAddress, city: 'Lyon' };
      addressesRepo.findOne.mockResolvedValue({ ...mockAddress });
      addressesRepo.save.mockResolvedValue(updated);

      const result = await service.update(1, dto, 100);

      expect(addressesRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1, user_id: 100 },
      });
      expect(result.city).toBe('Lyon');
    });

    it('should throw NotFoundException if address not found', async () => {
      addressesRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, { city: 'Lyon' }, 100)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove an address', async () => {
      addressesRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.remove(1, 100);

      expect(addressesRepo.delete).toHaveBeenCalledWith({ id: 1, user_id: 100 });
      expect(result).toEqual({ message: 'Adresse supprimée' });
    });

    it('should throw NotFoundException if address not found', async () => {
      addressesRepo.delete.mockResolvedValue({ affected: 0, raw: [] });

      await expect(service.remove(999, 100)).rejects.toThrow(NotFoundException);
    });
  });
});
