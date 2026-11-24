// Mã QR trang trí trên biên lai (SVG cố định, không chứa dữ liệu thật).
export default function QrMark({ size = 56 }: { size?: number }) {
  const cells = [
    "1111111010101111111",
    "1000001001001000001",
    "1011101011101011101",
    "1011101000001011101",
    "1011101110101011101",
    "1000001000011000001",
    "1111111010101111111",
    "0000000110010000000",
    "1101101001011101101",
    "0100110111100010010",
    "1011001000011101101",
    "0000000110101010110",
    "1111111001010101001",
    "1000001110111100110",
    "1011101011001010101",
    "1011101100010011010",
    "1011101001101110011",
    "1000001010100001100",
    "1111111100011011101",
  ];
  const n = cells.length;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} aria-hidden="true" focusable="false" className="text-[#0b2341]">
      {cells.flatMap((row, y) =>
        [...row].map((c, x) => (c === "1" ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" /> : null)),
      )}
    </svg>
  );
}
