import { Test, TestingModule } from '@nestjs/testing';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';

describe('AddressesController', () => {
  let controller: AddressesController;
  let service: jest.Mocked<AddressesService>;

  const mockReq = { user: { id: 100 } };

  const mockAddress = {
    id: 1,
    user_id: 100,
    label: 'Maison',
    street: '10 rue de la Paix',
    city: 'Paris',
    postal_code: '75001',
    country: 'France',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AddressesController],
      providers: [
        {
          provide: AddressesService,
          useValue: {
            findByUser: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AddressesController>(AddressesController);
    service = module.get(AddressesService) as jest.Mocked<AddressesService>;
  });

  describe('findByUser', () => {
    it('should return user addresses', async () => {
      service.findByUser.mockResolvedValue([mockAddress] as any);

      const result = await controller.findByUser(mockReq);

      expect(service.findByUser).toHaveBeenCalledWith(100);
      expect(result).toEqual([mockAddress]);
    });
  });

  describe('create', () => {
    it('should create an address', async () => {
      const dto = { label: 'Maison', street: '10 rue de la Paix', city: 'Paris' };
      service.create.mockResolvedValue(mockAddress as any);

      const result = await controller.create(dto, mockReq);

      expect(service.create).toHaveBeenCalledWith(dto, 100);
      expect(result).toEqual(mockAddress);
    });
  });

  describe('update', () => {
    it('should update an address', async () => {
      const dto = { city: 'Lyon' };
      const updated = { ...mockAddress, city: 'Lyon' };
      service.update.mockResolvedValue(updated as any);

      const result = await controller.update(1, dto, mockReq);

      expect(service.update).toHaveBeenCalledWith(1, dto, 100);
      expect(result.city).toBe('Lyon');
    });
  });

  describe('remove', () => {
    it('should remove an address', async () => {
      const expected = { message: 'Adresse supprimée' };
      service.remove.mockResolvedValue(expected);

      const result = await controller.remove(1, mockReq);

      expect(service.remove).toHaveBeenCalledWith(1, 100);
      expect(result).toEqual(expected);
    });
  });
});
