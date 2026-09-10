const CODE128_PATTERNS = [
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111",
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112",
] as const;

export type Code128Bar = { x: number; width: number };
export type Code128Barcode = { width: number; bars: Code128Bar[] };

export function code128Barcode(value: string, quietZone = 10): Code128Barcode {
  if (!value) throw new Error("Code 128 requires a non-empty value.");

  const dataCodes = [...value].map((character) => {
    const code = character.charCodeAt(0);
    if (code < 32 || code > 126) {
      throw new Error("Code 128B supports printable ASCII values only.");
    }
    return code - 32;
  });
  const checksum =
    (104 + dataCodes.reduce((total, code, index) => total + code * (index + 1), 0)) % 103;
  const encodedCodes = [104, ...dataCodes, checksum, 106];
  const bars: Code128Bar[] = [];
  let x = quietZone;

  for (const code of encodedCodes) {
    const pattern = CODE128_PATTERNS[code];
    if (!pattern) throw new Error(`Unsupported Code 128 value: ${code}`);
    let cursor = x;
    for (const [index, widthCharacter] of [...pattern].entries()) {
      const width = Number(widthCharacter);
      if (index % 2 === 0) bars.push({ x: cursor, width });
      cursor += width;
    }
    x = cursor;
  }

  return { width: x + quietZone, bars };
}

export function code128Svg(value: string, height = 42) {
  const barcode = code128Barcode(value);
  const rects = barcode.bars
    .map(({ x, width }) => `<rect x="${x}" y="0" width="${width}" height="${height}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${barcode.width} ${height}" role="img" aria-label="Code 128 barcode" shape-rendering="crispEdges">${rects}</svg>`;
}
