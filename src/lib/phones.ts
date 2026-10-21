const ddds = new Set(
  '11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(
    ' ',
  ),
);
export function brazilianPhone(value: string) {
  if (!/^\+?[\d\s().-]+$/.test(value.trim()))
    throw new Error('Telefone inválido: informe somente número, DDD e país, sem ramal.');
  let digits = value.replace(/[\s()+.-]/g, '');
  if (digits.startsWith('0055') && [14, 15].includes(digits.length)) digits = digits.slice(4);
  else if (digits.startsWith('55') && [12, 13].includes(digits.length)) digits = digits.slice(2);
  else if (value.trim().startsWith('+'))
    throw new Error('Informe um telefone brasileiro completo com +55 e DDD.');
  if (![10, 11].includes(digits.length) || !ddds.has(digits.slice(0, 2)))
    throw new Error(
      'Telefone ambíguo ou DDD inválido. Informe DDD e número completos; não completaremos dígitos.',
    );
  const local = digits.slice(2);
  if (
    !(local.length === 9 && /^9\d{8}$/.test(local)) &&
    !(local.length === 8 && /^[2-5]\d{7}$/.test(local))
  )
    throw new Error(
      'Número local inválido ou ambíguo. Confirme o telefone completo sem acrescentar dígitos por suposição.',
    );
  return `55${digits}`;
}
export function whatsappPhone(value: string) {
  try {
    return { phone: brazilianPhone(value), error: null };
  } catch (e) {
    return {
      phone: null,
      error: value ? (e as Error).message : 'Telefone comercial não informado.',
    };
  }
}
