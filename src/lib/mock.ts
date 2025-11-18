export const isMockMode = (): boolean =>
  process.env.NEXT_PUBLIC_F0_MOCK_MODE === '1';
