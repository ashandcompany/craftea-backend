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
    it('should return ok status', () => {
      const result = controller.health();

      expect(result).toEqual({ status: 'ok', service: 'user-service' });
    });
  });

  describe('resetPasswordPreview', () => {
    it('should return HTML string with a reset password link', () => {
      const result = controller.resetPasswordPreview();

      expect(typeof result).toBe('string');
      expect(result).toContain('reset-password');
      expect(result).toContain('preview-token-abc123');
    });
  });
});
