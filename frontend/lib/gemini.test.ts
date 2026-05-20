import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GEMINI_API_VER, DEFAULT_GEMINI_MODEL, pickAvailableModel } from './gemini';

vi.mock('./apiClient', () => ({
  pposFetch: vi.fn(),
}));

import { pposFetch } from './apiClient';
const mockPposFetch = pposFetch as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockPposFetch.mockReset();
});

describe('constants', () => {
  it('GEMINI_API_VER is "v1"', () => {
    expect(GEMINI_API_VER).toBe('v1');
  });

  it('DEFAULT_GEMINI_MODEL is "gemini-2.5-flash"', () => {
    expect(DEFAULT_GEMINI_MODEL).toBe('gemini-2.5-flash');
  });
});

describe('pickAvailableModel', () => {
  it('returns DEFAULT_GEMINI_MODEL when pposFetch throws', async () => {
    mockPposFetch.mockRejectedValue(new Error('network error'));
    const model = await pickAvailableModel();
    expect(model).toBe(DEFAULT_GEMINI_MODEL);
  });

  it('returns DEFAULT_GEMINI_MODEL when response has no models array', async () => {
    mockPposFetch.mockResolvedValue({});
    const model = await pickAvailableModel();
    expect(model).toBe(DEFAULT_GEMINI_MODEL);
  });

  it('returns DEFAULT_GEMINI_MODEL when models list is empty', async () => {
    mockPposFetch.mockResolvedValue({ models: [] });
    const model = await pickAvailableModel();
    expect(model).toBe(DEFAULT_GEMINI_MODEL);
  });

  it('returns DEFAULT_GEMINI_MODEL when no model supports generateContent', async () => {
    mockPposFetch.mockResolvedValue({
      models: [
        { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['embedContent'] },
      ],
    });
    const model = await pickAvailableModel();
    expect(model).toBe(DEFAULT_GEMINI_MODEL);
  });

  it('filters out 1.5-flash models', async () => {
    mockPposFetch.mockResolvedValue({
      models: [
        { name: 'models/gemini-1.5-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
      ],
    });
    const model = await pickAvailableModel();
    expect(model).not.toContain('1.5-flash');
    expect(model).toBe('gemini-2.5-pro');
  });

  it('filters out 2.0-flash models', async () => {
    mockPposFetch.mockResolvedValue({
      models: [
        { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
      ],
    });
    const model = await pickAvailableModel();
    expect(model).not.toContain('2.0-flash');
    expect(model).toBe('gemini-2.5-flash');
  });

  it('prefers 2.5-flash over 2.5-pro', async () => {
    mockPposFetch.mockResolvedValue({
      models: [
        { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
      ],
    });
    const model = await pickAvailableModel();
    expect(model).toBe('gemini-2.5-flash');
  });

  it('falls back to 2.5-pro when only 2.5-pro is in the list (no 2.5-flash variants)', async () => {
    // has('2.5-flash') checks via .includes() so it would match '2.5-flash-lite' too.
    // To isolate the 2.5-pro branch, the list must have no '2.5-flash' substring at all.
    mockPposFetch.mockResolvedValue({
      models: [
        { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
      ],
    });
    const model = await pickAvailableModel();
    expect(model).toBe('gemini-2.5-pro');
  });

  it('falls back to 2.5-flash-lite when 2.5-flash and 2.5-pro are not available', async () => {
    mockPposFetch.mockResolvedValue({
      models: [
        { name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
      ],
    });
    const model = await pickAvailableModel();
    expect(model).toBe('gemini-2.5-flash-lite');
  });

  it('strips the models/ prefix from the returned name', async () => {
    mockPposFetch.mockResolvedValue({
      models: [
        { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
      ],
    });
    const model = await pickAvailableModel();
    expect(model).not.toMatch(/^models\//);
    expect(model).toBe('gemini-2.5-flash');
  });

  it('calls pposFetch with the correct models endpoint URL', async () => {
    mockPposFetch.mockResolvedValue({ models: [] });
    await pickAvailableModel();
    expect(mockPposFetch).toHaveBeenCalledWith(
      `/api/gemini-proxy/${GEMINI_API_VER}/models?pageSize=200`
    );
  });
});
