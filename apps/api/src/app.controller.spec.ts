import { Test } from '@nestjs/testing';
import { AppController } from './app.controller.js';

describe('AppController', () => {
  it('names the service', async () => {
    const module = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    expect(module.get(AppController).info()).toEqual({
      name: 'SlotWise',
      service: 'api',
    });
  });
});
