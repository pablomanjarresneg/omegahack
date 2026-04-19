import { describe, expect, it } from 'vitest';
import { redactText } from '../src/redact-text';

describe('redactText — email', () => {
  it('redacts simple email', () => {
    const { llmText, redactionLog } = redactText('Contactar juan@mail.com gracias');
    expect(llmText).toBe('Contactar [EMAIL] gracias');
    expect(redactionLog).toHaveLength(1);
    expect(redactionLog[0]?.fieldName).toBe('email');
  });

  it('redacts email with +alias', () => {
    const { llmText } = redactText('Mi correo: usuario+etiqueta@gmail.com');
    expect(llmText).toBe('Mi correo: [EMAIL]');
  });

  it('redacts email with dots and dashes', () => {
    const { llmText } = redactText('pedro.perez-lopez@sub.dominio.co');
    expect(llmText).toBe('[EMAIL]');
  });

  it('redacts two emails in the same paragraph', () => {
    const { llmText, redactionLog } = redactText('De a@b.co a c@d.co.');
    expect(llmText).toBe('De [EMAIL] a [EMAIL].');
    expect(redactionLog).toHaveLength(2);
  });
});

describe('redactText — cedula', () => {
  it('redacts bare 10-digit cedula', () => {
    const { llmText } = redactText('mi cedula es 1234567890 ok');
    expect(llmText).toBe('mi cedula es [CED] ok');
  });

  it('redacts CC-prefixed cedula', () => {
    const { llmText } = redactText('CC 12345678 presenta queja');
    expect(llmText).toBe('[CED] presenta queja');
  });

  it('redacts C.C. with dots', () => {
    const { llmText } = redactText('C.C. 1020304050 radica PQR');
    expect(llmText).toBe('[CED] radica PQR');
  });

  it('redacts 7-digit cedula', () => {
    const { llmText } = redactText('Identificado con 1234567.');
    expect(llmText).toBe('Identificado con [CED].');
  });

  it('does NOT redact 6-digit number as cedula', () => {
    const { llmText, redactionLog } = redactText('El código es 123456 nada mas');
    expect(llmText).toBe('El código es 123456 nada mas');
    expect(redactionLog.filter((e) => e.fieldName === 'cedula')).toHaveLength(0);
  });

  it('does NOT redact dates like 2026-04-18 as cedula', () => {
    const { llmText, redactionLog } = redactText('Fecha de radicado 2026-04-18 pendiente');
    expect(redactionLog.filter((e) => e.fieldName === 'cedula')).toHaveLength(0);
    expect(llmText).toContain('2026-04-18');
  });

  it('does NOT over-redact mid-digit runs', () => {
    const { llmText } = redactText('El total es 1234567890123 (13 dígitos).');
    // 13-digit run is longer than cedula max — should NOT match.
    expect(llmText).toContain('1234567890123');
  });
});

describe('redactText — teléfono', () => {
  it('redacts Colombian mobile', () => {
    const { llmText } = redactText('celular 3001234567 disponible');
    expect(llmText).toBe('celular [TEL] disponible');
  });

  it('redacts fixed line with dashes', () => {
    const { llmText } = redactText('PBX 601-555-1234 ext 100');
    expect(llmText).toBe('PBX [TEL] ext 100');
  });

  it('redacts fixed line with spaces', () => {
    const { llmText } = redactText('Llamar al 604 444 1122.');
    expect(llmText).toBe('Llamar al [TEL].');
  });

  it('redacts multiple phones in one text', () => {
    const { redactionLog } = redactText('Cels: 3001112222 y 3013334444');
    expect(redactionLog.filter((e) => e.fieldName === 'telefono')).toHaveLength(2);
  });

  it('mobile number is not misread as cedula', () => {
    const { redactionLog } = redactText('celular 3001234567');
    expect(redactionLog.some((e) => e.fieldName === 'cedula')).toBe(false);
    expect(redactionLog.some((e) => e.fieldName === 'telefono')).toBe(true);
  });
});

describe('redactText — NIT', () => {
  it('redacts NIT with verification digit', () => {
    const { llmText } = redactText('NIT 900123456-7 está registrado');
    expect(llmText).toBe('[NIT] está registrado');
  });

  it('redacts NIT without verification digit', () => {
    const { llmText } = redactText('NIT. 900123456 valido');
    expect(llmText).toBe('[NIT] valido');
  });

  it('redacts NIT case insensitive', () => {
    const { llmText } = redactText('nit 8001234567');
    expect(llmText).toBe('[NIT]');
  });

  it('NIT claimed before cedula fallback', () => {
    const { redactionLog } = redactText('NIT 900123456-7');
    expect(redactionLog).toHaveLength(1);
    expect(redactionLog[0]?.fieldName).toBe('nit');
  });
});

describe('redactText — placa', () => {
  it('redacts placa with dash', () => {
    const { llmText } = redactText('El vehículo ABC-123 se detuvo');
    expect(llmText).toBe('El vehículo [PLACA] se detuvo');
  });

  it('redacts placa without dash', () => {
    const { llmText } = redactText('Placa XYZ 789 reportada');
    expect(llmText).toBe('Placa [PLACA] reportada');
  });

  it('redacts 4-digit placa (moto)', () => {
    const { llmText } = redactText('Moto TUR 12A placa XKL1234 en inventario');
    expect(llmText).toContain('[PLACA]');
  });

  it('redacts placa stuck to text', () => {
    const { llmText } = redactText('vehículo ABC123 registrado');
    expect(llmText).toBe('vehículo [PLACA] registrado');
  });
});

describe('redactText — dirección', () => {
  it('redacts carrera with hash', () => {
    const { llmText } = redactText('Residencia en Cra 45 # 12-34 barrio El Poblado');
    expect(llmText).toBe('Residencia en [DIR] barrio El Poblado');
  });

  it('redacts calle with letter suffix', () => {
    const { llmText } = redactText('Oficina en Cra 45B # 12-34A, oficina 501');
    expect(llmText).toContain('[DIR]');
    expect(llmText).not.toContain('Cra 45B');
  });

  it('redacts avenida with dot', () => {
    const { llmText } = redactText('Av. 68 #20-45');
    expect(llmText).toBe('[DIR]');
  });

  it('redacts diagonal and transversal', () => {
    const r1 = redactText('vive en diagonal 12 #34-56');
    const r2 = redactText('Transversal 5 #22-10 oficina A');
    expect(r1.llmText).toBe('vive en [DIR]');
    expect(r2.llmText).toContain('[DIR]');
  });

  it('redacts calle without dash suffix', () => {
    const { llmText } = redactText('Calle 10 #5-67');
    expect(llmText).toBe('[DIR]');
  });
});

describe('redactText — multi-PII paragraph', () => {
  it('redacts all 5 PII types in a realistic paragraph', () => {
    const input =
      'Buen día, soy Pedro con CC 1020304050, celular 3009876543, correo pedro@mail.com, ' +
      'vivo en Cra 45 # 12-34 y mi vehículo es ABC-123.';
    const { llmText, redactionLog } = redactText(input);

    expect(llmText).toContain('[CED]');
    expect(llmText).toContain('[TEL]');
    expect(llmText).toContain('[EMAIL]');
    expect(llmText).toContain('[DIR]');
    expect(llmText).toContain('[PLACA]');
    expect(llmText).not.toContain('1020304050');
    expect(llmText).not.toContain('3009876543');
    expect(llmText).not.toContain('pedro@mail.com');
    expect(llmText).not.toContain('ABC-123');

    // 5 distinct matches
    expect(redactionLog.length).toBeGreaterThanOrEqual(5);
    const fields = new Set(redactionLog.map((e) => e.fieldName));
    expect(fields.has('cedula')).toBe(true);
    expect(fields.has('telefono')).toBe(true);
    expect(fields.has('email')).toBe(true);
    expect(fields.has('direccion')).toBe(true);
    expect(fields.has('placa')).toBe(true);
  });

  it('preserves non-PII surrounding text verbatim', () => {
    const { llmText } = redactText('Gracias, responder al correo test@x.co lo antes posible.');
    expect(llmText.startsWith('Gracias, responder al correo ')).toBe(true);
    expect(llmText.endsWith(' lo antes posible.')).toBe(true);
  });
});

describe('redactText — PII-free inputs (regression)', () => {
  it('does not touch generic civic text', () => {
    const input = 'La alcaldía de Medellín responde peticiones';
    const { llmText, redactionLog } = redactText(input);
    expect(llmText).toBe(input);
    expect(redactionLog).toHaveLength(0);
  });

  it('does not redact plain narrative', () => {
    const input = 'El ciudadano solicita información sobre un trámite pendiente.';
    const { llmText, redactionLog } = redactText(input);
    expect(llmText).toBe(input);
    expect(redactionLog).toHaveLength(0);
  });

  it('does not redact short numbers (años, códigos)', () => {
    const input = 'El año 2026 fue clave. Código 42.';
    const { llmText, redactionLog } = redactText(input);
    expect(llmText).toBe(input);
    expect(redactionLog).toHaveLength(0);
  });

  it('empty string returns empty', () => {
    const { llmText, redactionLog } = redactText('');
    expect(llmText).toBe('');
    expect(redactionLog).toHaveLength(0);
  });

  it('does not redact words that look like plates (lowercase)', () => {
    const input = 'abc123 no es una placa válida';
    const { llmText } = redactText(input);
    // Lowercase: plate pattern requires [A-Z]{3} so this should NOT match.
    expect(llmText).toBe(input);
  });
});

describe('redactText — audit log', () => {
  it('logs offset into the original string', () => {
    const input = 'hola 3001234567 mundo';
    const { redactionLog } = redactText(input);
    expect(redactionLog).toHaveLength(1);
    expect(redactionLog[0]?.offset).toBe(5);
    expect(redactionLog[0]?.match).toBe('3001234567');
  });

  it('log entries are sorted by offset ascending', () => {
    const input = 'correo a@b.co y cedula 1234567890 y cel 3001234567';
    const { redactionLog } = redactText(input);
    const offsets = redactionLog.map((e) => e.offset);
    const sorted = [...offsets].sort((a, b) => a - b);
    expect(offsets).toEqual(sorted);
  });

  it('match field contains the raw text that was replaced', () => {
    const input = 'NIT 900123456-7 S.A.S.';
    const { redactionLog } = redactText(input);
    expect(redactionLog[0]?.match).toMatch(/NIT.*900123456/);
  });
});

describe('redactText — overlap handling', () => {
  it('email does not double-redact its digits as a cedula', () => {
    const input = 'correo user1234567@mail.com';
    const { redactionLog } = redactText(input);
    expect(redactionLog).toHaveLength(1);
    expect(redactionLog[0]?.fieldName).toBe('email');
  });

  it('NIT does not double-redact as cedula', () => {
    const input = 'NIT 900123456-7';
    const { redactionLog } = redactText(input);
    expect(redactionLog).toHaveLength(1);
    expect(redactionLog[0]?.fieldName).toBe('nit');
  });
});
