import type { SecretariaCode } from '../schemas.js';

export const PROMPT_VERSION = 'classifier-v1.1.0';

export const SECRETARIA_NAMES: Record<SecretariaCode, string> = {
  DESP: 'Despacho del Alcalde',
  SGOB: 'Secretaria de Gobierno y Gestion del Gabinete',
  SHAC: 'Secretaria de Hacienda',
  SSAL: 'Secretaria de Salud',
  SEDU: 'Secretaria de Educacion',
  SMOV: 'Secretaria de Movilidad',
  SMAM: 'Secretaria de Medio Ambiente',
  SINF: 'Secretaria de Infraestructura Fisica',
  SSEG: 'Secretaria de Seguridad y Convivencia',
  SDE: 'Secretaria de Desarrollo Economico',
  SCUL: 'Secretaria de Cultura Ciudadana',
  SJUV: 'Secretaria de la Juventud',
  SMUJ: 'Secretaria de las Mujeres',
  SPDH: 'Secretaria de Paz y Derechos Humanos',
  SPAR: 'Secretaria de Participacion Ciudadana',
  SGHS: 'Secretaria de Gestion Humana y Servicio a la Ciudadania',
  SSUM: 'Secretaria de Servicios y Suministros',
  SEVC: 'Secretaria de Evaluacion y Control',
  SINC: 'Secretaria de Innovacion Digital',
  SCOM: 'Secretaria de Comunicaciones',
  SIND: 'Secretaria de Inclusion Social y Familia',
  DAP: 'Departamento Administrativo de Planeacion',
  DAGRD: 'Departamento Administrativo de Gestion del Riesgo de Desastres',
  GCEN: 'Gerencia del Centro',
  GCOR: 'Gerencia de Corregimientos',
  UAEBC: 'Unidad Administrativa Especial Buen Comienzo',
};

export const TAXONOMY_PROMPT = `
PQRSD types:
- peticion: asks for action, documents, information, answers, or municipal service.
- queja: reports dissatisfaction with conduct, treatment, delay, or service quality.
- reclamo: asks correction or compensation for a service, charge, decision, or damage.
- oposicion: files a formal opposition or challenge to an administrative decision, act, registration, sanction, permit, or comparable municipal determination; these require response within 5 business days.
- sugerencia: proposes an improvement or new action.
- denuncia: reports possible illegal, corrupt, risky, or sanctionable conduct.

Dependency taxonomy:
- DESP: mayor office, strategic citywide direction, direct mayor escalation.
- SGOB: general governance, cabinet management, administrative coordination.
- SHAC: taxes, billing, property tax, industry and commerce tax, treasury.
- SSAL: public health, hospitals, epidemiology, urgent health access.
- SEDU: schools, enrollment, teachers, education infrastructure.
- SMOV: traffic, transit, road safety, parking, traffic lights, vehicle plate matters.
- SMAM: trees, animals, air, water, noise pollution, environmental control.
- SINF: roads, sidewalks, bridges, public works, road surface, physical infrastructure.
- SSEG: security, coexistence, public order, violence prevention, nuisance.
- SDE: commerce, jobs, entrepreneurship, economic development.
- SCUL: culture, libraries, festivals, cultural facilities.
- SJUV: youth programs and youth participation.
- SMUJ: women, gender violence prevention, gender equity programs.
- SPDH: peace, human rights, victims, reintegration.
- SPAR: citizen participation, JAL/JAC, community organizations.
- SGHS: public servant conduct, citizen service channels, HR matters.
- SSUM: supplies, facilities, public utilities, cleaning or maintenance services.
- SEVC: internal control, audit, evaluation.
- SINC: digital services, technology, open data, systems.
- SCOM: communications, public information campaigns.
- SIND: social inclusion, family, homelessness, disability, older adults.
- DAP: land use, planning, POT, cadastral planning, urban development.
- DAGRD: disasters, landslides, floods, structural risk, emergency management.
- GCEN: downtown Medellin management and Centro issues.
- GCOR: rural districts and corregimientos.
- UAEBC: early childhood and Buen Comienzo.

Urgency:
- critica: imminent life, health, safety, disaster, child protection, court/tutela deadline.
- alta: vulnerable population, health access, serious security or service interruption.
- media: administrative delay, repeated unanswered requests, moderate service impact.
- baja: ordinary information or non-urgent requests.
`.trim();
