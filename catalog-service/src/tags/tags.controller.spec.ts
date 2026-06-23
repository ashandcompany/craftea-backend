import { Test, TestingModule } from '@nestjs/testing';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

describe('TagsController', () => {
  let controller: TagsController;
  let service: jest.Mocked<Partial<TagsService>>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TagsController],
      providers: [{ provide: TagsService, useValue: service }],
    }).compile();

    controller = module.get<TagsController>(TagsController);
  });

  describe('findAll', () => {
    it('should return all tags', async () => {
      const tags = [{ id: 1, name: 'Bio' }];
      service.findAll.mockResolvedValue(tags);

      expect(await controller.findAll()).toBe(tags);
    });
  });

  describe('create', () => {
    it('should create a tag', async () => {
      const dto = { name: 'Éco' };
      const tag = { id: 2, name: 'Éco' };
      service.create.mockResolvedValue(tag as any);

      expect(await controller.create(dto)).toBe(tag);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('remove', () => {
    it('should remove a tag', async () => {
      const result = { message: 'Tag supprimé' };
      service.remove.mockResolvedValue(result);

      expect(await controller.remove(1)).toBe(result);
      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });
});
