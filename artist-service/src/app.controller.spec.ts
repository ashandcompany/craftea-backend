import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return health status', () => {
      const result = controller.health();

      expect(result).toEqual({
        status: 'ok',
        service: 'artist-service',
      });
    });

    it('should have status property equal to "ok"', () => {
      const result = controller.health();
      expect(result.status).toBe('ok');
    });

    it('should have service property equal to "artist-service"', () => {
      const result = controller.health();
      expect(result.service).toBe('artist-service');
    });
  });
});
