const multipliers: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDurationToMs(input: string): number {
  const match = input.match(/^(\d+)(ms|s|m|h|d)$/);

  if (!match) {
    throw new Error(`Duracao invalida: ${input}`);
  }

  const value = match[1];
  const unit = match[2] as keyof typeof multipliers;
  const multiplier = multipliers[unit];

  if (!multiplier) {
    throw new Error(`Unidade de duracao invalida: ${unit}`);
  }

  return Number(value) * multiplier;
}
