export function formatCurrency(value?: number, decimals = 2) {
  if (value == null || Number.isNaN(value)) return '-';
  return `₹${value.toFixed(decimals)}`;
}

export function toPercent(value?: number) {
  if (value == null || Number.isNaN(value)) return '-';
  return `${value.toFixed(2)}%`;
}

export function formatDate(value?: string) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function parsePackSize(pack?: string) {
  return parsePackMeta(pack).packSize;
}

export function parsePackMeta(pack?: string) {
  const value = String(pack || '').trim().toUpperCase();
  const compact = value.replace(/\s+/g, '');
  if (!compact) {
    return { packSize: 1, baseUom: 'UNIT', packUom: 'UNIT', ambiguous: true, reason: 'Pack is blank' };
  }

  const numberPattern = /(\d+(?:\.\d+)?)/g;
  const multiplierPattern = /(\d+(?:\.\d+)?)\s*[X*]\s*(\d+(?:\.\d+)?)/;
  const alphaPattern = /[A-Z]+/g;

  const tabTokens = new Set(['TAB', 'TABS', 'TABLET', 'TABLETS']);
  const capTokens = new Set(['CAP', 'CAPS', 'CAPSULE', 'CAPSULES']);
  const mlTokens = new Set(['ML', 'MILLILITER', 'MILLILITERS', 'MILLILITRE', 'MILLILITRES']);
  const lTokens = new Set(['L', 'LTR', 'LITRE', 'LITER', 'LITRES', 'LITERS']);
  const gmTokens = new Set(['G', 'GM', 'GRAM', 'GRAMS']);
  const kgTokens = new Set(['KG', 'KILOGRAM', 'KILOGRAMS']);
  const mgTokens = new Set(['MG', 'MILLIGRAM', 'MILLIGRAMS']);
  const stripTokens = new Set(['STRIP', 'STRIPS', 'BLISTER', 'BLISTERS']);
  const boxTokens = new Set(['BOX', 'BOXES', 'CARTON', 'CASE', 'KIT']);
  const bottleTokens = new Set(['BOTTLE', 'BOTTLES']);
  const vialTokens = new Set(['VIAL', 'VIALS']);
  const ampuleTokens = new Set(['AMP', 'AMPS', 'AMPOULE', 'AMPOULES', 'AMPULE', 'AMPULES']);
  const tubeTokens = new Set(['TUBE', 'TUBES']);
  const sachetTokens = new Set(['SACHET', 'SACHETS']);
  const jarTokens = new Set(['JAR', 'JARS']);
  const pouchTokens = new Set(['POUCH', 'POUCHES']);
  const packTokens = new Set(['PACK', 'PACKS']);

  const tokenList = compact.match(alphaPattern) || [];
  const tokens = new Set(tokenList);
  const hasAlpha = tokens.size > 0;
  const hasAny = (needleSet: Set<string>) => Array.from(tokens).some((token) => needleSet.has(token));

  const detectBaseUom = () => {
    if (hasAny(tabTokens)) return 'TAB';
    if (hasAny(capTokens)) return 'CAP';
    if (hasAny(mlTokens) || hasAny(lTokens)) return 'ML';
    if (hasAny(gmTokens) || hasAny(kgTokens)) return 'GM';
    if (hasAny(mgTokens)) return 'MG';
    return 'UNIT';
  };

  const detectPackUom = () => {
    if (hasAny(stripTokens)) return 'STRIP';
    if (hasAny(boxTokens)) return 'BOX';
    if (hasAny(bottleTokens)) return 'BOTTLE';
    if (hasAny(vialTokens)) return 'VIAL';
    if (hasAny(ampuleTokens)) return 'AMPULE';
    if (hasAny(tubeTokens)) return 'TUBE';
    if (hasAny(sachetTokens)) return 'SACHET';
    if (hasAny(jarTokens)) return 'JAR';
    if (hasAny(pouchTokens)) return 'POUCH';
    if (hasAny(packTokens)) return 'PACK';
    return '';
  };

  const toPositiveInt = (raw?: string) => {
    const parsed = Number(raw || 0);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.round(parsed);
  };

  const firstPositiveNumber = () => {
    const matches = compact.match(numberPattern) || [];
    for (const token of matches) {
      const parsed = Number(token);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return -1;
  };

  const convertToBaseSize = (numericValue: number, baseUom: string) => {
    let scaled = numericValue;
    if (baseUom === 'ML' && hasAny(lTokens)) {
      scaled = numericValue * 1000;
    } else if (baseUom === 'GM' && hasAny(kgTokens)) {
      scaled = numericValue * 1000;
    }
    return Math.max(1, Math.round(scaled));
  };

  const defaultPackUom = (baseUom: string, packSize: number) => {
    if (packSize <= 1) return 'UNIT';
    if (baseUom === 'TAB' || baseUom === 'CAP') return 'STRIP';
    if (baseUom === 'ML' || baseUom === 'GM' || baseUom === 'MG') return 'UNIT';
    return 'PACK';
  };

  let baseUom = detectBaseUom();
  let explicitPackUom = detectPackUom();
  let packSize = 1;
  let ambiguous = false;
  let reason = '';

  const multiplierMatch = compact.match(multiplierPattern);
  if (multiplierMatch) {
    const first = toPositiveInt(multiplierMatch[1]);
    const second = toPositiveInt(multiplierMatch[2]);
    if (first <= 0 || second <= 0) {
      ambiguous = true;
      reason = 'Pack multiplier is invalid';
    } else if (first === 1) {
      packSize = second;
    } else if (!hasAlpha) {
      packSize = second;
      ambiguous = true;
      reason = 'Pack has multiple factors without unit context';
    } else {
      packSize = Math.max(1, first * second);
      if (!explicitPackUom) {
        explicitPackUom = 'PACK';
      }
    }
    if (!hasAlpha) {
      baseUom = 'TAB';
    }
  } else {
    const firstNumeric = firstPositiveNumber();
    if (firstNumeric <= 0) {
      ambiguous = true;
      reason = 'Pack must include a numeric quantity';
      packSize = 1;
    } else {
      packSize = convertToBaseSize(firstNumeric, baseUom);
    }
    if (!hasAlpha) {
      ambiguous = true;
      reason = 'Pack is numeric without unit context';
    }
  }

  if (packSize <= 0) {
    packSize = 1;
    ambiguous = true;
    reason = reason || 'Pack size could not be resolved';
  }

  const packUom = explicitPackUom || defaultPackUom(baseUom, packSize);
  return { packSize, baseUom, packUom, ambiguous, reason };
}

export function formatPackSplitStock(stock?: number, pack?: string) {
  const safeStock = Math.max(0, Number(stock || 0));
  const { packSize, packUom, baseUom } = parsePackMeta(pack);
  if (packSize <= 1) return `${safeStock} ${baseUom}`;
  const fullStrips = Math.floor(safeStock / packSize);
  const looseUnits = safeStock % packSize;
  if (looseUnits <= 0) {
    return `${fullStrips} ${packUom}`;
  }
  return `${fullStrips} ${packUom} + ${looseUnits} ${baseUom}`;
}
