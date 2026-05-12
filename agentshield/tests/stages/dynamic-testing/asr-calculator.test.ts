import {
  formatASR,
  MCPSECBENCH_TAXONOMY,
} from '../../../src/stages/dynamic-testing/asr-calculator';

describe('formatASR', () => {
  it("returns '<label> ASR: 67% (2/3 attempts succeeded)' for 2,3,'Tool Shadowing'", () => {
    const result = formatASR(2, 3, 'Tool Shadowing');
    expect(result).toBe('Tool Shadowing ASR: 67% (2/3 attempts succeeded)');
  });

  it("returns '<label> ASR: 0% (0/0 attempts succeeded)' when attempts is zero (no division by zero)", () => {
    const result = formatASR(0, 0, 'Tool Shadowing');
    expect(result).toBe('Tool Shadowing ASR: 0% (0/0 attempts succeeded)');
  });

  it('rounds to nearest integer percentage: 1/3 → 33%', () => {
    const result = formatASR(1, 3, 'Indirect Prompt Injection');
    expect(result).toBe('Indirect Prompt Injection ASR: 33% (1/3 attempts succeeded)');
  });

  it('rounds to nearest integer percentage: 2/3 → 67%', () => {
    const result = formatASR(2, 3, 'Indirect Prompt Injection');
    expect(result).toBe('Indirect Prompt Injection ASR: 67% (2/3 attempts succeeded)');
  });

  it('returns 100% when all attempts succeeded', () => {
    const result = formatASR(3, 3, 'Tool Shadowing');
    expect(result).toBe('Tool Shadowing ASR: 100% (3/3 attempts succeeded)');
  });
});

describe('MCPSECBENCH_TAXONOMY', () => {
  it('maps tool-shadowing to "Tool Shadowing Attack"', () => {
    expect(MCPSECBENCH_TAXONOMY['tool-shadowing']).toBe('Tool Shadowing Attack');
  });

  it('maps rade to "Indirect Prompt Injection"', () => {
    expect(MCPSECBENCH_TAXONOMY['rade']).toBe('Indirect Prompt Injection');
  });

  it('maps escalation to "Tool/Service Misuse via Confused AI"', () => {
    expect(MCPSECBENCH_TAXONOMY['escalation']).toBe('Tool/Service Misuse via Confused AI');
  });

  it('has at least 3 entries', () => {
    expect(Object.keys(MCPSECBENCH_TAXONOMY).length).toBeGreaterThanOrEqual(3);
  });
});
