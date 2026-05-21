import LZString from 'lz-string';

const sel = [
  { e: '550e8400-e29b-41d4-a716-446655440000', o: '660e8400-e29b-41d4-a716-446655440001' },
  { e: '770e8400-e29b-41d4-a716-446655440002', o: '880e8400-e29b-41d4-a716-446655440003' },
  { e: '990e8400-e29b-41d4-a716-446655440004', o: 'aa0e8400-e29b-41d4-a716-446655440005' },
  { e: 'bb0e8400-e29b-41d4-a716-446655440006', o: 'cc0e8400-e29b-41d4-a716-446655440007' },
  { e: 'dd0e8400-e29b-41d4-a716-446655440008', o: 'ee0e8400-e29b-41d4-a716-446655440009' },
];

const old = btoa(JSON.stringify({ s: sel })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const compact = sel.map(s => s.e + '|' + s.o).join(';');
const neuCompact = 'z' + LZString.compressToEncodedURIComponent(compact);

console.log('Old length:', old.length);
console.log('Compact length:', neuCompact.length);
console.log('Compact:', neuCompact);
