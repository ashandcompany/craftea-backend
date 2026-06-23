import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TagsService } from './tags.service';
import { Tag } from './entities/tag.entity';

describe('TagsService', () => {
  let service: TagsService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        { provide: getRepositoryToken(Tag), useValue: repo },
      ],
    }).compile();

    service = module.get<TagsService>(TagsService);
  });

  describe('findAll', () => {
    it('should return all tags ordered by name', async () => {
      const tags = [{ id: 1, name: 'Artisanal' }, { id: 2, name: 'Bio' }];
      repo.find.mockResolvedValue(tags);

      const result = await service.findAll();

      expect(repo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
      expect(result).toBe(tags);
    });
  });

  describe('create', () => {
    it('should create and return a new tag', async () => {
      const dto = { name: 'Fait-main' };
      const tag = { id: 3, name: 'Fait-main' };
      repo.create.mockReturnValue(tag);
      repo.save.mockResolvedValue(tag);

      const result = await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith({ name: 'Fait-main' });
      expect(repo.save).toHaveBeenCalledWith(tag);
      expect(result).toBe(tag);
    });
  });

  describe('remove', () => {
    it('should delete the tag', async () => {
      repo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.remove(1);

      expect(repo.delete).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: 'Tag supprimé' });
    });

    it('should throw NotFoundException when tag does not exist', async () => {
      repo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
